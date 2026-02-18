// /api/providers/fal/video/status.js  (CommonJS)
// Fix: endpoint ASLA encode edilmez. Sadece request_id encode edilir.
// Fix: Fal queue status endpoint'i POST istiyor.

module.exports = async function handler(req, res) {
  try {
    const request_id = (req.query.request_id || req.body?.request_id || "").toString().trim();
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    // app paramı opsiyonel; default "atmo" gibi düşünebilirsin
    const app = (req.query.app || req.body?.app || "").toString().trim();

    // Endpoint'i encode ETME.
    // İstersen app'e göre burada switch yaparsın (basic/pro). Şimdilik pro sabit:
    const endpoint = "fal-ai/kling-video/v3/pro/text-to-video";

    const base = `https://queue.fal.run/${endpoint.replace(/^\/+/, "")}`;
    const url = `${base}/requests/${encodeURIComponent(request_id)}/status`;

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      // Fal queue status POST'ta body zorunlu değil ama bazı edge'lerde iyi oluyor:
      body: JSON.stringify({}),
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: r.status,
        endpoint,
        request_id,
        raw_status: data,
        app,
        debug_url: url,
      });
    }

    // Kling output: { video: { url, ... } }  (senin screenshot'ta bu net)
    const video_url = data?.video?.url || data?.output?.video?.url || null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      endpoint,
      request_id,
      app,
      fal: data,
      video_url,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
};
