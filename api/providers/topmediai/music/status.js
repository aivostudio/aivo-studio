export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    const jobId = String(req.query.job_id || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    const r = await fetch(`https://api.topmediai.com/v2/query?song_id=${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        "x-api-key": KEY,
      },
    });

    const data = await r.json().catch(() => null);

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

    const audioUrl =
      data?.audio_url ||
      data?.audio?.url ||
      data?.audio?.src ||
      data?.result?.audio_url ||
      data?.result?.audio?.url ||
      data?.result?.audio?.src ||
      data?.data?.audio_url ||
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
      detail: err.message,
    });
  }
}
