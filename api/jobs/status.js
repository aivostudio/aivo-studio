// api/jobs/status.js  (SAFE PATCH: no provider-guessing by UUID)
// CommonJS

const { getRedis } = require("../_kv");

function parseMaybeJSON(raw) {
  const v = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
  if (v == null) return null;
  if (typeof v === "object") return v;

  const s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);

  try {
    const a = JSON.parse(s);
    if (typeof a === "string") {
      try { return JSON.parse(a); } catch { return null; }
    }
    return a;
  } catch {
    return null;
  }
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

  const outAudio =
    job?.outputs?.find(o => (o?.type || "").toLowerCase() === "audio") ||
    job?.outputs?.find(o => (o?.kind || "").toLowerCase() === "audio") ||
    null;

  const outPicked = pickUrl(outAudio) || pickUrl(job?.outputs?.[0]);
  if (outPicked) return outPicked;

  const fileAudio =
    job?.files?.find(f => (f?.type || "").toLowerCase() === "audio") ||
    job?.files?.find(f => (f?.kind || "").toLowerCase() === "audio") ||
    null;

  const filePicked = pickUrl(fileAudio) || pickUrl(job?.files?.[0]);
  if (filePicked) return filePicked;

  return null;
}

function normalizeVideoSrc(job) {
  // Runway style: raw.output: ["https://...mp4?...jwt"]
  const rawOut = job?.raw?.output;
  if (Array.isArray(rawOut) && rawOut[0]) return String(rawOut[0]);

  const direct =
    pickUrl(job?.video) ||
    job?.video?.src ||
    job?.video_url ||
    pickUrl(job?.result?.video) ||
    null;
  if (direct) return direct;

  const outVideo =
    job?.outputs?.find(o => (o?.type || "").toLowerCase() === "video") ||
    job?.outputs?.find(o => (o?.kind || "").toLowerCase() === "video") ||
    null;

  const outPicked = pickUrl(outVideo);
  if (outPicked) return outPicked;

  const fileVideo =
    job?.files?.find(f => (f?.type || "").toLowerCase() === "video") ||
    job?.files?.find(f => (f?.kind || "").toLowerCase() === "video") ||
    null;

  const filePicked = pickUrl(fileVideo);
  if (filePicked) return filePicked;

  return null;
}

function safeApp(job, fallback) {
  const a = (job?.app || job?.meta?.app || fallback || "").toString().trim();
  return a || null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // IMPORTANT: signed URLs + status should not be cached
    res.setHeader("Cache-Control", "no-store, max-age=0");

    // Backward compatible: some clients may call with ?id=
    const job_id = String(req.query.job_id || req.query.id || "").trim();
    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    const redis = getRedis();
    let job = null;

    // 1) Try redis first (existing architecture)
    const raw = await redis.get(`job:${job_id}`);
    if (raw) {
      job = parseMaybeJSON(raw);
      if (!job) {
        // corrupt payload
        return res.status(500).json({ ok: false, error: "job_payload_invalid" });
      }
    }

    // 2) If still no job => NOT FOUND
    // IMPORTANT: DO NOT "guess provider" by UUID and poll Runway here.
    // DB job UUIDs and Runway task UUIDs look the same => this was breaking music/cover/video.
    if (!job) {
      // Returning 200 is safer for clients that treat non-2xx as hard-fail.
      return res.status(200).json({ ok: false, error: "job_not_found" });
    }

    // 3) Existing job normalization (audio/video from stored job)
    const audioSrc = normalizeAudioSrc(job);
    const videoSrc = normalizeVideoSrc(job);

    // Legacy normalize but allow video to set READY
    let status = "processing";
    const rawSt = String(job?.status || job?.state || job?.phase || "").toLowerCase();
    if (["error", "failed", "fail"].includes(rawSt)) status = "error";
    else if (audioSrc) status = "ready";
    else status = "processing";
    if (videoSrc && status !== "error") status = "ready";

    const app = safeApp(job, req.query.app);

    const outputs = [];
    if (audioSrc) outputs.push({ type: "audio", url: audioSrc, meta: { app } });
    if (videoSrc) outputs.push({ type: "video", url: videoSrc, meta: { app } });

    return res.status(200).json({
      ok: true,
      job_id: job.job_id || job.id || job_id,
      status,
      audio: audioSrc ? { src: audioSrc } : null,
      video: videoSrc ? { url: videoSrc } : null,
      outputs,
      job, // debug
    });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
