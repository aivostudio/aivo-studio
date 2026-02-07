// api/music/status.js
// Vercel route: Worker'a proxy (R2 mapping + outputs logic Worker'da)
// ENV (opsiyonel): ARCHIVE_WORKER_ORIGIN=https://aivo-archive-worker.aivostudioapp.workers.dev

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  // Build doğrulama header'ı (Network -> Response Headers)
  res.setHeader("x-aivo-status-build", "status-proxy-v3-forward-fix-2026-02-07");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // UI bazen job_id ile gelir (job_..., prov_music_...)
    // Bazı yerler provider_job_id/providerJobId gönderebilir, hepsini destekleyelim
    const raw = String(
      req.query.job_id ||
      req.query.provider_job_id ||
      req.query.providerJobId ||
      ""
    ).trim();

    if (!raw) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    // internal job id mi?
    const isInternal = raw.startsWith("job_");
    // provider id mi?
    const isProvider =
      raw.startsWith("prov_music_") ||
      raw.startsWith("prov_") ||
      raw.startsWith("provider_");

    // Eğer job_ ile başlıyorsa internal kabul et (provider pattern'e uymuyorsa)
    const qsKey = (isInternal && !isProvider) ? "job_id" : "provider_job_id";

    const workerOrigin =
      process.env.ARCHIVE_WORKER_ORIGIN ||
      "https://aivo-archive-worker.aivostudioapp.workers.dev";

    const url = `${workerOrigin}/api/music/status?${qsKey}=` + encodeURIComponent(raw);

    const r = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    const text = await r.text();
    const data = safeJsonParse(text);

    if (!data) {
      return res.status(200).json({
        ok: false,
        error: "worker_non_json",
        worker_status: r.status,
        sample: text.slice(0, 400),
        forwarded_as: qsKey,
        forwarded_id: raw,
      });
    }

    // Debug için forwarded bilgisi ekleyelim (UI bozmaz)
    if (data && typeof data === "object") {
      data.forwarded_as = qsKey;
      data.forwarded_id = raw;
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("api/music/status proxy error:", err);
    return res.status(200).json({
      ok: false,
      error: "proxy_error",
      state: "processing",
      status: "processing",
    });
  }
};
