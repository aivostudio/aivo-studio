// ===============================================
// /api/providers/fal/video/status.js  (FIXED+)
// ===============================================
export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const { request_id } = req.query || {};
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    const app = (req.query?.app || "video").toString();

    // ✅ Whitelist (güvenli) — override istiyorsan sadece buraya ekle
    const allowed = new Set([
      "fal-ai/kling-video/v3/pro/text-to-video",
      "fal-ai/kling-video/v3/standard/text-to-video",
    ]);

    const endpointRaw = (req.query?.endpoint || "fal-ai/kling-video/v3/pro/text-to-video")
      .toString()
      .replace(/^\/+/, "");

    const endpoint = allowed.has(endpointRaw)
      ? endpointRaw
      : "fal-ai/kling-video/v3/pro/text-to-video";

    const base = `https://queue.fal.run/${endpoint}`;
    const statusUrl = `${base}/requests/${encodeURIComponent(request_id)}/status`;

    // timeout
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      signal: ctrl.signal,
    }).catch((e) => {
      throw new Error(`fal_status_fetch_failed: ${e?.message || e}`);
    });

    clearTimeout(t);

    const statusText = await statusRes.text();
    let statusData = null;
    try {
      statusData = statusText ? JSON.parse(statusText) : null;
    } catch (_) {
      statusData = { _non_json: statusText };
    }

    // ✅ request yoksa: 404 döndür (debug için altın)
    if (statusRes.status === 404) {
      return res.status(404).json({
        ok: false,
        provider: "fal",
        error: "request_not_found",
        endpoint,
        request_id,
        raw_status: statusData,
      });
    }

    if (!statusRes.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: statusRes.status,
        endpoint,
        request_id,
        raw_status: statusData,
      });
    }

    // ✅ status normalize
    const rawStatus =
      statusData?.status ||
      statusData?.data?.status ||
      statusData?.request?.status ||
      null;

    const status = rawStatus ? String(rawStatus).toUpperCase() : null;

    // Completed olunca result'ı çek
    let video_url = null;
    let resultData = null;

    if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
      const resultUrl = `${base}/requests/${encodeURIComponent(request_id)}`;

      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 20000);

      const resultRes = await fetch(resultUrl, {
        method: "GET",
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
        signal: ctrl2.signal,
      }).catch((e) => {
        throw new Error(`fal_result_fetch_failed: ${e?.message || e}`);
      });

      clearTimeout(t2);

      const resultText = await resultRes.text();
      try {
        resultData = resultText ? JSON.parse(resultText) : null;
      } catch (_) {
        resultData = { _non_json: resultText };
      }

      // Kling v3 result varyasyonları
      video_url =
        resultData?.data?.video?.url ||
        resultData?.video?.url ||
        resultData?.response?.video?.url ||
        resultData?.response?.output?.video?.url ||
        resultData?.response?.output?.url ||
        null;
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      endpoint,
      request_id,
      status,
      video_url,
      raw_status: statusData,
      raw_result: resultData,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
}
