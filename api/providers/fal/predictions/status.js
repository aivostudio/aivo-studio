// api/providers/fal/predictions/status.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const key = process.env.FAL_KEY;
    if (!key) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

  const request_id = String(req.query?.request_id || req.query?.requestId || "").trim();

    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    // ÖNEMLİ: fal app slug'ı (kling-video, flux, sdxl, vs)
    // Bunu create endpoint'lerinden (cover/atmos) "app" olarak geçirmen en temiz yol.
    const app = String(req.query?.app || "").trim();
    if (!app) {
      return res.status(400).json({ ok: false, error: "missing_app" });
    }

    // ✅ Doğru Fal endpoint ailesi
    const statusUrl = `https://queue.fal.run/fal-ai/${encodeURIComponent(
      app
    )}/requests/${encodeURIComponent(request_id)}/status`;

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${key}` },
    });

    const statusText = await statusRes.text();
    let statusData = null;
    try { statusData = statusText ? JSON.parse(statusText) : null; }
    catch { statusData = { _non_json: statusText }; }

    // fal tarafı error dönerse gerçek status code’u geçir (debug kolay)
    if (!statusRes.ok) {
      return res.status(statusRes.status).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        app,
        request_id,
        fal_status: statusRes.status,
        fal_response: statusData,
      });
    }

    const status = statusData?.status || statusData?.state || null;

    // completed ise detail endpointinden output çek
    let output = null;
    let responseData = null;

    const done = String(status || "").toUpperCase() === "COMPLETED";

    if (done) {
      const responseUrl = `https://queue.fal.run/fal-ai/${encodeURIComponent(
        app
      )}/requests/${encodeURIComponent(request_id)}`;

      const responseRes = await fetch(responseUrl, {
        method: "GET",
        headers: { Authorization: `Key ${key}` },
      });

      const responseText = await responseRes.text();
      try { responseData = responseText ? JSON.parse(responseText) : null; }
      catch { responseData = { _non_json: responseText }; }

      // Video / Image olasılıkları için "best-effort" url çıkarma:
      const url =
        responseData?.response?.video?.url ||
        responseData?.response?.image?.url ||
        responseData?.response?.images?.[0]?.url ||
        responseData?.response?.output?.video?.url ||
        responseData?.response?.output?.image?.url ||
        responseData?.response?.output?.url ||
        responseData?.video?.url ||
        responseData?.image?.url ||
        responseData?.images?.[0]?.url ||
        null;

      // tür tahmini (panel PPE.apply için işimize yarar)
      const kind =
        (responseData?.response?.video || responseData?.video) ? "video" :
        (responseData?.response?.image || responseData?.image || responseData?.response?.images || responseData?.images) ? "image" :
        null;

      output = { kind, url };
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      request_id,
      status,
      output,           // { kind: "video"|"image"|null, url }
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
