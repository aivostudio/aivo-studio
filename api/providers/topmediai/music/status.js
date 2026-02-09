// api/providers/topmediai/music/status.js
// GET ?provider_job_id=... | ?job_id=...
// 1) /v2/query?song_id=... (cheap status)
// 2) if no audio => /v2/task/results?ids=... (results list)
// Output: stable { ok, provider, job, state, status, audio?, topmediai:{...} }

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function pickFirstArray(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) return obj;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.result)) return obj.result;
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.list)) return obj.list;
  return null;
}

function extractAudioUrl(any) {
  if (!any) return null;

  // direct fields
  const direct =
    any.audio_url || any.audioUrl ||
    any.song_url || any.songUrl ||
    any.file_url || any.fileUrl ||
    any.download_url || any.downloadUrl ||
    any.url || any.mp3 ||
    any.audio?.url || any.audio?.src ||
    null;

  if (direct) return direct;

  // common nested shapes
  const nested =
    any.result?.audio_url || any.result?.audioUrl ||
    any.result?.song_url || any.result?.songUrl ||
    any.result?.file_url || any.result?.fileUrl ||
    any.result?.download_url || any.result?.downloadUrl ||
    any.result?.url || any.result?.mp3 ||
    any.result?.audio?.url || any.result?.audio?.src ||
    any.data?.audio_url || any.data?.audioUrl ||
    any.data?.song_url || any.data?.songUrl ||
    any.data?.file_url || any.data?.fileUrl ||
    any.data?.download_url || any.data?.downloadUrl ||
    any.data?.url || any.data?.mp3 ||
    any.data?.audio?.url || any.data?.audio?.src ||
    null;

  return nested || null;
}

function normalizeStateFromStatus(s) {
  const raw = String(s || "").toLowerCase();
  if (raw.includes("fail") || raw.includes("error")) return "FAILED";
  if (raw.includes("success") || raw.includes("succeed") || raw.includes("complete") || raw.includes("completed")) return "COMPLETED";
  if (raw.includes("queue") || raw.includes("pending")) return "PROCESSING";
  if (raw.includes("process") || raw.includes("running")) return "PROCESSING";
  return raw ? "PROCESSING" : "PROCESSING";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    const jobId = String(req.query.provider_job_id || req.query.job_id || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    // 1) Query status
    const qRes = await fetch(
      `https://api.topmediai.com/v2/query?song_id=${encodeURIComponent(jobId)}`,
      { method: "GET", headers: { "x-api-key": KEY } }
    );

    const qText = await qRes.text();
    const qJson = safeJsonParse(qText) ?? { _non_json: qText };

    // Try extract from query payload
    const qStatus =
      qJson?.status || qJson?.state ||
      qJson?.data?.status || qJson?.data?.state ||
      qJson?.result?.status || qJson?.result?.state ||
      null;

    let audioUrl = extractAudioUrl(qJson);

    // 2) If still no audio, try results endpoint
    let resultsJson = null;
    let resultsStatus = null;

    if (!audioUrl) {
      // NOTE: based on earlier reverse, results are usually here:
      // /v2/task/results?ids=...
      // If provider uses a different path, debug=1 will show it.
      const rRes = await fetch(
        `https://api.topmediai.com/v2/task/results?ids=${encodeURIComponent(jobId)}`,
        { method: "GET", headers: { "x-api-key": KEY } }
      );

      const rText = await rRes.text();
      resultsJson = safeJsonParse(rText) ?? { _non_json: rText };
      resultsStatus = rRes.status;

      const arr = pickFirstArray(resultsJson);
      const first = arr ? arr[0] : null;

      audioUrl = extractAudioUrl(first) || extractAudioUrl(resultsJson);

      // Sometimes status lives on first element
      if (!qStatus && first?.status) {
        // keep as fallback
      }
    }

    // Debug mode: show raw upstreams
    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: true,
        provider: "topmediai",
        job_id: jobId,
        query: {
          http_status: qRes.status,
          raw: qJson,
        },
        results: resultsJson ? {
          http_status: resultsStatus,
          raw: resultsJson,
        } : null,
        extracted: { audioUrl, qStatus },
      });
    }

    // If query call itself failed, surface it (but still 200/ok true isn't necessary here)
    if (!qRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "topmediai_status_failed",
        topmediai_status: qRes.status,
        topmediai_response: qJson,
      });
    }

    // State decision
    let state = audioUrl ? "COMPLETED" : normalizeStateFromStatus(qStatus);

    // If results endpoint returned explicit failure
    const rs = String(
      resultsJson?.status || resultsJson?.state || resultsJson?.data?.status || resultsJson?.data?.state || ""
    ).toLowerCase();
    if (rs.includes("fail") || rs.includes("error")) state = "FAILED";

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      job: { job_id: jobId, status: state },
      state,
      status: state === "COMPLETED" ? "completed" : state === "FAILED" ? "failed" : "processing",
      audio: audioUrl ? { src: audioUrl } : null,
      // keep originals for observability
      topmediai: {
        query: qJson,
        results: resultsJson || null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
