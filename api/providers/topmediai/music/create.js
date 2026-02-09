export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    // panel.music / studio.music.generate tarafından gelebilecek payload
    const body = req.body || {};
    const title = String(body.title || "AIVO Music").slice(0, 80);
    const prompt = String(body.prompt || body?.input?.prompt || "").trim();
    const lyrics = String(body.lyrics || "").trim();
    const instrumental = body.instrumental ? 1 : 0;

    if (!prompt && !lyrics) {
      return res.status(400).json({ ok: false, error: "missing_prompt_or_lyrics" });
    }

    // TopMediai submit payload (doc'lara göre uyarladık)
    const payload = {
      is_auto: 1,
      model_version: body.model_version || "v3.5",
      prompt: prompt || "Create a song based on provided lyrics",
      lyrics: lyrics || "",
      title,
      instrumental,
      continue_at: 0,
      continue_song_id: ""
    };

    const r = await fetch("https://api.topmediai.com/v2/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_create_failed",
        topmediai_status: r.status,
        topmediai_response: data,
      });
    }

    // TopMediai genelde song_id döndürüyor
    const songId =
      data?.song_id ||
      data?.data?.song_id ||
      data?.result?.song_id ||
      data?.id ||
      null;

    if (!songId) {
      return res.status(500).json({
        ok: false,
        error: "missing_song_id",
        topmediai_response: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      job_id: String(songId),       // AIVO tarafında job_id olarak kullanacağız
      status: "processing",
      topmediai: data,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err.message,
    });
  }
}
