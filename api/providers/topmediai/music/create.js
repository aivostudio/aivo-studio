// api/providers/topmediai/music/create.js
// TopMediai v3 generate -> provider_song_ids (2 song_id)
// - Timeout olsa bile 202 döner (UI poll devam eder)
// - provider_song_ids her zaman string[] formatına çekilir
// - Response shape stabil: { ok, provider, provider_job_id?, provider_song_ids?, status, state?, ... }

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
    const prompt = String(body.prompt || body?.input?.prompt || body?.text || "").trim();
    const lyrics = String(body.lyrics || body?.input?.lyrics || "").trim(); // şimdilik log için tutuyoruz
    const title = String(body.title || "AIVO Music").slice(0, 80);          // şimdilik log için tutuyoruz

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // ✅ ULTRA MINIMAL v3 payload
    // TopMediai 500 veriyorsa en sık sebep "fazla alan" / "uyumsuz alan" oluyor.
    // Bu yüzden sadece discriminator + prompt gönderiyoruz.
    const payload = {
      action: "auto",
      prompt,
    };

    // 🔒 HARD TIMEOUT: Vercel 504 yerine 202 dön
    const controller = new AbortController();
    const HARD_TIMEOUT_MS = Number(process.env.TOPMEDIAI_SUBMIT_TIMEOUT_MS || 25000);

    const timeout = setTimeout(() => {
      try { controller.abort("topmediai_submit_timeout"); } catch {}
    }, HARD_TIMEOUT_MS);

    let r;
    try {
      r = await fetch("https://api.topmediai.com/v3/music/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
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
        return res.status(202).json({
          ok: true,
          provider: "topmediai",
          status: "processing",
          state: "processing",
          note: "submit_timeout",
          sent_payload: payload,
        });
      }

      return res.status(500).json({
        ok: false,
        error: "topmediai_submit_fetch_failed",
        detail: msg,
        sent_payload: payload,
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
        topmediai_preview: String(rawText || "").slice(0, 800),
        topmediai_response: data,
        sent_payload: payload,
        // observability (payload dışı inputlar)
        input: { title, has_lyrics: Boolean(lyrics) },
      });
    }

    // ✅ v3: 2 song_id bekliyoruz
    const songIdsRaw =
      data?.data?.song_ids ||
      data?.data?.songIds ||
      data?.song_ids ||
      data?.songIds ||
      data?.data?.ids ||
      data?.ids ||
      null;

    const songIds = Array.isArray(songIdsRaw)
      ? songIdsRaw.map((x) => String(x)).filter(Boolean)
      : [];

    if (songIds.length === 0) {
      return res.status(202).json({
        ok: true,
        provider: "topmediai",
        status: "processing",
        state: "processing",
        note: "missing_song_ids_in_v3_generate_response",
        topmediai: data,
        sent_payload: payload,
        input: { title, has_lyrics: Boolean(lyrics) },
      });
    }

    const providerJobId = songIds[0];

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id: String(providerJobId),
      provider_song_ids: songIds,
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
