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
  res.setHeader("x-aivo-status-build", "status-proxy-v4-topmediai-audio-normalize-2026-02-09");

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
    const qsKey = (isInternal && !isProvider) ? "job_id" : "provider_job_id";

    const workerOrigin =
      process.env.ARCHIVE_WORKER_ORIGIN ||
      "https://aivo-archive-worker.aivostudioapp.workers.dev";

    const url = `${workerOrigin}/api/music/status?${qsKey}=` + encodeURIComponent(raw);

    const r = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    const text = await r.text();
    const data = safeJsonParse(text);

    if (!data) {
      return res.status(200).json({
        ok: false,
        error: "worker_non_json",
        worker_status: r.status,
        sample: text.slice(0, 400),
        forwarded_as: qsKey,
        forwarded_id: raw,
      });
    }

    // Debug için forwarded bilgisi ekleyelim (UI bozmaz)
    if (data && typeof data === "object") {
      data.forwarded_as = qsKey;
      data.forwarded_id = raw;
    }

    // =========================================================
    // ✅ TOPMEDIAI NORMALIZE
    // Worker response örneği:
    // data.topmediai.data[0].audio -> mp3 url
    // data.topmediai.data[0].song_id -> output id
    // data.topmediai.data[0].status == FINISHED
    //
    // Panel/PPE için bizim standart:
    // data.audio.src + data.audio.output_id + state/status completed
    // =========================================================
    try {
      const arr = data?.topmediai?.data;
      const first = Array.isArray(arr) ? arr[0] : null;

      const mp3 =
        first?.audio ||
        first?.mp3 ||
        first?.url ||
        null;

      const outId =
        first?.song_id ||
        first?.id ||
        first?.output_id ||
        null;

      const st = String(first?.status || "").toUpperCase();

      if (mp3) {
        data.audio = {
          src: mp3,
          output_id: outId || String(raw),
        };

        // finished ise completed yap
        if (st === "FINISHED" || st === "SUCCESS" || st === "COMPLETED") {
          data.state = "completed";
          data.status = "completed";
          if (data.job) {
            data.job.status = "completed";
            data.job.state = "completed";
          }
        }
      }
    } catch (e) {
      // normalize fail olursa sessiz geç
      console.warn("[api/music/status] normalize error:", e);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("api/music/status proxy error:", err);
    return res.status(200).json({
      ok: false,
      error: "proxy_error",
      state: "processing",
      status: "processing",
    });
  }
};
