// api/providers/topmediai/music/create.js
// TopMediai v3 generate
// POST https://api.topmediai.com/v3/music/generate
// returns 2 song ids (song_ids / songIds)
// We normalize => provider_song_ids: string[], provider_job_id: first id

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
    const lyrics = String(body.lyrics || body?.input?.lyrics || "").trim();
    const title = String(body.title || "AIVO Music").slice(0, 80);
    const model = String(body.model || body?.input?.model || "TopMediai Fast").trim(); // opsiyonel

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // TopMediai: minimal payload
    // NOT: TopMediai bazen extra alanları ignore ediyor, bozmaz.
    const payload = {
      action: "auto",
      prompt,
      ...(lyrics ? { lyrics } : {}),
      ...(title ? { title } : {}),
      ...(model ? { model } : {}),
    };

    const url = "https://api.topmediai.com/v3/music/generate";

    // Hard timeout (submit aşaması)
    const controller = new AbortController();
    const HARD_TIMEOUT_MS = Number(process.env.TOPMEDIAI_SUBMIT_TIMEOUT_MS || 25000);

    const timeout = setTimeout(() => {
      try { controller.abort("topmediai_submit_timeout"); } catch {}
    }, HARD_TIMEOUT_MS);

    let r;
    try {
      r = await fetch(url, {
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

      // Submit timeout olsa bile UI poll devam edebilsin diye 202 dönüyoruz.
      if (isAbort) {
        return res.status(202).json({
          ok: true,
          provider: "topmediai",
          status: "processing",
          state: "PROCESSING",
          note: "submit_timeout",
          topmediai_url: url,
          sent_payload: payload,
        });
      }

      return res.status(500).json({
        ok: false,
        error: "topmediai_submit_fetch_failed",
        detail: msg,
        topmediai_url: url,
        sent_payload: payload,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await r.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch { data = null; }

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_create_failed",
        topmediai_status: r.status,
        topmediai_url: url,
        topmediai_preview: String(rawText || "").slice(0, 800),
        topmediai_response: data,
        sent_payload: payload,
      });
    }

    // song ids normalize
    const songIdsRaw =
      data?.data?.song_ids ||
      data?.data?.songIds ||
      data?.song_ids ||
      data?.songIds ||
      data?.data?.ids ||
      data?.ids ||
      null;

    const provider_song_ids = Array.isArray(songIdsRaw)
      ? songIdsRaw.map((x) => String(x)).filter(Boolean)
      : [];

    if (provider_song_ids.length === 0) {
      // Bazı durumlarda hemen id dönmeyebilir → yine de processing dön
      return res.status(202).json({
        ok: true,
        provider: "topmediai",
        status: "processing",
        state: "PROCESSING",
        note: "missing_song_ids_in_generate_response",
        topmediai: data,
        topmediai_url: url,
        sent_payload: payload,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id: provider_song_ids[0],
      provider_song_ids,
      status: "processing",
      state: "PROCESSING",
      topmediai: data,
      topmediai_url: url,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
