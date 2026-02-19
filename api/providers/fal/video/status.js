// /api/providers/fal/video/status.js
// FINAL FIXED VERSION (Atmosfer only)
// - Fal endpoint rotate destekli
// - GET + POST otomatik seçer
// - Yeni status_url gelirse return eder (UI chain takip edebilir)
// - PPE uyumlu outputs üretir

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
      "response.video.url",
      "response.output.video.url",
      "response.output.url",
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

async function resolveStatusUrlFromDB(job_id) {
  const conn = pickConn();
  if (!conn) return null;

  const sql = neon(conn);

  const rows = await sql`
    select meta
    from jobs
    where id = ${job_id}::uuid
    limit 1
  `;

  if (!rows.length) return null;

  const meta = rows[0].meta || {};

  return (
    pick(meta, [
      "provider_response.raw.status_url",
      "provider_response.status_url",
      "provider_response.raw.response_url",
      "provider_response.response_url",
      "status_url",
      "response_url",
    ]) || null
  );
}

async function updateStatusUrlInDB(job_id, newStatusUrl) {
  const conn = pickConn();
  if (!conn) return;

  const sql = neon(conn);

  // meta.provider_response.raw.status_url overwrite
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

async function fetchFal(status_url, falKey) {
  const headers = {
    Authorization: `Key ${falKey}`,
    Accept: "application/json",
  };

  // Fal bazı endpointlerde POST ister, bazıları GET.
  // Kural:
  // - /status ile bitiyorsa POST
  // - değilse GET
  const isStatusEndpoint = status_url.endsWith("/status");

  const r = await fetch(status_url, {
    method: isStatusEndpoint ? "POST" : "GET",
    headers: {
      ...headers,
      ...(isStatusEndpoint ? { "Content-Type": "application/json" } : {}),
    },
    ...(isStatusEndpoint ? { body: "{}" } : {}),
  });

  const text = await r.text().catch(() => "");
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { r, data };
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const q = req.query || {};
    const b = req.body || {};

    const app = String(q.app || b.app || "atmo");

    let status_url = String(
      q.status_url || b.status_url || q.response_url || b.response_url || ""
    ).trim();

    const job_id = String(q.job_id || b.job_id || "").trim();

    if (!status_url && job_id) {
      status_url = await resolveStatusUrlFromDB(job_id);
    }

    if (!status_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_status_url",
        hint: "status_url must be provided (from create response or DB)",
      });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({
        ok: false,
        error: "missing_fal_key",
      });
    }

    // === 1) Fal fetch ===
    const { r, data: fal } = await fetchFal(status_url, FAL_KEY);

    // 404 => job artık yok, poll durmalı
    if (r.status === 404) {
      return res.status(200).json({
        ok: true,
        provider: "fal",
        app,
        status: "FAILED",
        video_url: null,
        outputs: [],
        error: "fal_status_not_found",
        status_url,
        fal,
      });
    }

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: r.status,
        status_url,
        fal,
      });
    }

    // === 2) Fal rotate status_url support ===
    const rotated_status_url =
      pick(fal, ["status_url", "data.status_url", "response.status_url"]) || null;

    if (rotated_status_url && typeof rotated_status_url === "string") {
      const cleaned = rotated_status_url.trim();
      if (cleaned && cleaned !== status_url) {
        status_url = cleaned;

        // DB update (çok kritik)
        if (job_id) {
          await updateStatusUrlInDB(job_id, status_url);
        }
      }
    }

    // === 3) video_url extract ===
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
      status_url,
      fal,
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
};
