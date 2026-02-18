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

    // ✅ PRO endpoint — create ile aynı olmalı
    const ENDPOINT = "fal-ai/kling-video/v3/pro/text-to-video";

    // 1️⃣ Queue status kontrol
    const statusUrl = `https://queue.fal.run/${ENDPOINT}/requests/${encodeURIComponent(
      request_id
    )}/status`;

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
      },
    });

    const statusText = await statusRes.text();

    let statusData = null;
    try {
      statusData = statusText ? JSON.parse(statusText) : null;
    } catch (e) {
      statusData = { _non_json: statusText };
    }

    if (!statusRes.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: statusRes.status,
        fal_response: statusData,
      });
    }

    const status = statusData?.status || null;

    let video_url = null;
    let responseData = null;

    // 2️⃣ Eğer tamamlandıysa sonucu çek
    if (status === "COMPLETED") {
      const responseUrl = `https://queue.fal.run/${ENDPOINT}/requests/${encodeURIComponent(
        request_id
      )}`;

      const responseRes = await fetch(responseUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
        },
      });

      const responseText = await responseRes.text();

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch (e) {
        responseData = { _non_json: responseText };
      }

      if (!responseRes.ok) {
        return res.status(500).json({
          ok: false,
          provider: "fal",
          error: "fal_result_error",
          fal_status: responseRes.status,
          fal_response: responseData,
        });
      }

      // ✅ PRO output schema
      video_url =
        responseData?.response?.video?.url ||
        responseData?.video?.url ||
        null;
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
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
