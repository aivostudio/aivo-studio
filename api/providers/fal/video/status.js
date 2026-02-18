// /pages/api/providers/fal/video/status.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const { request_id, app, endpoint_id } = req.query || {};
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    // ✅ IMPORTANT: Status URL must match the SAME queue endpoint used at create time.
    // Prefer explicit endpoint_id from query (recommended).
    // Fallback mapping by app (safe default for atmo = Kling v3 Pro text-to-video).
    const endpoint =
      (typeof endpoint_id === "string" && endpoint_id.trim()) ||
      (app === "atmo"
        ? "fal-ai/kling-video/v3/pro/text-to-video"
        : "fal-ai/kling-video/v3/pro/text-to-video");

    const base = `https://queue.fal.run/${endpoint}/requests/${encodeURIComponent(
      request_id
    )}`;

    // 1) status
    const statusRes = await fetch(`${base}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });

    const statusText = await statusRes.text();
    let statusData = null;
    try {
      statusData = statusText ? JSON.parse(statusText) : null;
    } catch {
      statusData = { _non_json: statusText };
    }

    if (!statusRes.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: statusRes.status,
        endpoint,
        fal_response: statusData,
      });
    }

    const status = statusData?.status || null;

    // 2) if completed, fetch full response for output url
    let video_url = null;
    let responseData = null;

    if (status === "COMPLETED") {
      const responseRes = await fetch(base, {
        method: "GET",
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });

      const responseText = await responseRes.text();
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = { _non_json: responseText };
      }

      // Kling outputs vary by schema; try common paths
      video_url =
        responseData?.response?.video?.url ||
        responseData?.response?.output?.video?.url ||
        responseData?.response?.output?.url ||
        responseData?.video?.url ||
        responseData?.output?.video?.url ||
        responseData?.output?.url ||
        null;
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      endpoint,
      request_id,
      status,
      video_url,
      raw_status: statusData,
      raw_response: responseData,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
}
