// pages/api/video/download.js
import { Readable } from "node:stream";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "missing_job_id" });

    // same-origin status fetch (prod/dev uyumlu)
    const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
    const host  = (req.headers["x-forwarded-host"]  || req.headers.host || "").toString().split(",")[0].trim();
    const origin = `${proto}://${host}`;

    const stRes = await fetch(`${origin}/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, {
      headers: { Accept: "application/json" },
    });
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

    // MP4'ü çek ve kullanıcıya "attachment" olarak stream et
    const vRes = await fetch(videoUrl, { method: "GET" });
    if (!vRes.ok || !vRes.body) {
      return res.status(vRes.status || 502).json({ ok: false, error: "video_fetch_failed" });
    }

    const filename = `aivo-video-${job_id}.mp4`;

    res.setHeader("Content-Type", vRes.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    // bazı ortamlarda faydalı
    const len = vRes.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);

    Readable.fromWeb(vRes.body).pipe(res);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
