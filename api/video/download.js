// pages/api/video/download.js
import { Readable } from "node:stream";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "missing_job_id" });

    // ✅ same-origin üret (prod/dev uyumlu)
    const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
    const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
    const origin = `${proto}://${host}`;

    // 1) job status'tan mp4 signed url çek
    const stRes = await fetch(`${origin}/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, {
      method: "GET",
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
      stJson?.outputs?.find?.((o) => (o?.type || "").toLowerCase() === "video")?.url ||
      null;

    if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      return res.status(404).json({ ok: false, error: "video_not_ready", job_id });
    }

    // 2) video'yu fetch edip kullanıcıya stream et (forced download)
    const vRes = await fetch(videoUrl, { method: "GET" });
    if (!vRes.ok || !vRes.body) {
      return res.status(vRes.status || 502).json({
        ok: false,
        error: "video_fetch_failed",
        status: vRes.status,
      });
    }

    // filename (istersen daha sonra prompt/title'dan üretirsin)
    const filename = `aivo-video-${job_id}.mp4`;

    res.statusCode = 200;
    res.setHeader("Content-Type", vRes.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const len = vRes.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);

    // Node 18+ : Web stream -> Node stream
    const nodeStream = Readable.fromWeb(vRes.body);
    nodeStream.on("error", () => {
      try { res.end(); } catch {}
    });
    nodeStream.pipe(res);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
