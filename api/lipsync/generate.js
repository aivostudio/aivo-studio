export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";

const { requireAuth } = authModule;

const HEYGEN_BASE = "https://api.heygen.com";

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function pickLipsyncId(payload) {
  return (
    payload?.data?.lipsync_id ||
    payload?.data?.id ||
    payload?.lipsync_id ||
    payload?.id ||
    null
  );
}

function calculateCost(durationSeconds) {
  const safeDuration = Math.max(10, Math.min(60, Number(durationSeconds || 10)));
  return Math.ceil(safeDuration / 10) * 15;
}

async function heygenJson(path, body, apiKey) {
  const response = await fetch(`${HEYGEN_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text().catch(() => "");
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const err = new Error(`heygen_http_${response.status}`);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

    const apiKey = String(process.env.HEYGEN_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_heygen_api_key",
        message: "HEYGEN_API_KEY env bulunamadı.",
      });
    }

    const conn = pickConn();

    if (!conn) {
      return res.status(500).json({
        ok: false,
        error: "missing_db_env",
      });
    }

    let auth;
    try {
      auth = await requireAuth(req);
    } catch (e) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e),
      });
    }

    const email = auth?.email ? String(auth.email) : null;

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "missing_email",
      });
    }

    const body = req.body || {};

    const videoUrl = String(
      body.videoUrl ||
      body.video_url ||
      body.inputVideoUrl ||
      body.input_video_url ||
      ""
    ).trim();

    const audioUrl = String(
      body.audioUrl ||
      body.audio_url ||
      body.inputAudioUrl ||
      body.input_audio_url ||
      ""
    ).trim();

    const title = String(body.title || "AIVO Lipsync Video").trim();
    const mode = String(body.mode || "speed").trim() || "speed";
    const durationSeconds = Math.max(
      10,
      Math.min(60, Number(body.durationSeconds || body.duration || 10))
    );
    const cost = calculateCost(durationSeconds);

    if (!videoUrl) {
      return res.status(400).json({
        ok: false,
        error: "video_url_required",
      });
    }

    if (!audioUrl) {
      return res.status(400).json({
        ok: false,
        error: "audio_url_required",
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
        email,
      });
    }

    const userUuid = String(userRows[0].id);

    const lipsyncPayload = await heygenJson(
      "/v3/lipsyncs",
      {
      video: {
  type: "url",
  url: videoUrl,
},
audio: {
  type: "url",
  url: audioUrl,
},
mode,
      },
      apiKey
    );

    const lipsyncId = pickLipsyncId(lipsyncPayload);

    if (!lipsyncId) {
      return res.status(502).json({
        ok: false,
        error: "heygen_lipsync_id_missing",
        payload: lipsyncPayload,
      });
    }

    const metaSafe = {
      app: "lipsync",
      kind: "lipsync_video",
      provider: "heygen",
      providerJobId: lipsyncId,
      heygen_lipsync_id: lipsyncId,
      videoUrl,
      audioUrl,
      title,
      mode,
      durationSeconds,
      cost,
      pricing: {
        unit: "aivo_credit",
        per_10_seconds: 15,
      },
      lipsyncPayload,
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
        'processing',
        ${title},
        ${JSON.stringify(metaSafe)}::jsonb,
        '[]'::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at, outputs, meta
    `;

    const jobId = String(inserted[0].id);

    return res.status(200).json({
      ok: true,
      app: "lipsync",
      provider: "heygen",
      job_id: jobId,
      user_uuid: inserted[0].user_uuid,
      status: inserted[0].status,
      created_at: inserted[0].created_at,
      lipsync_id: lipsyncId,
      cost,
      mode,
    });
  } catch (err) {
    return res.status(err?.status || 500).json({
      ok: false,
      error: "lipsync_generate_error",
      detail: err && err.message ? String(err.message) : String(err),
      payload: err?.payload || null,
    });
  }
}
