// api/music/status.js
// Vercel route: Worker'a proxy (R2 mapping + outputs logic Worker'da)
// ENV (opsiyonel): ARCHIVE_WORKER_ORIGIN=https://aivo-archive-worker.aivostudioapp.workers.dev

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  // Build doğrulama header'ı (Network -> Response Headers)
  res.setHeader("x-aivo-status-build", "status-topmediai-v1-2026-02-09");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // UI bazen job_id ile gelir (job_..., prov_music_...)
    // Bazı yerler provider_job_id/providerJobId gönderebilir, hepsini destekleyelim
    const raw = String(
      req.query.job_id ||
      req.query.provider_job_id ||
      req.query.providerJobId ||
      ""
    ).trim();

    if (!raw) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    // internal job id mi?
    const isInternal = raw.startsWith("job_");
    // provider id mi?
    const isProvider =
      raw.startsWith("prov_music_") ||
      raw.startsWith("prov_") ||
      raw.startsWith("provider_");

    // Eğer job_ ile başlıyorsa internal kabul et (provider pattern'e uymuyorsa)
    // (bu dosyada artık worker proxy yok; forward key debug için kalsın)
    const qsKey = (isInternal && !isProvider) ? "job_id" : "provider_job_id";

    // ✅ TopMediai key
    const TOPMEDIAI_API_KEY = process.env.TOPMEDIAI_API_KEY;
    if (!TOPMEDIAI_API_KEY) {
      return res.status(200).json({
        ok: false,
        error: "missing_topmediai_api_key",
        state: "processing",
        status: "processing",
      });
    }

    // ✅ TopMediai query: song_id ile sorgulanır
    // Not: raw internal job_id gelirse bu aşamada TopMediai'de karşılığı yoktur.
    // Biz yine de UI'ı bozmamak için "processing" döndürürüz.
    if (isInternal && !isProvider) {
      return res.status(200).json({
        ok: true,
        state: "processing",
        status: "processing",
        forwarded_as: qsKey,
        forwarded_id: raw,
        job: { status: "processing" },
      });
    }

    const url = `https://api.topmediai.com/v2/query?song_id=` + encodeURIComponent(raw);

    const r = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": TOPMEDIAI_API_KEY,
      },
    });

    const text = await r.text();
    const data = safeJsonParse(text);

    if (!data) {
      return res.status(200).json({
        ok: false,
        error: "topmediai_non_json",
        topmediai_status: r.status,
        sample: text.slice(0, 400),
        forwarded_as: qsKey,
        forwarded_id: raw,
      });
    }

    // ---- normalize: panel.music.js'in beklediği alanlar ----
    // status/state mapping
    const rawStatus = String(
      data.status ||
      data.state ||
      data.data?.status ||
      data.data?.state ||
      data.result?.status ||
      data.result?.state ||
      ""
    ).toLowerCase();

    const audioSrc =
      data.audio?.src ||
      data.audio?.url ||
      data.audio_url ||
      data.result?.audio?.src ||
      data.result?.audio?.url ||
      data.result?.audio_url ||
      data.data?.audio?.src ||
      data.data?.audio?.url ||
      data.data?.audio_url ||
      "";

    const isDone =
      !!audioSrc ||
      rawStatus === "succeeded" ||
      rawStatus === "success" ||
      rawStatus === "completed" ||
      rawStatus === "complete" ||
      rawStatus === "done";

    const isFail =
      rawStatus === "failed" ||
      rawStatus === "error";

    const state = isDone ? "COMPLETED" : isFail ? "FAILED" : "processing";
    const status = isDone ? "completed" : isFail ? "failed" : "processing";

    // Debug için forwarded bilgisi ekleyelim (UI bozmaz)
    const out = {
      ok: true,
      provider: "topmediai",
      state,
      status,
      job: {
        status,
        provider_job_id: raw,
        // panel.music.js bazen internal_job_id arıyor (self-heal)
        internal_job_id: raw,
      },
      audio: audioSrc ? { src: audioSrc } : null,
      forwarded_as: qsKey,
      forwarded_id: raw,
      topmediai: data,
    };

    return res.status(200).json(out);
  } catch (err) {
    console.error("api/music/status error:", err);
    return res.status(200).json({
      ok: false,
      error: "status_error",
      state: "processing",
      status: "processing",
    });
  }
};
