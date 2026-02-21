export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/video/create.js
import { neon } from "@neondatabase/serverless";
import authModule from "../../../_lib/auth.js";
const { requireAuth } = authModule;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function isMock(req) {
  const u = new URL(req.url, "http://localhost");
  const q = u.searchParams.get("mock");
  const h = (req.headers["x-aivo-mock"] || req.headers["x-mock"] || "").toString();
  return q === "1" || h === "1" || h.toLowerCase() === "true";
}

function safeJson(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const k of parts) {
      if (!cur || typeof cur !== "object" || !(k in cur)) {
        ok = false;
        break;
      }
      cur = cur[k];
    }
    if (ok && cur != null) return cur;
  }
  return null;
}

function extractFalStatusUrl(data) {
  const direct =
    pick(data, [
      "status_url",
      "statusUrl",
      "response_url",
      "responseUrl",
      "urls.status",
      "urls.response",
      "links.status",
      "links.response",
      "data.status_url",
      "data.response_url",
      "result.status_url",
      "result.response_url",
    ]) || null;

  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // ---- AUTH ----
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
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized", message: "missing_email" });
  }

  // ---- DB ----
  const conn = pickConn();
  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }
  const sql = neon(conn);

  // ---- INPUT ----
  const body = safeJson(req);

  // 🔑 Eğer create-atmo iç çağrısıysa job_id gelir; yeni job açmak YASAK.
  const incomingJobId = body.job_id ? String(body.job_id) : null;

  const {
    app = "atmo",
    prompt,
    duration = 10,
    aspect_ratio = "16:9",
    generate_audio = false, // ✅ default maliyetsiz: ses yok
    shot_type = "customize",
    negative_prompt = "blur, distort, and low quality",
    cfg_scale = 0.5,
    multi_prompt = null,
    voice_ids = null,
    meta = null,
  } = body;

  // ✅ BASIC MODE için structured seçimlerden prompt üret
  let promptSafe = prompt;

  if (!promptSafe && !multi_prompt) {
    const parts = [];

    if (body.scene) parts.push(`Scene: ${body.scene}.`);
    if (Array.isArray(body.effects) && body.effects.length)
      parts.push(`Effects: ${body.effects.join(", ")}.`);
    if (body.camera) parts.push(`Camera: ${body.camera}.`);
    if (body.duration) parts.push(`Duration: ${body.duration} seconds.`);
    if (body.aspect_ratio) parts.push(`Aspect ratio: ${body.aspect_ratio}.`);

    if (!parts.length) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    promptSafe = parts.join(" ") + " Seamless loop. Cinematic. No text.";
  }

  // ---- canonical user_uuid resolve ----
  const userRow = await sql`
    select id
    from users
    where email = ${email}
    limit 1
  `;
  if (!userRow.length) {
    return res.status(401).json({ ok: false, error: "user_not_found", email });
  }
  const user_uuid = String(userRow[0].id);

  // =========================================================
  // ✅ MOCK MODE (kredisiz test)
  // - job_id geldiyse UPDATE eder, yeni insert etmez
  // =========================================================
  const MOCK = isMock(req);
  if (MOCK) {
    const mock_request_id = `mock_atmo_${Date.now()}`;
    const now = new Date().toISOString();
    const mock_video_url = "https://aivo.tr/media/hero-video.mp4";

    const outputs = [{ type: "video", url: mock_video_url, meta: { app } }];

    const metaObj = {
      ...(meta && typeof meta === "object" ? meta : {}),
      app,
      kind: "atmo_video",
      provider: "mock",
      request_id: mock_request_id,
      provider_response: { mock: true },
    };

    // ✅ Eğer job_id geldiyse: update
    if (incomingJobId) {
      await sql`
        update jobs
        set status = 'done',
            meta = ${JSON.stringify(metaObj)}::jsonb,
            outputs = ${JSON.stringify(outputs)}::jsonb,
            updated_at = now()
        where id = ${incomingJobId}::uuid
          and user_uuid = ${user_uuid}::uuid
      `;

      return res.status(200).json({
        ok: true,
        mock: true,
        provider: "mock",
        app,
        request_id: mock_request_id,
        job_id: incomingJobId,
        status: "COMPLETED",
        outputs,
      });
    }

    // (dışarıdan doğrudan test çağrısı için fallback: insert)
    const rows = await sql`
      insert into jobs (
        user_id, user_uuid, type, app, status, prompt, meta, outputs, created_at, updated_at
      )
      values (
        ${email},
        ${user_uuid}::uuid,
        ${app},
        ${app},
        ${"done"},
        ${prompt || null},
        ${JSON.stringify(metaObj)}::jsonb,
        ${JSON.stringify(outputs)}::jsonb,
        ${now},
        ${now}
      )
      returning id
    `;

    return res.status(200).json({
      ok: true,
      mock: true,
      provider: "mock",
      app,
      request_id: mock_request_id,
      job_id: rows?.[0]?.id || null,
      status: "COMPLETED",
      outputs,
    });
  }

  // =========================================================
  // ✅ REAL MODE (Fal)
  // =========================================================
  const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ ok: false, error: "missing_fal_key" });
  }

  // ✅ MODE'A GÖRE MOTOR SEÇİMİ (Basit = standard, Süper = pro)
  const mode = String(body?.mode || body?.meta?.mode || "").toLowerCase();

  const falUrl =
    mode === "basic"
      ? "https://queue.fal.run/fal-ai/kling-video/v3/standard/text-to-video"
      : "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);

  let r;
  try {
    r = await fetch(falUrl, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
     body: JSON.stringify({
  ...(multi_prompt ? { multi_prompt } : { prompt: promptSafe }),
  duration,
  aspect_ratio,
  generate_audio,
  shot_type,
  negative_prompt,
  cfg_scale,
  ...(Array.isArray(voice_ids) ? { voice_ids } : {}),

  // 🔥 EKLE
  ...(body.image_url ? { image_url: body.image_url } : {}),
  ...(body.logo_url ? { logo_url: body.logo_url } : {}),
  ...(body.logo_pos ? { logo_pos: body.logo_pos } : {}),
  ...(body.logo_size ? { logo_size: body.logo_size } : {}),
  ...(body.logo_opacity ? { logo_opacity: body.logo_opacity } : {}),
}),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    return res.status(504).json({
      ok: false,
      provider: "fal",
      error: "fal_timeout_or_network_error",
      message: e?.message || "unknown_fetch_error",
    });
  } finally {
    clearTimeout(t);
  }

  const text = await r.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _non_json: text };
  }

  if (!r.ok) {
    return res.status(r.status).json({
      ok: false,
      provider: "fal",
      error: "fal_error",
      fal_status: r.status,
      fal_response: data,
    });
  }

  const request_id =
    data?.request_id || data?.requestId || data?.id || data?._id || null;

  const status_url = extractFalStatusUrl(data);

   // ✅ ATMOS: MP3 embed meta'yı zorla yaz (mux tetiklensin)
  const audio_url_raw =
    pick(body, ["audio_url", "audioUrl", "audio.url"]) ||
    pick(meta, ["audio_url", "audioUrl", "audio.url"]) ||
    null;

  const audio_mode_raw =
    pick(body, ["audio_mode", "audioMode"]) ||
    pick(meta, ["audio_mode", "audioMode"]) ||
    null;

  const silent_copy_raw =
    pick(body, ["silent_copy", "silentCopy"]) ||
    pick(meta, ["silent_copy", "silentCopy"]) ||
    null;

  // ✅ audio_url varsa embed'i zorla
  const audio_url = audio_url_raw ? String(audio_url_raw).trim() : null;
  const audio_mode = audio_url ? "embed" : null;
  const silent_copy = audio_url ? false : null;

  const metaObj = {
    ...(meta && typeof meta === "object" ? meta : {}),
    app,
    kind: "atmo_video",
    provider: "fal",
    request_id,

    // ✅ mux koşulları (status.js mux bloğu için)
    ...(audio_url
      ? {
          audio_mode, // "embed"
          audio_url, // R2 public url
          silent_copy, // false
        }
      : {}),

    provider_response: {
      status_url: status_url || null,
      response_url: status_url || null,
      raw: {
        ...(data && typeof data === "object" ? data : { raw_text: text }),
        status_url: status_url || data?.status_url || data?.statusUrl || null,
        response_url:
          status_url || data?.response_url || data?.responseUrl || null,
      },
    },
  };

  // ✅ KRİTİK: job_id geldiyse INSERT YOK, UPDATE VAR
  if (incomingJobId) {
    await sql`
      update jobs
      set status = 'processing',
          meta = ${JSON.stringify(metaObj)}::jsonb,
          updated_at = now()
      where id = ${incomingJobId}::uuid
        and user_uuid = ${user_uuid}::uuid
    `;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      request_id,
      status_url: status_url || null,
      job_id: incomingJobId,
      raw: data,
      updated: true,
    });
  }

  // (dışarıdan direkt çağrı için fallback: insert)
  const now = new Date().toISOString();
  const rows = await sql`
    insert into jobs (
      user_id, user_uuid, type, app, status, prompt, meta, outputs, created_at, updated_at
    )
    values (
      ${email},
      ${user_uuid}::uuid,
      ${app},
      ${app},
      ${"queued"},
      ${prompt || null},
      ${JSON.stringify(metaObj)}::jsonb,
      ${"[]"}::jsonb,
      ${now},
      ${now}
    )
    returning id
  `;

  return res.status(200).json({
    ok: true,
    provider: "fal",
    app,
    request_id,
    status_url: status_url || null,
    job_id: rows?.[0]?.id || null,
    raw: data,
    inserted: true,
  });
}
