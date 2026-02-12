// api/jobs/status.js  (PATCH: Runway task poll + ready mapping)
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
 if (Array.isArray(rawOut) && rawOut[0]) return "/api/media/proxy?url=" + encodeURIComponent(String(rawOut[0]));


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

function isUuidLike(id) {
  // Runway task id sample: f8a98016-b339-43d2-83b0-6c6c88bc3665
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""));
}

async function fetchRunwayTask(taskId) {
  const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
  if (!RUNWAYML_API_SECRET) {
    return { ok: false, status: 500, error: "missing_env_RUNWAYML_API_SECRET" };
  }

  const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
      "X-Runway-Version": "2024-11-06",
    },
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) {
    return { ok: false, status: r.status, error: "runway_task_fetch_failed", details: j };
  }
  return { ok: true, status: 200, task: j };
}

function mapRunwayToAivo(task) {
  const st = String(task?.status || task?.state || "").toUpperCase();

  const outArr = Array.isArray(task?.output) ? task.output : [];
  const url = outArr.find(x => typeof x === "string" && x.startsWith("http")) || null;

  if (st === "FAILED" || st === "ERROR") {
    return { status: "error", outputs: [], videoSrc: null };
  }

  if ((st === "SUCCEEDED" || st === "COMPLETED") && url) {
    return {
      status: "ready",
      outputs: [{ type: "video", url, meta: { app: "video" } }],
      videoSrc: url,
    };
  }

  // QUEUED / PENDING / RUNNING / PROCESSING...
  return { status: "processing", outputs: [], videoSrc: null };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // IMPORTANT: signed URLs + status should not be cached
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const job_id = String(req.query.job_id || "").trim();
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

    // 2) If redis miss AND looks like Runway task id => poll Runway directly
    if (!job && isUuidLike(job_id)) {
      const rr = await fetchRunwayTask(job_id);
      if (!rr.ok) {
        return res.status(rr.status || 500).json({
          ok: false,
          error: rr.error,
          details: rr.details,
        });
      }

      const mapped = mapRunwayToAivo(rr.task);

      return res.status(200).json({
        ok: true,
        job_id,
        status: mapped.status, // <-- UI expects "ready" here
        audio: null,
        video: mapped.videoSrc ? { url: mapped.videoSrc } : null,
        outputs: mapped.outputs, // <-- PPE.apply will use this
        job: { app: "video", provider: "runway", raw: rr.task }, // debug
      });
    }

    // 3) If still no job => 404 (not found)
    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }
// 4) Existing job normalization (audio/video from stored job)
// ---- SAFE Runway poll: only when job exists + provider=runway + request/task id is present ----
let runwayVideoSrc = null;

const provider = String(job?.provider || job?.meta?.provider || "").toLowerCase();

// IMPORTANT: request_id farklı isimlerde duruyor olabilir -> hepsini deniyoruz
const requestId = String(
  job?.request_id ||
  job?.task_id ||
  job?.runway_task_id ||
  job?.runwayTaskId ||
  job?.meta?.request_id ||
  job?.meta?.task_id ||
  job?.meta?.runway_task_id ||
  job?.meta?.runwayTaskId ||
  job?.raw?.id ||
  ""
).trim();

// Runway poll sadece gerçekten runway job ise çalışır (sistemi kırmaz)
if (provider === "runway" && requestId) {
  const rr = await fetchRunwayTask(requestId);
  if (rr.ok) {
    const mapped = mapRunwayToAivo(rr.task);
    runwayVideoSrc = mapped.videoSrc || null;

    // İstersen debug için raw task'ı job içine ekleyebilirsin
    job = { ...job, raw: rr.task };
  }
}

// şimdi normal normalize
const audioSrc = normalizeAudioSrc(job);
const videoSrc = runwayVideoSrc || normalizeVideoSrc(job);
    const videoSrcOut = videoSrc && /^https?:\/\//i.test(videoSrc)
  ? "/api/media/proxy?url=" + encodeURIComponent(videoSrc)
  : videoSrc;



    // Legacy normalize (audio-first) but allow video to set READY
    let status = "processing";
    const rawSt = String(job?.status || job?.state || job?.phase || "").toLowerCase();
    if (["error", "failed", "fail"].includes(rawSt)) status = "error";
    else if (audioSrc) status = "ready";
    else status = "processing";
   if (videoSrcOut && status !== "error") status = "ready";


    const outputs = videoSrcOut
  ? [{ type: "video", url: videoSrcOut, meta: { app: "video" } }]
  : [];


    return res.status(200).json({
      ok: true,
      job_id: job.job_id || job.id || job_id,
      status,
      audio: audioSrc ? { src: audioSrc } : null,
   video: videoSrcOut ? { url: videoSrcOut } : null,

      outputs,
      job, // debug
    });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
