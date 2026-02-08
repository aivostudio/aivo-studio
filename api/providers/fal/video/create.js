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

    // fal.ai endpoint (Kling / text-to-video)
  const falUrl = "https://fal.run/fal-ai/kling-video/v3/standard/text-to-video";


    const r = await fetch(falUrl, {
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
    });

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

    // fal response içinde video url genelde output.url veya output[0] gibi gelir
    const video_url =
      data?.video?.url ||
      data?.output?.url ||
      data?.output?.[0]?.url ||
      data?.output?.[0] ||
      null;

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
