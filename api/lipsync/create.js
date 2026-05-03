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

const script = String(body.script || "").trim();
const resolution = String(body.resolution || "1080p").trim();
const durationSeconds = Math.max(
  10,
  Math.min(60, Number(body.durationSeconds || body.duration || 10))
);

const charsPerSecond = 13;
const estimatedSpeechSeconds = Math.ceil(script.length / charsPerSecond);
const maxSpeechSeconds = durationSeconds;

if (estimatedSpeechSeconds > maxSpeechSeconds) {
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

    if (!script) {
      return res.status(400).json({
        ok: false,
        error: "script_required"
      });
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
  william: {
    voice_id: "13be37a20b2448b7ad9db1a8669e5569",
    voice_name: "William Prescott"
  },
  lily: {
    voice_id: "14979664b31246cbb735cc86d17b7907",
    voice_name: "Lily"
  },
  april: {
    voice_id: "1508afc3681349ad842f2e7194b7eb22",
    voice_name: "April"
  }
};

const requestedVoiceKey = String(body.voice_key || body.voiceKey || "tranquil_tulin").trim();
const pickedVoice = LIPSYNC_ALLOWED_VOICES[requestedVoiceKey] || LIPSYNC_ALLOWED_VOICES.tranquil_tulin;

const heygenRes = await fetch("https://api.heygen.com/v3/videos", {
  method: "POST",
  headers: {
    "x-api-key": process.env.HEYGEN_API_KEY,
    "Content-Type": "application/json",
  },
body: JSON.stringify({
  type: "image",
 image: {
  type: "url",
  url: preparedImageUrl,
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
  speed: estimatedSpeechSeconds <= 4 ? 0.75 : estimatedSpeechSeconds <= 8 ? 0.85 : 1.0
}
}),
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
