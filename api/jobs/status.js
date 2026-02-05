// api/jobs/status.js
const { getRedis } = require("../_kv");

function parseMaybeJSON(raw) {
  const v = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
  if (v == null) return null;
  if (typeof v === "object") return v;

  const s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);
  try {
    return JSON.parse(s);
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

function normalizeAudioSrc(job) {
  return (
    job?.audio?.src ||
    job?.audio_url ||
    job?.output_url ||
    job?.play_url ||
    job?.outputs?.find(o => (o?.type || "").toLowerCase() === "audio")?.url ||
    job?.outputs?.find(o => (o?.kind || "").toLowerCase() === "audio")?.url ||
    job?.outputs?.[0]?.url ||
    job?.outputs?.[0]?.play_url ||
    job?.files?.find(f => (f?.type || "").toLowerCase() === "audio")?.url ||
    job?.files?.[0]?.url ||
    job?.result?.url ||
    null
  );
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
