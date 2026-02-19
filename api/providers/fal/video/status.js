// /api/providers/fal/video/status.js  (CommonJS)
// Fix: endpoint ASLA encode edilmez. Sadece request_id encode edilir.
// Fix: Fal queue status endpoint'i POST istiyor.
// Fix: pro/standard mismatch -> önce pro dene, video_url yoksa standard dene
// Fix: UI/import için normalize: status + outputs + video_url

module.exports = async function handler(req, res) {
  try {
    const request_id = (req.query.request_id || req.body?.request_id || "").toString().trim();
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    const app = (req.query.app || req.body?.app || "").toString().trim();

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const candidateEndpoints = [
      "fal-ai/kling-video/v3/pro/text-to-video",
      "fal-ai/kling-video/v3/standard/text-to-video",
    ];

    async function fetchStatus(endpoint) {
      const base = `https://queue.fal.run/${endpoint.replace(/^\/+/, "")}`;
      const url = `${base}/requests/${encodeURIComponent(request_id)}/status`;

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({}),
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      return { ok: r.ok, http_status: r.status, endpoint, url, data };
    }

    // 1) pro dene
    const attempts = [];
    let best = await fetchStatus(candidateEndpoints[0]);
    attempts.push(best);

    // 2) video_url yoksa (veya pro fail ise) standard dene
    const proVideoUrl = best?.data?.video?.url || best?.data?.output?.video?.url || null;
    if (!best.ok || !proVideoUrl) {
      const alt = await fetchStatus(candidateEndpoints[1]);
      attempts.push(alt);

      const altVideoUrl = alt?.data?.video?.url || alt?.data?.output?.video?.url || null;

      // Hangisi daha "iyi"? Öncelik: ok + video_url olan
      const bestCandidate =
        (alt.ok && altVideoUrl) ? alt :
        (best.ok && proVideoUrl) ? best :
        (alt.ok) ? alt :
        best;

      best = bestCandidate;
    }

    if (!best.ok) {
      return res.status(200).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: best.http_status,
        endpoint: best.endpoint,
        request_id,
        raw_status: best.data,
        app,
        debug_url: best.url,
        attempts: attempts.map(a => ({
          endpoint: a.endpoint,
          http_status: a.http_status,
          ok: a.ok,
          debug_url: a.url,
        })),
      });
    }

    const fal = best.data || {};
    const statusRaw =
      fal?.status ??
      fal?.data?.status ??
      fal?.result?.status ??
      fal?.state ??
      null;

    const video_url =
      fal?.video?.url ||
      fal?.output?.video?.url ||
      fal?.outputs?.[0]?.url ||
      null;

    const statusNorm = (statusRaw ? String(statusRaw).toUpperCase() : (video_url ? "COMPLETED" : "UNKNOWN"));

    const outputs = video_url
      ? [{ type: "video", url: video_url, meta: { app: app || "atmo" } }]
      : [];

    return res.status(200).json({
      ok: true,
      provider: "fal",
      endpoint: best.endpoint,
      request_id,
      app,
      status: statusNorm,   // ✅ import için kritik
      video_url,
      outputs,              // ✅ PPE/import için hazır
      fal,                  // raw
      attempts: attempts.map(a => ({
        endpoint: a.endpoint,
        http_status: a.http_status,
        ok: a.ok,
        debug_url: a.url,
      })),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
};
