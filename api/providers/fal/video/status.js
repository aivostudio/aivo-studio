// /api/providers/fal/video/status.js  (CJS + endpoint encode FIX)
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "missing_fal_key" }));
    }

    const q = req.query || {};
    const request_id = q.request_id || q.requestId || q.id;
    if (!request_id) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "missing_request_id" }));
    }

    // default model (istersen query ile override)
    const endpoint = String(
      q.endpoint || "fal-ai/kling-video/v3/pro/text-to-video"
    ).replace(/^\/+/, "");

    // IMPORTANT: endpoint_id path param slash içeriyor => encode et
    const endpointEnc = encodeURIComponent(endpoint);
    const base = `https://queue.fal.run/${endpointEnc}`;

    const statusUrl = `${base}/requests/${encodeURIComponent(request_id)}/status`;

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${FAL_KEY}` },
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
      return res.end(
        JSON.stringify({
          ok: false,
          provider: "fal",
          error: "fal_status_error",
          fal_status: statusRes.status,
          endpoint,
          request_id,
          raw_status: statusData,
          debug_url: statusUrl,
        })
      );
    }

    const status =
      statusData?.status ||
      statusData?.data?.status ||
      statusData?.request?.status ||
      null;

    let video_url = null;
    let resultData = null;

    if (status === "COMPLETED") {
      const resultUrl = `${base}/requests/${encodeURIComponent(request_id)}`;

      const resultRes = await fetch(resultUrl, {
        method: "GET",
        headers: { Authorization: `Key ${FAL_KEY}` },
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

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        ok: true,
        provider: "fal",
        endpoint,
        request_id,
        status,
        video_url,
        raw_status: statusData,
        raw_result: resultData,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        ok: false,
        error: "server_error",
        message: err?.message || "unknown_error",
      })
    );
  }
};
