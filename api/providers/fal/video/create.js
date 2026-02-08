export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { prompt, duration = 5, aspect_ratio = "9:16" } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const falUrl = "https://fal.run/fal-ai/kling-video/v3/standard/text-to-video";

    // ✅ Timeout (çok kritik)
    const ctrl = new AbortController();
   const t = setTimeout(() => ctrl.abort(), 180000); // 3 dakika


    let r;
    try {
      r = await fetch(falUrl, {
        method: "POST",
        headers: {
          "Authorization": `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          duration,
          aspect_ratio,
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

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_error",
        fal_status: r.status,
        fal_response: data,
      });
    }

    const video_url = data?.video?.url || null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      model: "kling",
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
