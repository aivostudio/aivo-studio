// api/music/status.js
// Vercel route: Direct provider status (worker bypass) + normalize to audio.src

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("x-aivo-status-build", "status-direct-v1-topmediai-audio-normalize-2026-02-09");

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

    // NOTE: Music V2: we treat provider ids as primary for now.
    // If you pass job_... we still forward as provider_job_id unless you later implement internal mapping.
    const isInternal = raw.startsWith("job_");
    const isProvider =
      raw.startsWith("prov_music_") ||
      raw.startsWith("prov_") ||
      raw.startsWith("provider_");

    const providerJobId = raw; // for now

    // ---------------------------------------------------------
    // Upstream: provider status endpoint (Vercel internal route)
    // ---------------------------------------------------------
    const url = `https://aivo.tr/api/providers/topmediai/music/status?provider_job_id=${encodeURIComponent(providerJobId)}`;

    const r = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
    });

    const text = await r.text();
    const data = safeJsonParse(text);

    if (!data) {
      return res.status(200).json({
        ok: false,
        error: "upstream_non_json",
        state: "processing",
        status: "processing",
        upstream_status: r.status,
        upstream_preview: String(text || "").slice(0, 200),
      });
    }

    // Always ensure ids exist at top-level for the panel
    if (!data.provider_job_id) data.provider_job_id = providerJobId;

    // ---------------------------------------------------------
    // ✅ TOPMEDIAI NORMALIZE (robust)
    // Hedef: data.audio.src dolsun + state/status doğru set olsun
    // ---------------------------------------------------------
    try {
      // Try to locate an array payload in multiple common shapes
      const arr =
        Array.isArray(data?.topmediai?.data) ? data.topmediai.data :
        Array.isArray(data?.topmediai?.data?.data) ? data.topmediai.data.data :
        Array.isArray(data?.topmediai?.data?.result) ? data.topmediai.data.result :
        Array.isArray(data?.data) ? data.data :
        Array.isArray(data?.result) ? data.result :
        null;

      const first = arr ? arr[0] : null;

      const mp3 =
        first?.audio ||
        first?.audio_url ||
        first?.mp3 ||
        first?.url ||
        first?.file ||
        null;

      const outId =
        first?.song_id ||
        first?.id ||
        first?.output_id ||
        first?.task_id ||
        null;

      const st = String(
        first?.status ||
        data?.job?.status ||
        data?.status ||
        data?.state ||
        ""
      ).toUpperCase();

      if (mp3) {
        data.audio = { src: mp3, output_id: outId || String(providerJobId) };

        // mp3 geldiyse panel için ready => completed
        data.state = "completed";
        data.status = "completed";

        if (data.job && typeof data.job === "object") {
          data.job.status = "COMPLETED";
          data.job.state = "COMPLETED";
        }
      } else {
        // keep upstream state/status if present; otherwise default
        data.state = data.state || "processing";
        data.status = data.status || "processing";
      }

      if (st.includes("FAIL") || st.includes("ERROR")) {
        data.state = "failed";
        data.status = "failed";
        if (data.job && typeof data.job === "object") {
          data.job.status = "FAILED";
          data.job.state = "FAILED";
        }
      }

      // If upstream says processing but we have queued, keep it consistent
      if (data.state === "queued" && data.status !== "processing") {
        data.status = "processing";
      }
    } catch (e) {
      console.warn("[api/music/status] normalize error:", e);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("api/music/status error:", err);
    return res.status(200).json({
      ok: false,
      error: "proxy_error",
      state: "processing",
      status: "processing",
    });
  }
};
