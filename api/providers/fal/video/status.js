// ===============================================
// /api/providers/fal/video/status.js  (CJS FIX)
// Works in Vercel /api serverless (CommonJS)
// ===============================================
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.statusCode = 405;
      return res.json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.FAL_KEY) {
      res.statusCode = 500;
      return res.json({ ok: false, error: "missing_fal_key" });
    }

    const request_id = (req.query?.request_id || "").toString().trim();
    if (!request_id) {
      res.statusCode = 400;
      return res.json({ ok: false, error: "missing_request_id" });
    }

    // 🔁 Basit/Süper motor seçimi:
    // - Süper: fal-ai/kling-video/v3/pro/text-to-video
    // - Basit: (senin seçeceğin) "Kling 3.0 Standard Text-to-Video" endpoint id'si
    // Not: endpoint'i create tarafında da aynen dönüp, burada query ile geçebilirsin.
    const endpoint = (req.query?.endpoint || "fal-ai/kling-video/v3/pro/text-to-video")
      .toString()
      .replace(/^\/+/, "")
      .trim();

    const base = `https://queue.fal.run/${endpoint}`;
    const statusUrl = `${base}/requests/${encodeURIComponent(request_id)}/status`;

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });

    const statusText = await statusRes.text();
    let statusData = null;
    try {
      statusData = statusText ? JSON.parse(statusText) : null;
    } catch (_) {
      statusData = { _non_json: statusText };
    }

    if (!statusRes.ok) {
      res.statusCode = 500;
      return res.json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: statusRes.status,
        endpoint,
        request_id,
        raw_status: statusData,
      });
    }

    const status =
      statusData?.status ||
      statusData?.data?.status ||
      statusData?.request?.status ||
      null;

    // COMPLETED olunca result'ı çek
    let video_url = null;
    let resultData = null;

    if (status === "COMPLETED") {
      const resultUrl = `${base}/requests/${encodeURIComponent(request_id)}`;

      const resultRes = await fetch(resultUrl, {
        method: "GET",
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });

      const resultText = await resultRes.text();
      try {
        resultData = resultText ? JSON.parse(resultText) : null;
      } catch (_) {
        resultData = { _non_json: resultText };
      }

      video_url =
        resultData?.data?.video?.url ||
        resultData?.video?.url ||
        resultData?.response?.video?.url ||
        resultData?.response?.output?.video?.url ||
        resultData?.response?.output?.url ||
        null;
    }

    res.statusCode = 200;
    return res.json({
      ok: true,
      provider: "fal",
      endpoint,
      request_id,
      status,
      video_url,
      raw_status: statusData,
      raw_result: resultData,
    });
  } catch (err) {
    res.statusCode = 500;
    return res.json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
};
