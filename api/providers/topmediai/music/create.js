export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    const body = req.body || {};
    const title = String(body.title || "AIVO Music").slice(0, 80);
    const prompt = String(body.prompt || body?.input?.prompt || "").trim();
    const lyrics = String(body.lyrics || "").trim();
    const instrumental = body.instrumental ? 1 : 0;

    if (!prompt && !lyrics) {
      return res.status(400).json({ ok: false, error: "missing_prompt_or_lyrics" });
    }

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

    // 🔒 HARD TIMEOUT (Vercel 504 yerine 202 döndürmek için)
    const controller = new AbortController();
    const HARD_TIMEOUT_MS = 9000;
    const timeout = setTimeout(() => controller.abort("topmediai_submit_timeout"), HARD_TIMEOUT_MS);

    let r;
    try {
      r = await fetch("https://api.topmediai.com/v2/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": KEY,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      // ✅ Asla 504 dönme: UI polling devam etsin
      const isAbort =
        err?.name === "AbortError" ||
        String(err?.message || "").toLowerCase().includes("abort") ||
        String(err).toLowerCase().includes("timeout");

      if (isAbort) {
        return res.status(202).json({
          ok: true,
          provider: "topmediai",
          status: "processing",
          note: "submit_timeout",
        });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // TopMediai cevap verdiyse normal akış
    const data = await r.json().catch(() => null);

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_create_failed",
        topmediai_status: r.status,
        topmediai_response: data,
      });
    }

    const songId =
      data?.song_id ||
      data?.data?.song_id ||
      data?.result?.song_id ||
      data?.id ||
      null;

    // song_id yoksa bile 504 yerine 202 (processing) dön: status ile yakalanabilir
    if (!songId) {
      return res.status(202).json({
        ok: true,
        provider: "topmediai",
        status: "processing",
        note: "missing_song_id_in_submit_response",
        topmediai: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id: String(songId),
      status: "processing",
      topmediai: data,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
