export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    const version = process.env.REPLICATE_VERSION_ID; // full hash id

    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_API_TOKEN" });
    }
    if (!version) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_VERSION_ID" });
    }

    const body = req.body || {};
    const input = body.input || { prompt: "a futuristic neon city at night" };

    // ✅ WAV (44.1k) default: only for audio-style inputs (stems/separation)
    // If model supports these fields, it will output WAV instead of MP3.
    const looksLikeAudioJob =
      !!input.audio ||
      !!input.audio_url ||
      !!input.audioUrl ||
      !!input.song_url ||
      !!input.songUrl ||
      !!input.file ||
      !!input.media_url ||
      !!input.mediaUrl;

    if (looksLikeAudioJob) {
      // prefer not to override if caller explicitly set something
      if (input.output_format == null) input.output_format = "wav";
      if (input.audio_format == null) input.audio_format = "wav";
      if (input.format == null) input.format = "wav";
      if (input.sample_rate == null) input.sample_rate = 44100;
      if (input.samplerate == null) input.samplerate = 44100;
    }

    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version, input }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        error: "replicate_create_failed",
        replicate_status: r.status,
        replicate_response: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "replicate",
      provider_job_id: data.id,
      status: data.status,
      output: data.output ?? null,
      replicate: data,
      sent_input: input, // debug: confirm wav params actually sent
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || String(err),
    });
  }
}
