export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // Süper Mod default: 8 sn
    const { prompt, duration = 8, aspect_ratio = "9:16" } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    // ✅ Kling 3.0 PRO Text-to-Video (Süper Mod)
    const falUrl =
      "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

    // ✅ Timeout (queue create hızlı olmalı)
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000); // 30 saniye

    let r;
    try {
      r = await fetch(falUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          duration,
          aspect_ratio,
          generate_audio: true, // ✅ Süper Mod default WOW
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(t);
      return res.status(504).json({
        ok: false,
        provider: "fal",
        error: "fal_timeout_or_network_error",
        message: e?.message || "unknown_fetch_error",
      });
    }

    clearTimeout(t);

    // fal bazen JSON dönmezse diye güvenli parse
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
        error: "fal_error",
        fal_status: r.status,
        fal_response: data,
      });
    }

    // Queue response'tan request_id yakala
    const request_id =
      data?.request_id || data?.requestId || data?.id || data?._id || null;

    if (!request_id) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "missing_request_id",
        fal_response: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      model: "fal-ai/kling-video/v3/pro/text-to-video",
      request_id,
      status: data?.status || "queued",
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
