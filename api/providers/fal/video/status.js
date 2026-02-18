// /api/providers/fal/video/status.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const { request_id, endpoint_id, app } = req.query || {};
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    // Default: Atmosfer Video için "en iyi" olarak Kling v3 PRO Text-to-Video
    // İstersen çağrıda endpoint_id=... gönderip override edebilirsin.
    const defaultEndpointId = "fal-ai/kling-video/v3/pro/text-to-video";

    // app bazlı default seçmek istersen:
    // - atmo => pro text-to-video (wow)
    // - başka yerlerde istersen standard’a düşebilirsin
    const chosenEndpointId =
      endpoint_id ||
      (app === "atmo" ? defaultEndpointId : defaultEndpointId);

    const encEndpoint = encodeURIComponent(chosenEndpointId);
    const encRid = encodeURIComponent(request_id);

    // Queue status endpoint (OpenAPI: /{endpoint_id}/requests/{request_id}/status)
    const statusUrl = `https://queue.fal.run/${encEndpoint}/requests/${encRid}/status?logs=0`;

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
        endpoint_id: chosenEndpointId,
        request_id,
        fal_response: statusData,
      });
    }

    const status = statusData?.status || null;

    // COMPLETED olunca sonucu çek
    let video_url = null;
    let responseData = null;

    if (status === "COMPLETED") {
      // Queue result endpoint (OpenAPI: /{endpoint_id}/requests/{request_id})
      const responseUrl = `https://queue.fal.run/${encEndpoint}/requests/${encRid}`;

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

      // Kling çıktıları farklı şemalarda gelebiliyor: olabildiğince toleranslı al
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
      endpoint_id: chosenEndpointId,
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
