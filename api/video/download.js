// pages/api/video/download.js
import { Readable } from "node:stream";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    // same-origin status fetch (prod/dev uyumlu)
    const proto = (req.headers["x-forwarded-proto"] || "https")
      .toString()
      .split(",")[0]
      .trim();

    const host = (req.headers["x-forwarded-host"] || req.headers.host || "aivo.tr")
      .toString()
      .split(",")[0]
      .trim();

    const origin = `${proto}://${host}`;

    const stRes = await fetch(
      `${origin}/api/jobs/status?job_id=${encodeURIComponent(job_id)}`,
      { headers: { Accept: "application/json" } }
    );

    const stJson = await stRes.json().catch(() => null);

    if (!stRes.ok || !stJson?.ok) {
      return res.status(stRes.status || 500).json({
        ok: false,
        error: "job_status_failed",
        details: stJson,
      });
    }

    const videoUrl =
      stJson?.video?.url ||
      stJson?.outputs?.find((o) => (o?.type || "").toLowerCase() === "video")?.url ||
      null;

    if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      return res.status(404).json({ ok: false, error: "video_not_ready", job_id });
    }

    // MP4 fetch (signed url olabilir, redirect olabilir)
    const vRes = await fetch(videoUrl, {
      method: "GET",
      redirect: "follow",
    });

    if (!vRes.ok || !vRes.body) {
      return res.status(vRes.status || 502).json({
        ok: false,
        error: "video_fetch_failed",
        status: vRes.status,
      });
    }

    const filename = `aivo-video-${job_id}.mp4`;

    res.setHeader("Content-Type", vRes.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const len = vRes.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);

    // stream
    Readable.fromWeb(vRes.body).pipe(res);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}
