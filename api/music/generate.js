// /api/music/status.js  (Vercel Serverless Function / Next.js pages/api)
// ✅ Amaç: Studio'nun çağırdığı /api/music/status?job_id=job_xxx 404 olmasın
// ✅ Worker'a proxy eder: <WORKER>/api/music/status?provider_job_id=job_xxx

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const jobId =
    (req.query.job_id ||
      req.query.provider_job_id ||
      req.query.jobId ||
      req.query.job ||
      "").toString().trim();

  if (!jobId) return res.status(400).json({ ok: false, error: "missing_job_id" });

  // ✅ Vercel ENV: ARCHIVE_WORKER_ORIGIN = https://aivo-archive-worker....workers.dev
  const workerOrigin = (process.env.ARCHIVE_WORKER_ORIGIN || "").trim().replace(/\/+$/, "");
  if (!workerOrigin) {
    return res.status(500).json({
      ok: false,
      error: "missing_ARCHIVE_WORKER_ORIGIN",
      need: ["ARCHIVE_WORKER_ORIGIN=https://<your-worker>.workers.dev"],
    });
  }

  const url = `${workerOrigin}/api/music/status?provider_job_id=${encodeURIComponent(jobId)}`;

  try {
    const r = await fetch(url, { method: "GET" });

    // Body'yi text olarak alıp aynen geçiriyoruz (worker JSON döndürüyor)
    const text = await r.text();

    res.status(r.status);
    res.setHeader("content-type", r.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");

    return res.send(text);
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: "worker_proxy_failed",
      detail: String(e?.message || e),
      worker_url: url,
    });
  }
}
