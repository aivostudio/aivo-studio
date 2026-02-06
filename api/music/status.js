// api/music/status.js
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
  } catch { return null; }
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

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const provider_job_id = String(req.query.job_id || "").trim();
    if (!provider_job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    // provider job format guard
    if (!provider_job_id.startsWith("job_")) {
      return res.status(400).json({ ok: false, error: "expected_provider_job_id" });
    }

    // 1) provider -> internal mapping
    const mapRaw = await redis.get(`provider_map:${provider_job_id}`);
    const map = parseMaybeJSON(mapRaw);

    if (!map?.internal_job_id) {
      // endpoint VAR, mapping henüz yok => 200 queued dön (spam kesilir)
      return res.status(200).json({ ok: true, status: "queued" });
    }

    const internal_job_id = String(map.internal_job_id || "").trim();
    if (!internal_job_id) {
      return res.status(200).json({ ok: true, status: "queued" });
    }

    // 2) internal job status redis'ten oku (jobs/status ile aynı mantık)
    const raw = await redis.get(`job:${internal_job_id}`);
    if (!raw) {
      // mapping var ama job henüz yazılmadı => queued/processing
      return res.status(200).json({ ok: true, status: "processing", internal_job_id });
    }

    const job = parseMaybeJSON(raw);
    if (!job) {
      return res.status(200).json({ ok: true, status: "processing", internal_job_id });
    }

    const status = normalizeStatus(job);
    const audioSrc = normalizeAudioSrc(job);

    return res.status(200).json({
      ok: true,
      status,
      provider_job_id,
      internal_job_id,
      audio: { src: audioSrc },
      job, // debug
    });
  } catch (err) {
    console.error("music/status error:", err);
    // 500 yerine 200 processing dönmek panel spamini azaltır
    return res.status(200).json({ ok: true, status: "processing" });
  }
};
