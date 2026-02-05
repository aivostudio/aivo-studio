// api/jobs/status.js
const { getRedis } = require("../_kv");

function parseMaybeJSON(raw) {
  const v = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
  if (v == null) return null;
  if (typeof v === "object") return v;

  const s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);

  try {
    const a = JSON.parse(s);
    // Sometimes payload is JSON-string inside JSON: "\"{...}\""
    if (typeof a === "string") {
      try {
        return JSON.parse(a);
      } catch {
        return null;
      }
    }
    return a;
  } catch {
    return null;
  }
}

function normalizeStatus(job) {
  const raw = (job?.status || job?.state || job?.phase || "").toString().toLowerCase();
  if (["ready", "completed", "done", "success"].includes(raw)) return "ready";
  if (["error", "failed", "fail"].includes(raw)) return "error";
  return "processing";
}

function pickUrl(x) {
  if (!x) return null;
  return (
    x.src ||
    x.url ||
    x.play_url ||
    x.playUrl ||
    x.output_url ||
    x.outputUrl ||
    x.download_url ||
    x.downloadUrl ||
    x.signed_url ||
    x.signedUrl ||
    null
  );
}

function normalizeAudioSrc(job) {
  // Direct / nested common fields
  const direct =
    pickUrl(job?.audio) ||
    job?.audio?.src ||
    job?.audio_url ||
    job?.output_url ||
    job?.play_url ||
    pickUrl(job?.result?.audio) ||
    pickUrl(job?.result) ||
    job?.result?.url ||
    null;
  if (direct) return direct;

  // outputs
  const outAudio =
    job?.outputs?.find(o => (o?.type || "").toLowerCase() === "audio") ||
    job?.outputs?.find(o => (o?.kind || "").toLowerCase() === "audio") ||
    null;

  const outPicked = pickUrl(outAudio) || pickUrl(job?.outputs?.[0]);
  if (outPicked) return outPicked;

  // files
  const fileAudio =
    job?.files?.find(f => (f?.type || "").toLowerCase() === "audio") ||
    job?.files?.find(f => (f?.kind || "").toLowerCase() === "audio") ||
    null;

  const filePicked = pickUrl(fileAudio) || pickUrl(job?.files?.[0]);
  if (filePicked) return filePicked;

  return null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    const raw = await redis.get(`job:${job_id}`);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    const job = parseMaybeJSON(raw);
    if (!job) {
      console.error("jobs/status invalid redis payload:", raw);
      return res.status(500).json({ ok: false, error: "job_payload_invalid" });
    }

    const jobId = job.job_id || job.id || job.jobId || job_id;
    const status = normalizeStatus(job);
    const audioSrc = normalizeAudioSrc(job);

    return res.status(200).json({
      ok: true,
      job_id: jobId,
      status,
      audio: { src: audioSrc },
      job, // debug; gerekirse sonra kaldırırsın
    });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
