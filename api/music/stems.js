// /api/music/stems.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_API_TOKEN" });
    }

    const body = req.body || {};
    const predictionId = String(body.prediction_id || body.id || "").trim();
    const audioUrl = String(body.audio_url || body.audio || "").trim();

    // ---- (B) Status / poll ----
    if (predictionId) {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`, {
        method: "GET",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
      });

      const j = await r.json().catch(() => null);
      if (!r.ok) {
        return res.status(r.status).json({
          ok: false,
          error: "replicate_status_failed",
          status: r.status,
          detail: j,
        });
      }

      // output -> { vocals, drums, bass, other, guitar, piano } (model_name: htdemucs_6s)
      return res.status(200).json({
        ok: true,
        mode: "status",
        id: j?.id,
        status: j?.status,
        output: j?.output || null,
        error: j?.error || null,
        logs: j?.logs || null,
      });
    }

    // ---- (A) Create ----
    if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_audio_url" });
    }

    // ✅ cjwbw/demucs (version hash stable; model_name picks htdemucs_6s)
    // Source: Replicate model API examples + README list includes htdemucs_6s
    const DEMUCS_VERSION = "25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953";

    const payload = {
      version: DEMUCS_VERSION,
      input: {
        audio: audioUrl,
        model_name: "htdemucs_6s",
        output_format: "mp3",
        mp3_bitrate: 320,
        overlap: 0.25,
        shifts: 1,
        clip_mode: "rescale",
      },
    };

    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "replicate_create_failed",
        status: r.status,
        detail: j,
      });
    }

    return res.status(200).json({
      ok: true,
      mode: "create",
      id: j?.id,
      status: j?.status,
      // NOTE: client poll için lazım
      urls: j?.urls || null,
    });
catch (err) {
  return res.status(200).json({
    ok: false,
    error: "server_error",
    message: err?.message || String(err),
  });
}
}
