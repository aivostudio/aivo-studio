// api/jobs/status.js
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

function normalizeStatus(job, audioSrc) {
  const raw = (job?.status || job?.state || job?.phase || "").toString().toLowerCase();

  // FAILED
  if (["error", "failed", "fail"].includes(raw)) return "error";

  // READY ancak playable audio varsa READY kabul et
  if (["ready", "completed", "done", "success"].includes(raw) && audioSrc) return "ready";

  // Bazı provider'lar status alanını doğru set etmeyebilir; audio geldiyse yine READY
  if (audioSrc) return "ready";

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

/* ============================
   ✅ ADD: video output normalize
============================ */
function normalizeVideoSrc(job) {
    // ✅ Runway raw.output (array) fallback
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

/* ============================
   ✅ ADD: internal fetch helper
============================ */
async function tryFetchJSON(url) {
  const r = await fetch(url, { method: "GET" });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, json: j };
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

    let raw = await redis.get(`job:${job_id}`);

    /* ============================
       ✅ ADD: RUNWAY VIDEO fallback
       - Eğer job redis'te yoksa, job_id'yi request_id gibi kullanıp
         providers/runway/video/status'tan çekip redis'e yaz.
    ============================ */
    if (!raw) {
      // Not: production’da host hardcode etmek istemezsin.
      // Vercel/Node tarafında relative fetch genelde çalışır; değilse full URL’ye geçersin.
     const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
const host  = (req.headers["x-forwarded-host"]  || req.headers.host || "aivo.tr").toString().split(",")[0].trim();
const origin = `${proto}://${host}`;

const url = `${origin}/api/providers/runway/video/status?request_id=${encodeURIComponent(job_id)}`;
const { ok, json } = await tryFetchJSON(url);


      if (ok && json && json.ok) {
        // json içindeki alanları mümkün olduğunca job formatına yaklaştır
        const seededJob = {
          ...json,
          id: json.id || json.job_id || job_id,
          job_id: json.job_id || job_id,
          request_id: json.request_id || job_id,
          app: json.app || "video",
          module: json.module || "video",
          routeKey: json.routeKey || "video",
        };

        try {
          await redis.set(`job:${job_id}`, JSON.stringify(seededJob), { ex: 60 * 60 }); // 1 saat
          raw = JSON.stringify(seededJob);
        } catch (e) {
          console.error("jobs/status runway fallback redis set failed:", e);
          // redis yazamazsak bile response dönmeye devam edelim
          raw = JSON.stringify(seededJob);
        }
      } else {
        // job yoksa eskisi gibi dön
        return res.status(404).json({ ok: false, error: "job_not_found" });
      }
    }

    const job = parseMaybeJSON(raw);
    if (!job) {
      console.error("jobs/status invalid redis payload:", raw);
      return res.status(500).json({ ok: false, error: "job_payload_invalid" });
    }

    const jobId = job.job_id || job.id || job.jobId || job_id;
    const audioSrc = normalizeAudioSrc(job);
    const videoSrc = normalizeVideoSrc(job);

    // audio normalizeStatus audio odaklı, ama video da geldiyse ready sayalım
    let status = normalizeStatus(job, audioSrc);
    if (videoSrc && status !== "error") status = "ready";

    return res.status(200).json({
      ok: true,
      job_id: jobId,
      status,
      audio: audioSrc ? { src: audioSrc } : null, // ✅ null ise audio tamamen null

      /* ============================
         ✅ ADD: video + outputs (PPE uyumlu)
      ============================ */
      video: videoSrc ? { url: videoSrc } : null,
      outputs: videoSrc ? [{ type: "video", url: videoSrc, meta: { app: "video" } }] : [],

      job, // debug; gerekirse sonra kaldırırsın
    });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
