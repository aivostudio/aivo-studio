// ===============================================
// /pages/api/providers/fal/video/status.js  (FIXED - Kling v3 queue polling)
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

    // ✅ Kling v3 queue: status/result tek endpoint'ten okunur
    // DOĞRU: GET https://queue.fal.run/requests/{request_id}
    const url = `https://queue.fal.run/requests/${encodeURIComponent(
      String(request_id)
    )}`;

    const r = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });

    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { _non_json: text };
    }

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: r.status,
        request_id,
        raw: data,
      });
    }

    // Status alanı farklı yerlerde gelebiliyor
    const status =
      data?.status ||
      data?.data?.status ||
      data?.request?.status ||
      data?.request_status ||
      null;

    // ✅ Video URL varyasyonları (Kling v3 Pro’da genelde data.video.url)
    const video_url =
      data?.data?.video?.url ||
      data?.video?.url ||
      data?.output?.video?.url ||
      data?.output?.url ||
      data?.response?.data?.video?.url ||
      null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      request_id,
      status,
      video_url,
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
}
