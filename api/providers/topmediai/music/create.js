// api/providers/topmediai/music/create.js
// TopMediai submit -> provider_job_id (song_id)
// - Timeout olsa bile 202 döner (UI poll devam eder)
// - provider_job_id her zaman string formatına çekilir
// - Response shape stabil: { ok, provider, provider_job_id?, status, state?, ... }

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

    const prompt = String(body.prompt || body?.input?.prompt || body?.text || "").trim();
    const lyrics = String(body.lyrics || body?.input?.lyrics || "").trim();
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

    // 🔒 HARD TIMEOUT: Vercel 504 yerine 202 dön
    const controller = new AbortController();
    const HARD_TIMEOUT_MS = Number(process.env.TOPMEDIAI_SUBMIT_TIMEOUT_MS || 25000);

    const timeout = setTimeout(() => {
      try { controller.abort("topmediai_submit_timeout"); } catch {}
    }, HARD_TIMEOUT_MS);

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
      const msg = String(err?.message || err || "");
      const isAbort =
        err?.name === "AbortError" ||
        msg.toLowerCase().includes("abort") ||
        msg.toLowerCase().includes("timeout");

      if (isAbort) {
        // ✅ UI polling devam etsin: 202 + stabil shape
        return res.status(202).json({
          ok: true,
          provider: "topmediai",
          status: "processing",
          state: "processing",
          note: "submit_timeout",
        });
      }

      // gerçek hata
      return res.status(500).json({
        ok: false,
        error: "topmediai_submit_fetch_failed",
        detail: msg,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await r.text();
    const data = (() => { try { return JSON.parse(rawText); } catch { return null; } })();

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_create_failed",
        topmediai_status: r.status,
        topmediai_preview: String(rawText || "").slice(0, 400),
        topmediai_response: data,
      });
    }

    const songId =
      data?.song_id ||
      data?.data?.song_id ||
      data?.result?.song_id ||
      data?.id ||
      null;

    if (!songId) {
      // song_id yoksa bile 202 (processing) dön: status ile yakalanabilir
      return res.status(202).json({
        ok: true,
        provider: "topmediai",
        status: "processing",
        state: "processing",
        note: "missing_song_id_in_submit_response",
        topmediai: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id: String(songId),
      status: "processing",
      state: "processing",
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
