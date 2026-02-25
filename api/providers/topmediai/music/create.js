// api/providers/topmediai/music/create.js
// TopMediai v3 generate
// ✅ FIX: title/lyrics çalışması için action = "custom" olmalı (AutoGenerateRequest "auto" bunları ignore eder)

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res
        .status(500)
        .json({ ok: false, error: "missing_topmediai_api_key" });
    }

    const body = req.body || {};
    const prompt = String(body.prompt || body?.input?.prompt || body?.text || "")
      .trim();
    const lyrics = String(body.lyrics || body?.input?.lyrics || "").trim();
    const title = String(body.title || "").trim();

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // ✅ UI select’leri
    const vocalLabel = String(body.vocal || "").trim();
    const mood = String(body.mood || "").trim();

    const genderMap = {
      "Erkek Vokal (AI)": "male",
      "Kadın Vokal (AI)": "female",
      "Soft / Çocuk Vokal (AI)": "child",
    };

    const isInstrumental = vocalLabel === "Enstrümantal (Vokalsiz)";
    const gender = genderMap[vocalLabel] || undefined;

    // style = prompt (+ mood)
    const style = mood ? `${prompt}, mood: ${mood}` : prompt;

    // ✅ CRITICAL: title/lyrics doluysa action="custom" (CustomGenerateRequest)
    // Auto ("auto") title/lyrics’i çoğu durumda ignore eder.
    const hasLyricsOrTitle = (!!lyrics && lyrics.length > 0) || (!!title && title.length > 0);
    const action = hasLyricsOrTitle ? "custom" : "auto";

    // ✅ payload (TopMediai v3)
    // Not: instrumental=1 ise lyrics provider tarafından uygulanmaz (doküman).
    const payload = {
      action,           // "custom" | "auto"
      style,
   mv: "v5.0",
      instrumental: isInstrumental ? 1 : 0,
      gender,

      // sadece custom’ta anlamlı → yoksa hiç göndermiyoruz
      ...(action === "custom" ? { title: title || undefined } : null),
      ...(action === "custom" ? { lyrics: lyrics || undefined } : null),
    };

    const topmediaiUrl = "https://api.topmediai.com/v3/music/generate";

    // HARD TIMEOUT (avoid hanging requests)
    const controller = new AbortController();
    const HARD_TIMEOUT_MS = Number(
      process.env.TOPMEDIAI_SUBMIT_TIMEOUT_MS || 25000
    );

    const timeout = setTimeout(() => {
      try {
        controller.abort("topmediai_submit_timeout");
      } catch {}
    }, HARD_TIMEOUT_MS);

    let r;
    try {
      r = await fetch(topmediaiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
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
          state: "PROCESSING",
          note: "submit_timeout",
          topmediai_url: topmediaiUrl,
          sent_payload: payload,
        });
      }

      return res.status(500).json({
        ok: false,
        error: "topmediai_submit_fetch_failed",
        detail: msg,
        topmediai_url: topmediaiUrl,
        sent_payload: payload,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await r.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_create_failed",
        topmediai_status: r.status,
        topmediai_url: topmediaiUrl,
        topmediai_preview: String(rawText || "").slice(0, 1000),
        topmediai_response: data,
        sent_payload: payload,
      });
    }

    // ✅ Normalize IDs (support multiple response shapes)
    const tracks = Array.isArray(data?.data?.tracks) ? data.data.tracks : [];
    const trackIds = tracks
      .map((t) => String(t?.id || "").trim())
      .filter(Boolean);

    const idsRaw = data?.data?.ids || data?.data?.IDs || data?.ids || data?.IDs || null;
    const idsList = Array.isArray(idsRaw)
      ? idsRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    const songIdsRaw =
      data?.data?.song_ids ||
      data?.data?.songIds ||
      data?.song_ids ||
      data?.songIds ||
      null;

    const songIdsFallback = Array.isArray(songIdsRaw)
      ? songIdsRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    const provider_song_ids =
      trackIds.length ? trackIds : idsList.length ? idsList : songIdsFallback;

    if (!provider_song_ids.length) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_missing_ids",
        note: "no_tracks_ids_or_ids_or_song_ids_in_response",
        topmediai_url: topmediaiUrl,
        topmediai_response: data,
        sent_payload: payload,
      });
    }

    const provider_job_id = provider_song_ids[0];

    const taskId =
      data?.data?.taskId ||
      data?.data?.task_id ||
      data?.taskId ||
      data?.task_id ||
      null;

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      status: "processing",
      state: "PROCESSING",
      topmediai_task_id: taskId ? String(taskId) : null,
      topmediai: data,
      topmediai_url: topmediaiUrl,
      // debug: gerçekten custom mı gitti görelim
      sent_payload: payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
