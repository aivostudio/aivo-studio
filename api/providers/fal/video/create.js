export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/video/create.js
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};

    const {
      app = "atmo",
      prompt,
      duration = 5,
      aspect_ratio = "9:16",
      generate_audio = true,
      shot_type = "customize",
      negative_prompt = "blur, distort, and low quality",
      cfg_scale = 0.5,
      multi_prompt = null,
      voice_ids = null,
    } = body;

    if (!prompt && !multi_prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const falUrl = "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);

    let r;
    try {
      r = await fetch(falUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(multi_prompt ? { multi_prompt } : { prompt }),
          duration,
          aspect_ratio,
          generate_audio,
          shot_type,
          negative_prompt,
          cfg_scale,
          ...(Array.isArray(voice_ids) ? { voice_ids } : {}),
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

    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
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

    const request_id =
      data?.request_id || data?.requestId || data?.id || data?._id || null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      model: "fal-ai/kling-video/v3/pro/text-to-video",
      request_id,
      status: data?.status || "IN_QUEUE",
      raw: data,
    });
  } catch (e) {
    console.error("[fal.video.create] crashed:", e);
    return res.status(500).json({
      ok: false,
      error: "internal_error",
      message: String(e?.message || e),
    });
  }
}
