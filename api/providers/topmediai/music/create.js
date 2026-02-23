// api/providers/topmediai/music/create.js
// TopMediai v3 generate
// Beklenen cevap (senin network ekranına göre):
// {
//   success: true,
//   data: {
//     tracks: [{ id, title }, { id, title }],
//     taskId: "...",
//     status: "processing",
//     ...
//   }
// }
//
// Bizim standard output:
// { ok, provider, provider_job_id: taskId, provider_song_ids:[trackId...], status/state }

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

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // ✅ ULTRA MINIMAL payload (TopMediai'nin çalıştığı en basit)
    // Not: lyrics/title şu an payload'a konmuyor (istersen sonra ekleriz)
    const payload = { action: "auto", prompt };

    // ---------------------------------------------------------
    // ✅ PROBE MODE (endpoint denemek için)
    // ?probe=1&path=/v3/music/generate
    // ---------------------------------------------------------
    const isProbe = String(req.query?.probe || "") === "1";
    const rawPath = String(req.query?.path || "").trim();

    let endpointPath = "/v3/music/generate";
    if (isProbe && rawPath) {
      if (rawPath.startsWith("/v3/")) endpointPath = rawPath;
    }

    const topmediaiUrl = `https://api.topmediai.com${endpointPath}`;

    // 🔒 HARD TIMEOUT
    const controller = new AbortController();
    const HARD_TIMEOUT_MS = Number(process.env.TOPMEDIAI_SUBMIT_TIMEOUT_MS || 25000);

    const timeout = setTimeout(() => {
      try { controller.abort("topmediai_submit_timeout"); } catch {}
    }, HARD_TIMEOUT_MS);

    let r;
    try {
      r = await fetch(topmediaiUrl, {
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
        // submit timeout olsa bile UI poll devam edebilsin diye 202 dönüyoruz
        return res.status(202).json({
          ok: true,
          provider: "topmediai",
          status: "processing",
          state: "processing",
          note: "submit_timeout",
          topmediai: { url: topmediaiUrl },
          sent_payload: payload,
          input: { title, has_lyrics: Boolean(lyrics) },
        });
      }

      return res.status(500).json({
        ok: false,
        error: "topmediai_submit_fetch_failed",
        detail: msg,
        topmediai: { url: topmediaiUrl },
        sent_payload: payload,
        input: { title, has_lyrics: Boolean(lyrics) },
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await r.text();
    const data = (() => { try { return JSON.parse(rawText); } catch { return null; } })();

    // Probe mod: her şeyi geri dök
    if (isProbe) {
      return res.status(200).json({
        ok: true,
        probe: true,
        provider: "topmediai",
        topmediai: {
          url: topmediaiUrl,
          status: r.status,
          ok: r.ok,
          data: data ?? null,
          preview: data ? null : String(rawText || "").slice(0, 1200),
        },
        sent_payload: payload,
      });
    }

    // Response kötü ise
    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_create_failed",
        topmediai_status: r.status,
        topmediai_url: topmediaiUrl,
        topmediai_preview: String(rawText || "").slice(0, 1200),
        topmediai_response: data,
        sent_payload: payload,
        input: { title, has_lyrics: Boolean(lyrics) },
      });
    }

    // ✅ TopMediai gerçek cevap: taskId + tracks[]
    const tracks =
      Array.isArray(data?.data?.tracks) ? data.data.tracks :
      Array.isArray(data?.tracks) ? data.tracks :
      [];

    const provider_song_ids = tracks
      .map((t) => String(t?.id || "").trim())
      .filter(Boolean);

    const taskId =
      data?.data?.taskId || data?.taskId ||
      data?.data?.task_id || data?.task_id ||
      null;

    if (!taskId) {
      return res.status(202).json({
        ok: true,
        provider: "topmediai",
        status: "processing",
        state: "processing",
        note: "missing_taskId_in_generate_response",
        topmediai: data,
        topmediai_url: topmediaiUrl,
        sent_payload: payload,
        input: { title, has_lyrics: Boolean(lyrics) },
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id: String(taskId),      // ✅ poll bununla (taskId)
      provider_song_ids,                    // ✅ 2 track id burada
      status: "processing",
      state: "processing",
      topmediai: data,
      topmediai_url: topmediaiUrl,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
