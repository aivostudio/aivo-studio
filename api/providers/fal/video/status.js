// ===============================================
// /api/providers/fal/video/status.js  (405 FIX)
// ===============================================
export default async function handler(req, res) {
  try {
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

    const endpoint =
      (req.query?.endpoint || "fal-ai/kling-video/v3/pro/text-to-video")
        .toString()
        .replace(/^\/+/, "");

    const base = `https://queue.fal.run/${endpoint}`;

    // ✅ 1) FIRST: read request (this works for Kling v3; status is inside)
    const reqUrl = `${base}/requests/${encodeURIComponent(request_id)}`;
    const reqRes = await fetch(reqUrl, {
      method: "GET",
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });

    const reqText = await reqRes.text();
    let reqData = null;
    try {
      reqData = reqText ? JSON.parse(reqText) : null;
    } catch (_) {
      reqData = { _non_json: reqText };
    }

    if (!reqRes.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_request_error",
        fal_status: reqRes.status,
        endpoint,
        request_id,
        raw_request: reqData,
      });
    }

    // status can appear in different places depending on model
    const status =
      reqData?.status ||
      reqData?.data?.status ||
      reqData?.request?.status ||
      reqData?.response?.status ||
      null;

    // Kling v3 output url variants
    const video_url =
      reqData?.data?.video?.url ||
      reqData?.video?.url ||
      reqData?.response?.video?.url ||
      reqData?.response?.output?.video?.url ||
      reqData?.response?.output?.url ||
      null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      endpoint,
      request_id,
      status,
      video_url,
      raw_request: reqData,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
}
