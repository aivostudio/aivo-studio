export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/photofx/status.js
import { neon } from "@neondatabase/serverless";

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

  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(st)) {
    return "COMPLETED";
  }

  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(st)) {
    return "RUNNING";
  }

  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(st)) {
    return "IN_QUEUE";
  }

  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(st)) {
    return "FAILED";
  }

  return "UNKNOWN";
}

function extractVideoUrl(anyJson) {
  if (!anyJson) return null;

  const direct =
    pick(anyJson, [
      "video.url",
      "video_url",
      "output.video.url",
      "output.url",
      "data.video.url",
      "data.output.video.url",
      "data.output.url",
      "result.video.url",
      "result.output.video.url",
      "result.output.url",
      "response.video.url",
      "response.output.video.url",
      "response.output.url",
    ]) || null;

  if (direct && String(direct).startsWith("http")) return String(direct);

  if (Array.isArray(anyJson.outputs)) {
    const hit = anyJson.outputs.find(
      (x) => x?.url && String(x.url).startsWith("http")
    );
    if (hit) return String(hit.url);
  }

  return null;
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

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!UUID_RE.test(String(job_id || ""))) return null;

  const rows = await sql`
    select meta
    from jobs
    where id = ${job_id}::uuid
    limit 1
  `;

  if (!rows.length) return null;

  const meta = rows[0]?.meta || {};

  return (
    pick(meta, [
      "provider_response.raw.status_url",
      "provider_response.status_url",
      "provider_response.raw.response_url",
      "provider_response.response_url",
      "status_url",
      "response_url",
      "fal.status_url",
      "fal.response_url",
      "raw.status_url",
      "raw.response_url",
    ]) || null
  );
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const q = req.query || {};
    const b = req.body || {};
    const app = "photofx";

    let status_url = String(
      q.status_url ||
        b.status_url ||
        q.response_url ||
        b.response_url ||
        ""
    ).trim();

    const job_id = String(q.job_id || b.job_id || "").trim();

    if (!status_url && job_id) {
      status_url = (await resolveStatusUrlFromDB(job_id)) || "";
    }

    if (!status_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_status_url",
        hint: "status_url or job_id is required",
      });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({
        ok: false,
        error: "missing_fal_key",
      });
    }

    const r = await fetch(status_url, {
      method: "GET",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        Accept: "application/json",
      },
    });

    const text = await r.text().catch(() => "");
    let fal;
    try {
      fal = text ? JSON.parse(text) : {};
    } catch {
      fal = { raw: text };
    }

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

    const rawStatus =
      pick(fal, [
        "status",
        "state",
        "data.status",
        "data.state",
        "result.status",
        "result.state",
      ]) || null;

    const video_url = extractVideoUrl(fal);
    const status = normalizeStatus(rawStatus, video_url);

    const outputs = video_url
      ? [{ type: "video", url: video_url, meta: { app } }]
      : [];

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      status,
      video_url: video_url || null,
      outputs,
      fal,
      status_url,
      job_id: job_id || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
}
