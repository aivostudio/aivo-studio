export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    // ✅ Hem job_id hem provider_job_id kabul et
    const jobId = String(req.query.provider_job_id || req.query.job_id || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    const r = await fetch(
      `https://api.topmediai.com/v2/query?song_id=${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: { "x-api-key": KEY },
      }
    );

    const rawText = await r.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { _non_json: rawText };
    }

    // 🔎 DEBUG modu: ?debug=1 ile RAW döndür
    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: true,
        provider: "topmediai",
        job_id: jobId,
        topmediai_status: r.status,
        raw: data,
      });
    }

    if (!r.ok || !data) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_status_failed",
        topmediai_status: r.status,
        topmediai_response: data,
      });
    }

    // TopMediai response mapping (best-effort)
    const rawStatus = String(
      data?.status || data?.state || data?.data?.status || data?.data?.state || ""
    ).toLowerCase();

    // URL mapping'i genişlettim (çoğu provider burada saklar)
    const audioUrl =
      data?.audio_url ||
      data?.audioUrl ||
      data?.song_url ||
      data?.songUrl ||
      data?.file_url ||
      data?.fileUrl ||
      data?.download_url ||
      data?.downloadUrl ||
      data?.audio?.url ||
      data?.audio?.src ||
      data?.result?.audio_url ||
      data?.result?.audioUrl ||
      data?.result?.song_url ||
      data?.result?.songUrl ||
      data?.result?.file_url ||
      data?.result?.fileUrl ||
      data?.result?.download_url ||
      data?.result?.downloadUrl ||
      data?.result?.audio?.url ||
      data?.result?.audio?.src ||
      data?.data?.audio_url ||
      data?.data?.audioUrl ||
      data?.data?.song_url ||
      data?.data?.songUrl ||
      data?.data?.file_url ||
      data?.data?.fileUrl ||
      data?.data?.download_url ||
      data?.data?.downloadUrl ||
      data?.data?.audio?.url ||
      data?.data?.audio?.src ||
      null;

    const state =
      (audioUrl || rawStatus === "succeeded" || rawStatus === "success" || rawStatus === "completed")
        ? "COMPLETED"
        : (rawStatus === "failed" || rawStatus === "error")
          ? "FAILED"
          : "PROCESSING";

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      job: { job_id: jobId, status: state },
      state,
      audio: audioUrl ? { src: audioUrl } : null,
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
