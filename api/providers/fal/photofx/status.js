export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/photofx/status.js

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
      "result.video.url",
      "result.output.video.url",
    ]) || null;

  if (direct && String(direct).startsWith("http")) return direct;

  if (Array.isArray(anyJson.outputs)) {
    const hit = anyJson.outputs.find(
      (x) => x?.url && String(x.url).startsWith("http")
    );
    if (hit) return hit.url;
  }

  return null;
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const q = req.query || {};
    const b = req.body || {};

    const app = "photofx";

    const status_url = String(
      q.status_url || b.status_url || ""
    ).trim();

    if (!status_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_status_url",
      });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    // 🔥 Fal status çek
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

    // ❗ 404 → FAILED (poll dursun)
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
      pick(fal, ["status", "data.status", "result.status", "state"]) || null;

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
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
}
