// api/providers/topmediai/music/generate-wav.js
// TopMediai v3 convert to WAV wrapper
// Input: { provider_song_id }  OR query: ?provider_song_id=...
// Output: wav task response + (varsa) wav download proxy URL

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    const body = req.body || {};
    const provider_song_id = String(
      (req.method === "GET" ? req.query?.provider_song_id : body?.provider_song_id) || ""
    ).trim();

    if (!provider_song_id) {
      return res.status(400).json({ ok: false, error: "missing_provider_song_id" });
    }

    // TopMediai: POST /v3/music/generate-wav
    // Docs: "Convert an existing music track to high-quality WAV format"
    const url = "https://api.topmediai.com/v3/music/generate-wav";

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": KEY,
      },
      body: JSON.stringify({
        song_id: provider_song_id,
      }),
    });

    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_generate_wav_failed",
        topmediai_status: r.status,
        topmediai_preview: String(raw || "").slice(0, 1200),
        topmediai_response: data,
      });
    }

    // Bazı shape’lerde wav url direkt gelebilir; gelmezse taskId ile status’tan takip edilir.
    const wavUrl =
      data?.data?.wav_url ||
      data?.data?.wavUrl ||
      data?.wav_url ||
      data?.wavUrl ||
      null;

    const wav_proxy_url = wavUrl
      ? `/api/media/proxy?url=${encodeURIComponent(String(wavUrl))}&filename=${encodeURIComponent("track.wav")}`
      : null;

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_song_id,
      topmediai: data,
      wav_url: wavUrl ? String(wavUrl) : null,
      wav_proxy_url,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
