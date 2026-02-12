// api/jobs/status.js
// DB-first status: Postgres (Neon) -> Redis fallback -> (optional) Runway poll via DB request_id
// CommonJS

const { getRedis } = require("../_kv");
const { Pool } = require("pg");

// --- PG pool (singleton-ish) ---
let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) return null;
  _pool = new Pool({
    connectionString: DATABASE_URL,
    // Neon/SSL:
    ssl: { rejectUnauthorized: false },
  });
  return _pool;
}

// --- helpers ---
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

function normalizeOutputs(outputs) {
  // Expect: [{type:"video|audio|image", url/src, ...}]
  if (!outputs) return [];
  if (Array.isArray(outputs)) return outputs;
  // Sometimes JSONB could be object
  if (typeof outputs === "object") {
    // allow {items:[...]} or {outputs:[...]}
    const arr = outputs.items || outputs.outputs || outputs.data;
    if (Array.isArray(arr)) return arr;
  }
  return [];
}

function findFirstByType(outputs, type) {
  const t = String(type || "").toLowerCase();
  return (
    outputs.find((o) => String(o?.type || o?.kind || "").toLowerCase() === t) ||
    null
  );
}

function normalizeFromDbRow(row) {
  const outputs = normalizeOutputs(row.outputs);

  // audio
  const audioOut = findFirstByType(outputs, "audio");
  const audioSrc =
    pickUrl(audioOut) ||
    pickUrl(row?.meta?.audio) ||
    pickUrl(row?.meta?.result?.audio) ||
    null;

  // video
  const videoOut = findFirstByType(outputs, "video");
  const videoUrl =
    pickUrl(videoOut) ||
    pickUrl(row?.meta?.video) ||
    pickUrl(row?.meta?.result?.video) ||
    null;

  // image/photo
  const imageOut =
    findFirstByType(outputs, "image") ||
    findFirstByType(outputs, "photo") ||
    findFirstByType(outputs, "cover") ||
    null;
  const imageUrl =
    pickUrl(imageOut) ||
    pickUrl(row?.meta?.image) ||
    pickUrl(row?.meta?.result?.image) ||
    null;

  // status mapping
  const st = String(row.status || "").toLowerCase();
  let status = "processing";
  if (["error", "failed", "fail"].includes(st)) status = "error";
  else if (["ready", "completed", "complete", "succeeded", "success", "done"].includes(st)) status = "ready";
  else status = "processing";

  // If outputs already contain something usable, treat as ready
  if ((audioSrc || videoUrl || imageUrl) && status !== "error") status = "ready";

  return { status, outputs, audioSrc, videoUrl, imageUrl };
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
    job?.outputs?.find((o) => (o?.type || "").toLowerCase() === "audio") ||
    job?.outputs?.find((o) => (o?.kind || "").toLowerCase() === "audio") ||
    null;

  const outPicked = pickUrl(outAudio) || pickUrl(job?.outputs?.[0]);
  if (outPicked) return outPicked;

  const fileAudio =
    job?.files?.find((f) => (f?.type || "").toLowerCase() === "audio") ||
    job?.files?.find((f) => (f?.kind || "").toLowerCase() === "audio") ||
    null;

  const filePicked = pickUrl(fileAudio) || pickUrl(job?.files?.[0]);
  if (filePicked) return filePicked;

  return null;
}

function normalizeVideoSrc(job) {
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
    job?.outputs?.find((o) => (o?.type || "").toLowerCase() === "video") ||
    job?.outputs?.find((o) => (o?.kind || "").toLowerCase() === "video") ||
    null;

  const outPicked = pickUrl(outVideo);
  if (outPicked) return outPicked;

  const fileVideo =
    job?.files?.find((f) => (f?.type || "").toLowerCase() === "video") ||
    job?.files?.find((f) => (f?.kind || "").toLowerCase() === "video") ||
    null;

  const filePicked = pickUrl(fileVideo);
  if (filePicked) return filePicked;

  return null;
}

function isUuidLike(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

// --- Runway optional poll (ONLY if DB says provider=runway + request_id exists) ---
async function fetchRunwayTask(taskId) {
  const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
  if (!RUNWAYML_API_SECRET) {
    return { ok: false, status: 500, error: "missing_env_RUNWAYML_API_SECRET" };
  }

  const r = await fetch(
    `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
        "X-Runway-Version": "2024-11-06",
      },
    }
  );

  const j = await r.json().catch(() => null);
  if (!r.ok) {
    return { ok: false, status: r.status, error: "runway_task_fetch_failed", details: j };
  }
  return { ok: true, status: 200, task: j };
}

function mapRunwayToAivo(task) {
  const st = String(task?.status || task?.state || "").toUpperCase();
  const outArr = Array.isArray(task?.output) ? task.output : [];
  const url = outArr.find((x) => typeof x === "string" && x.startsWith("http")) || null;

  if (st === "FAILED" || st === "ERROR") {
    return { status: "error", outputs: [], videoSrc: null, raw: task };
  }

  if ((st === "SUCCEEDED" || st === "COMPLETED") && url) {
    return {
      status: "ready",
      outputs: [{ type: "video", url, meta: { app: "video" } }],
      videoSrc: url,
      raw: task,
    };
  }

  return { status: "processing", outputs: [], videoSrc: null, raw: task };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");

    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    // 1) DB FIRST
    const pool = getPool();
    if (pool) {
      // Only query DB if job_id is uuid (your DB ids are UUID)
      if (isUuidLike(job_id)) {
        const { rows } = await pool.query(
          `SELECT id, user_id, app, provider, request_id, status, prompt, meta, outputs, error, created_at, updated_at
           FROM jobs
           WHERE id = $1
           LIMIT 1`,
          [job_id]
        );

        if (rows && rows[0]) {
          const row = rows[0];
          const norm = normalizeFromDbRow(row);

          // Optional: if provider=runway and request_id exists -> poll runway live
          if (String(row.provider || "").toLowerCase() === "runway" && row.request_id && isUuidLike(row.request_id)) {
            // Only poll if not already ready/error
            if (norm.status === "processing") {
              const rr = await fetchRunwayTask(row.request_id);
              if (rr.ok) {
                const mapped = mapRunwayToAivo(rr.task);
                // Prefer runway live output if ready
                if (mapped.status === "ready" || mapped.status === "error") {
                  return res.status(200).json({
                    ok: true,
                    job_id: row.id,
                    status: mapped.status,
                    audio: null,
                    video: mapped.videoSrc ? { url: mapped.videoSrc } : null,
                    image: null,
                    outputs: mapped.outputs,
                    job: { ...row, raw: mapped.raw }, // debug
                  });
                }
              }
              // if runway fetch fails, still return DB processing (don’t break)
            }
          }

          return res.status(200).json({
            ok: true,
            job_id: row.id,
            status: norm.status,
            audio: norm.audioSrc ? { src: norm.audioSrc } : null,
            video: norm.videoUrl ? { url: norm.videoUrl } : null,
            image: norm.imageUrl ? { url: norm.imageUrl } : null,
            outputs: norm.outputs,
            job: row, // debug
          });
        }
      }
    }

    // 2) Redis fallback (legacy)
    const redis = getRedis();
    const raw = await redis.get(`job:${job_id}`);
    if (raw) {
      const job = typeof raw === "string" ? JSON.parse(raw) : raw;

      const audioSrc = normalizeAudioSrc(job);
      const videoSrc = normalizeVideoSrc(job);

      let status = "processing";
      const rawSt = String(job?.status || job?.state || job?.phase || "").toLowerCase();
      if (["error", "failed", "fail"].includes(rawSt)) status = "error";
      else if (audioSrc) status = "ready";
      else status = "processing";
      if (videoSrc && status !== "error") status = "ready";

      const outputs = videoSrc ? [{ type: "video", url: videoSrc, meta: { app: "video" } }] : [];

      return res.status(200).json({
        ok: true,
        job_id: job.job_id || job.id || job_id,
        status,
        audio: audioSrc ? { src: audioSrc } : null,
        video: videoSrc ? { url: videoSrc } : null,
        image: null,
        outputs,
        job, // debug
      });
    }

    // 3) Not found anywhere
    return res.status(404).json({ ok: false, error: "job_not_found" });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
