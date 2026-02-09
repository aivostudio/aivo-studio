// api/music/status.js
// Vercel route: Worker'a proxy (R2 mapping + outputs logic Worker'da)
// ENV (opsiyonel): ARCHIVE_WORKER_ORIGIN=https://aivo-archive-worker.aivostudioapp.workers.dev

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = async (req, res) => {
  // Build doğrulama header'ı (Network -> Response Headers)
  res.setHeader("x-aivo-status-build", "status-proxy-v5-topmediai-audio-normalize-2026-02-09");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const raw = String(
      req.query.job_id ||
      req.query.provider_job_id ||
      req.query.providerJobId ||
      ""
    ).trim();

    if (!raw) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    const isInternal = raw.startsWith("job_");
    const isProvider =
      raw.startsWith("prov_music_") ||
      raw.startsWith("prov_") ||
      raw.startsWith("provider_");

    const qsKey = (isInternal && !isProvider) ? "job_id" : "provider_job_id";

   

    // =========================================================
    // ✅ TOPMEDIAI NORMALIZE (robust)
    // Hedef: data.audio.src kesin dolsun + state/status doğru set olsun
    // =========================================================
    try {
      const first = Array.isArray(data?.topmediai?.data) ? data.topmediai.data[0] : null;

      const mp3 =
        first?.audio ||
        first?.audio_url ||
        first?.mp3 ||
        first?.url ||
        null;

      const outId =
        first?.song_id ||
        first?.id ||
        first?.output_id ||
        null;

      const st = String(first?.status || data?.status || data?.state || "").toUpperCase();

      if (mp3) {
        data.audio = { src: mp3, output_id: outId || String(raw) };

        // mp3 geldiyse panel için ready => completed
        data.state = "completed";
        data.status = "completed";
        if (data.job && typeof data.job === "object") {
          data.job.status = "completed";
          data.job.state = "completed";
        }
      } else {
        data.state = data.state || "processing";
        data.status = data.status || "processing";
      }

      if (st.includes("FAIL") || st.includes("ERROR")) {
        data.state = "failed";
        data.status = "failed";
      }
    } catch (e) {
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
