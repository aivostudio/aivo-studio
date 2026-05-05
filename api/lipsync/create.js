export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import { putObject } from "../_lib/r2.js";
import authModule from "../_lib/auth.js";

const { requireAuth } = authModule;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function calculateCost(speechSeconds) {
  const safeSeconds = Math.max(1, Math.min(60, Number(speechSeconds || 1)));
  return Math.ceil(safeSeconds / 2) * 3;
}

const LIPSYNC_BAD_TEXT_MESSAGE =
  "Bu metin uygunsuz dil içerdiği için üretim başlatılamadı. Lütfen küfür, hakaret veya nefret söylemi içermeyen bir metin girin.";

function normalizeLipsyncPolicyText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLipsyncBadLanguage(value) {
  const text = normalizeLipsyncPolicyText(value);

  const blockedTerms = [
    "amk",
    "aq",
    "mk",
    "orospu",
    "orospu cocugu",
    "pic",
    "pezevenk",
    "got",
    "gotveren",
    "siktir",
    "sik",
    "sikerim",
    "sikeyim",
    "yarrak",
    "yarak",
    "tasak",
    "tassak",
    "ibne",
    "kahpe",
    "kaltak",
    "aptal",
    "salak",
    "gerizekali",
    "mal",
    "ezik",
    "asagilik",
    "nefret",
    "geber",
    "oldur",
    "katlet",
    "yok et"
  ];

  return blockedTerms.some((term) => {
    const safeTerm = normalizeLipsyncPolicyText(term);
    if (!safeTerm) return false;

   const pattern = safeTerm
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => `${part}[a-z0-9]*`)
  .join("\\s+");

const rx = new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i");

return rx.test(text);
  });
}
async function prepareLipsyncImageForAspect({ imageUrl, aspectRatio, jobId }) {
  const safeImageUrl = String(imageUrl || "").trim();
  const safeAspectRatio = String(aspectRatio || "16:9").trim();

  if (!safeImageUrl) return null;

  if (safeAspectRatio !== "9:16") {
    return safeImageUrl;
  }

  const imageRes = await fetch(safeImageUrl);

  if (!imageRes.ok) {
    throw new Error(`image_fetch_failed:${imageRes.status}`);
  }

  const inputBuffer = Buffer.from(await imageRes.arrayBuffer());

  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(720, 1280, {
      fit: "cover",
      position: "center",
    })
    .jpeg({
      quality: 92,
      progressive: true,
    })
    .toBuffer();

  const key = `lipsync/prepared/${jobId}-9x16.jpg`;

  return await putObject({
    key,
    body: outputBuffer,
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000, immutable",
    contentDisposition: "inline",
  });
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const conn = pickConn();

    if (!conn) {
      return res.status(500).json({
        ok: false,
        error: "missing_db_env"
      });
    }

    let auth;

    try {
      auth = await requireAuth(req);
    } catch (e) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const email = auth?.email ? String(auth.email) : null;

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "missing_email"
      });
    }

    const body = req.body || {};

const rawScript = String(body.script || "").trim();
const audioUrl = String(body.audio_url || body.audioUrl || "").trim();
const hasAudioMode = Boolean(audioUrl);

const script = hasAudioMode ? "" : rawScript;

const rawVoiceSpeed = Math.max(0.7, Math.min(1.3, Number(body.voiceSpeed || body.voice_speed || 1)));
const voiceVolume = Math.max(0.8, Math.min(1.2, Number(body.voiceVolume || body.voice_volume || 1)));
const resolution = String(body.resolution || "1080p").trim();
const durationSeconds = Math.max(
  10,
  Math.min(60, Number(body.durationSeconds || body.duration || 10))
);

const charsPerSecond = 13;

const estimatedSpeechSeconds = hasAudioMode
  ? Math.max(1, Math.ceil(Number(body.audioDurationSeconds || body.audio_duration_seconds || body.estimatedSpeechSeconds || body.estimated_speech_seconds || 1)))
  : Math.max(1, Math.ceil(script.length / charsPerSecond));

    const voiceSpeed = !hasAudioMode && estimatedSpeechSeconds <= 2
  ? Math.min(rawVoiceSpeed, 1)
  : rawVoiceSpeed;

const maxSpeechSeconds = durationSeconds;

if (!hasAudioMode && estimatedSpeechSeconds > maxSpeechSeconds) {
  return res.status(400).json({
    ok: false,
    error: "script_too_long",
    message: `Bu metin yaklaşık ${estimatedSpeechSeconds} saniye sürer. Seçilen süre ${maxSpeechSeconds} saniye.`,
    estimatedSpeechSeconds,
    maxSpeechSeconds,
    durationSeconds
  });
}

const cost = calculateCost(estimatedSpeechSeconds);

if (!script && !hasAudioMode) {
  return res.status(400).json({
    ok: false,
    error: "script_or_audio_required"
  });
}
    if (!hasAudioMode && hasLipsyncBadLanguage(script)) {
  return res.status(400).json({
    ok: false,
    error: "bad_language_policy",
    message: LIPSYNC_BAD_TEXT_MESSAGE
  });
}
    if (hasAudioMode) {
  const audioSeconds = Number(
    body.audioDurationSeconds ||
    body.audio_duration_seconds ||
    0
  );

  if (audioSeconds > 60) {
    return res.status(400).json({
      ok: false,
      error: "audio_too_long",
      message: "Ses dosyası en fazla 60 saniye olabilir."
    });
  }
}
    const sql = neon(conn);

    const userRows = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    `;

    if (!userRows.length) {
      return res.status(401).json({
        ok: false,
        error: "user_not_found",
        email
      });
    }

    const userUuid = String(userRows[0].id);

      const metaSafe = {
      app: "lipsync",
      kind: "lipsync_video",
      provider: "heygen_image_to_video",
      script,
      resolution,
      durationSeconds,
      cost,
      pricing: {
        unit: "aivo_credit",
        per_10_seconds: 15
      },
      createdBy: "lipsync_create_v1"
    };

    const inserted = await sql`
      insert into jobs (
        user_id,
        user_uuid,
        type,
        app,
        status,
        prompt,
        meta,
        outputs,
        created_at,
        updated_at
      )
      values (
        ${email},
        ${userUuid}::uuid,
        'lipsync',
        'lipsync',
        'queued',
        ${script},
        ${JSON.stringify(metaSafe)}::jsonb,
        '[]'::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at, outputs, meta
    `;

    const jobId = String(inserted[0].id);

const imageUrl = String(body.image_url || body.imageUrl || "").trim();

let aspectRatio = String(body.aspectRatio || body.aspect_ratio || "16:9").trim();

if (imageUrl) {
  const imageCheckRes = await fetch(imageUrl);

  if (imageCheckRes.ok) {
    const imageCheckBuffer = Buffer.from(await imageCheckRes.arrayBuffer());
    const imageMeta = await sharp(imageCheckBuffer).metadata();

    if (Number(imageMeta?.height || 0) > Number(imageMeta?.width || 0)) {
      aspectRatio = "9:16";
    }
  }
}

const preparedImageUrl = await prepareLipsyncImageForAspect({
  imageUrl,
  aspectRatio,
  jobId
});

    // HEYGEN VIDEO CREATE
const LIPSYNC_ALLOWED_VOICES = {
  tranquil_tulin: {
    voice_id: process.env.HEYGEN_VOICE_ID,
    voice_name: "Tranquil Tülin"
  },
  iker: {
    voice_id: "117821d0abb146e89cc2a2e99f65d807",
    voice_name: "Iker"
  },
  deep_dieter: {
    voice_id: "118949676b0a46629d1ad52981c3ef84",
    voice_name: "Deep Dieter"
  },
  william: {
    voice_id: "13be37a20b2448b7ad9db1a8669e5569",
    voice_name: "William Prescott"
  },
  menon: {
    voice_id: "145980ae9ed74dd880175c44cc08615a",
    voice_name: "Menon"
  },
  knox: {
    voice_id: "158b76b48ed048d381951887e771e412",
    voice_name: "Knox"
  },
  aaron: {
    voice_id: "184c9014f94142ae949363089aaf53dd",
    voice_name: "Aaron"
  },
  lily: {
    voice_id: "14979664b31246cbb735cc86d17b7907",
    voice_name: "Lily"
  },
  april: {
    voice_id: "1508afc3681349ad842f2e7194b7eb22",
    voice_name: "April"
  },
  tiffany: {
    voice_id: "1519fd8fe5d440a2b58770a6762511de",
    voice_name: "Tiffany"
  },
  brianna: {
    voice_id: "154e13cce06c4452ba3b9865dcdf1434",
    voice_name: "Brianna"
  },
  evelyn: {
    voice_id: "15c34793e92442388fc489bbcd58992b",
    voice_name: "Evelyn Harper"
  },
  laurel: {
    voice_id: "162b75e583c465cb9ed047a538d8f6b",
    voice_name: "Laurel"
  },
  seena: {
    voice_id: "166aa8d7acd1495a83d34024ccb1505",
    voice_name: "Seena Professional"
  }
};

const requestedVoiceKey = String(body.voice_key || body.voiceKey || "tranquil_tulin").trim();
const pickedVoice = LIPSYNC_ALLOWED_VOICES[requestedVoiceKey] || LIPSYNC_ALLOWED_VOICES.tranquil_tulin;

const heygenPayload = hasAudioMode
  ? {
      type: "image",
      image: {
        type: "url",
        url: preparedImageUrl
      },
      audio_url: audioUrl,
      resolution,
      aspect_ratio: aspectRatio
    }
  : {
      type: "image",
      image: {
        type: "url",
        url: preparedImageUrl
      },
      script,
      voice_id: pickedVoice.voice_id,
      resolution,
      aspect_ratio: aspectRatio,
      background: {
        type: "color",
        value: "#080816"
      },
     voice_settings: {
  speed: voiceSpeed,
  volume: voiceVolume
}
    };

console.log("[LIPSYNC][HEYGEN_PAYLOAD]", JSON.stringify(heygenPayload, null, 2));

const heygenRes = await fetch("https://api.heygen.com/v3/videos", {
  method: "POST",
  headers: {
    "x-api-key": process.env.HEYGEN_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(heygenPayload)
});

const heygenJson = await heygenRes.json();

const providerJobId = heygenJson?.data?.video_id;

// DB UPDATE → provider job id kaydet
await sql`
  update jobs
  set meta = jsonb_set(meta, '{provider_job_id}', to_jsonb(${providerJobId}::text), true)
  where id = ${jobId}
`;

return res.status(200).json({
  ok: true,
  app: "lipsync",
  job_id: jobId,
  provider: "heygen_image_to_video",
  provider_job_id: providerJobId || null,
  heygen_raw: heygenJson || null,
  debug_image: {
    original: imageUrl,
    prepared: preparedImageUrl,
    aspectRatio
  },
  user_uuid: inserted[0].user_uuid,
  status: inserted[0].status,
  created_at: inserted[0].created_at,
  cost,
  durationSeconds,
  resolution
});
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_create_error",
      detail: err && err.message ? String(err.message) : String(err)
    });
  }
}
