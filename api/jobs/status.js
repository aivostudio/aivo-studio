// api/jobs/status.js
const { getRedis } = require("../_kv");

function parseMaybeJSON(raw) {
  const v = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
  if (v == null) return null;
  if (typeof v === "object") return v;

  const s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);

  // 1) normal parse
  try {
    const a = JSON.parse(s);

    // 2) bazen redis'e string içinde string basılıyor: "\"{...}\""
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

function pickUrl(obj) {
  if (!obj) return null;
  return (
    obj.src ||
    obj.url ||
    obj.play_url ||
    obj.playUrl ||
    obj.output_url ||
    obj.outputUrl ||
    obj.download_url ||
    obj.downloadUrl ||
    obj.signed_url ||
    obj.signedUrl ||
    null
  );
}

function normalizeAudioSrc(job) {
  // Direkt alanlar
  const direct =
    pickUrl(job?.audio) ||
    job?.audio?.src ||
    job?.audio_url ||
    job?.output_url ||
    job?.play_url ||
    job?.result?.audio?.src ||
    job?.result?.audio?.url ||
    pickUrl(job?.result) ||
    null;
  if (direct) return direct;

  // outputs: type/kind/audio + url/play_url/output_url/src
  const outAudio =
    job?.outputs?.find(o => (o?.type || "").toLowerCase() === "audio") ||
    job?.outputs?.find(o => (o?.kind || "").toLowerCase() === "audio") ||
    null;

  const outPicked = pickUrl(outAudio) || pickUrl(job?.outputs?.[0]);
  if (outPicked) return outPicked;

  // files: type/kind/audio
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
      // debug
      _debug: {
        hasOutputs: Array.isArray(job.outputs) ? job.outputs.length : 0,
        hasFiles: Array.isArray(job.files) ? job.files.length : 0,
        keys: Object.keys(job || {}),
      },
      job,
    });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
