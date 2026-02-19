// /api/providers/fal/video/status.js
// FINAL STABLE VERSION (Atmosfer)
// - Endpoint tahmini YOK
// - POST only
// - Fal redirect status_url yakalar
// - DB meta status_url overwrite eder
// - PPE ready outputs üretir

const { neon } = require("@neondatabase/serverless");

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

function normalizeStatus(rawStatus, videoUrl) {
  const st = String(rawStatus || "").toUpperCase();

  if (videoUrl) return "COMPLETED";

  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(st))
    return "COMPLETED";

  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(st))
    return "RUNNING";

  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(st))
    return "IN_QUEUE";

  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(st))
    return "FAILED";

  return "UNKNOWN";
}

function extractVideoUrl(falJson) {
  return (
    pick(falJson, [
      "video.url",
      "output.video.url",
      "output.url",
      "data.video.url",
      "data.output.video.url",
      "result.video.url",
      "result.output.video.url",
    ]) ||
    (Array.isArray(falJson?.outputs)
      ? falJson.outputs.find(x => x?.url)?.url || null
      : null) ||
    null
  );
}

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

async function updateStatusUrlInDB(job_id, newStatusUrl) {
  const conn = pickConn();
  if (!conn || !job_id || !newStatusUrl) return;

  const sql = neon(conn);

  await sql`
    update jobs
    set meta = jsonb_set(
      coalesce(meta, '{}'::jsonb),
      '{provider_response,raw,status_url}',
      ${JSON.stringify(newStatusUrl)}::jsonb,
      true
    ),
    updated_at = now()
    where id = ${job_id}::uuid
  `;
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const q = req.query || {};
    const b = req.body || {};

    const app = String(q.app || b.app || "atmo");
    const job_id = String(q.job_id || b.job_id || "").trim();

    let status_url =
      String(q.status_url || b.status_url || q.response_url || b.response_url || "").trim();

    if (!status_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_status_url",
      });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({
        ok: false,
        error: "missing_fal_key",
      });
    }

    const headers = {
      Authorization: `Key ${FAL_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const r = await fetch(status_url, {
      method: "POST",
      headers,
      body: "{}",
    });

    const text = await r.text().catch(() => "");
    let fal;
    try { fal = JSON.parse(text); } catch { fal = { raw: text }; }

    // 404 → FAILED
    if (r.status === 404) {
      return res.status(200).json({
        ok: true,
        provider: "fal",
        app,
        status: "FAILED",
        video_url: null,
        outputs: [],
        status_url,
      });
    }

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: r.status,
        status_url,
      });
    }

    // 🔥 Fal yeni status_url döndürmüş mü?
    const newStatusUrl =
      pick(fal, ["status_url", "response_url", "data.status_url"]) || null;

    if (newStatusUrl && newStatusUrl !== status_url) {
      status_url = newStatusUrl;

      // DB güncelle (redirect sabitle)
      if (job_id) {
        await updateStatusUrlInDB(job_id, newStatusUrl);
      }
    }

    const video_url = extractVideoUrl(fal);

    const rawStatus =
      pick(fal, ["status", "data.status", "result.status", "state"]) || null;

    const status = normalizeStatus(rawStatus, video_url);

    const outputs = video_url
      ? [{ type: "video", url: video_url, meta: { app } }]
      : [];

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      status,
      video_url,
      outputs,
      fal,
      status_url,
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
};
