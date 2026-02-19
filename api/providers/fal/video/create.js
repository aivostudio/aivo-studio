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
  // Fal farklı şekillerde döndürebiliyor; olabildiğince geniş tarıyoruz.
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

  // ---- AUTH (canonical email) ----
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
  const {
    app = "atmo",
    prompt,
    duration = 5,
    aspect_ratio = "9:16",
    generate_audio = true,
    shot_type = "customize",
    negative_prompt = "blur, distort, and low quality",
    cfg_scale = 0.5,
    multi_prompt = null,
    voice_ids = null,
    meta = null,
  } = body;

  if (!prompt && !multi_prompt) {
    return res.status(400).json({ ok: false, error: "missing_prompt" });
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

  const MOCK = isMock(req);

  // =========================================================
  // ✅ MOCK MODE: kredi yokken uçtan uca UI zinciri test
  // =========================================================
  if (MOCK) {
    const mock_request_id = `mock_atmo_${Date.now()}`;
    const now = new Date().toISOString();

    const mock_video_url = "https://aivo.tr/media/hero-video.mp4";

    const rows = await sql`
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
        ${user_uuid}::uuid,
        ${app},              -- type
        ${app},              -- app
        ${"done"},           -- status
        ${prompt || null},
        ${JSON.stringify({
          ...(meta && typeof meta === "object" ? meta : {}),
          app,
          kind: "atmo_video",
          provider: "mock",
          request_id: mock_request_id,
        })}::jsonb,
        ${JSON.stringify([{ type: "video", url: mock_video_url, meta: { app } }])}::jsonb,
        ${now},
        ${now}
      )
      returning id, user_uuid, app, status, created_at
    `;

    return res.status(200).json({
      ok: true,
      mock: true,
      provider: "mock",
      app,
      request_id: mock_request_id,
      job_id: rows?.[0]?.id || null,
      status: "COMPLETED",
      outputs: [{ type: "video", url: mock_video_url, meta: { app } }],
    });
  }

  // =========================================================
  // ✅ REAL MODE: Fal kredi varsa çalışır
  // =========================================================
  const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ ok: false, error: "missing_fal_key" });
  }

  // ⚠️ Not: Bu endpoint senin mevcut seçimin.
  // Asıl kritik fix: response’tan status_url yakalayıp DB’ye yazıyoruz.
  const falUrl = "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

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
        ...(multi_prompt ? { multi_prompt } : { prompt }),
        duration,
        aspect_ratio,
        generate_audio,
        shot_type,
        negative_prompt,
        cfg_scale,
        ...(Array.isArray(voice_ids) ? { voice_ids } : {}),
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

  // ✅ request_id normalize
  const request_id =
    data?.request_id || data?.requestId || data?.id || data?._id || null;

  // ✅ status_url / response_url yakala (kritik)
  const status_url = extractFalStatusUrl(data);

  // DB insert: queued/pending job
  const now = new Date().toISOString();

  const metaObj = {
    ...(meta && typeof meta === "object" ? meta : {}),
    app,
    kind: "atmo_video",
    provider: "fal",
    request_id,
    // ✅ En kritik kısım: provider response’ı olduğu gibi sakla + status_url'yi ayrıca koy
    provider_response: {
      status_url: status_url || null,
      response_url: status_url || null,
      raw: {
        ...(data && typeof data === "object" ? data : { raw_text: text }),
        status_url: status_url || data?.status_url || data?.statusUrl || null,
        response_url:
          status_url ||
          data?.response_url ||
          data?.responseUrl ||
          null,
      },
    },
  };

  const rows = await sql`
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
    returning id, user_uuid, app, status, created_at
  `;

  return res.status(200).json({
    ok: true,
    provider: "fal",
    app,
    request_id,
    status_url: status_url || null, // ✅ debug için
    job_id: rows?.[0]?.id || null,
    raw: data,
  });
}
