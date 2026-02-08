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

   const url = `https://queue.fal.run/fal-ai/kling-video/requests/${encodeURIComponent(request_id)}/status`;

      request_id
    )}`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const text = await r.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { _non_json: text };
    }

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_error",
        fal_status: r.status,
        fal_response: data,
      });
    }

    const status = data?.status || null;

    // Kling response tamamlanınca genelde response içinde video.url olur
    const video_url =
      data?.response?.video?.url ||
      data?.response?.video_url ||
      data?.response?.output?.video?.url ||
      data?.response?.output?.url ||
      data?.video?.url ||
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
