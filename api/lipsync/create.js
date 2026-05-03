export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
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

    // HEYGEN VIDEO CREATE
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
    url: body.image_url || body.imageUrl,
  },
  script,
  voice_id: process.env.HEYGEN_VOICE_ID,
 resolution,
aspect_ratio: String(body.aspectRatio || body.aspect_ratio || "16:9"),
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
