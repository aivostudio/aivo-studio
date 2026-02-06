// api/music/finalize.js
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

function safeJson(res, obj, code = 200) {
  return res.status(code).json(obj);
}

function nowISO() {
  return new Date().toISOString();
}

function uuidLike() {
  // basit unique id (crypto yoksa fallback)
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return safeJson(res, { ok: false, error: "method_not_allowed" }, 405);
    }

    const redis = getRedis();

    // body
    const body = req.body || {};
    const provider_job_id = String(body.provider_job_id || "").trim();
    const internal_job_id_body = String(body.internal_job_id || "").trim();

    // gerçek dosya yolu (R2 key) veya direkt mp3 url
    const file_key = String(body.file_key || "").trim();   // örn: files/job_xxx/out_xxx/song.mp3
    const mp3_url = String(body.mp3_url || "").trim();     // opsiyonel
    const file_name = String(body.file_name || "output.mp3").trim();
    const mime = String(body.mime || "audio/mpeg").trim();

    if (!provider_job_id) {
      return safeJson(res, { ok: false, error: "provider_job_id_required" }, 400);
    }

    // provider map'ten internal job bul
    let internal_job_id = internal_job_id_body;
    if (!internal_job_id) {
      const mapRaw = await redis.get(`provider_map:${provider_job_id}`);
      const map = parseMaybeJSON(mapRaw);
      internal_job_id = String(map?.internal_job_id || "").trim();
    }

    if (!internal_job_id) {
      return safeJson(res, {
        ok: false,
        error: "internal_job_id_not_found",
        provider_job_id
      }, 404);
    }

    // output id üret
    const output_id = "out_" + uuidLike();

    // output meta
    const outputMeta = {
      id: output_id,
      type: "audio",
      kind: "audio",
      mime,
      file_name,
      file_key: file_key || null,
      mp3_url: mp3_url || null,
      created_at: nowISO(),
    };

    // outputs index
    const outputsIndexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const outputMetaKey = `jobs/${internal_job_id}/outputs/${output_id}.json`;

    // mevcut index varsa oku
    let index = { outputs: [] };
    const indexRaw = await redis.get(outputsIndexKey);
    const indexParsed = parseMaybeJSON(indexRaw);
    if (indexParsed && typeof indexParsed === "object") index = indexParsed;
    if (!Array.isArray(index.outputs)) index.outputs = [];

    // output ekle
    if (!index.outputs.includes(output_id)) {
      index.outputs.push(output_id);
    }

    // job meta güncelle (job status)
    const jobKey = `job:${internal_job_id}`;
    let job = {};
    const jobRaw = await redis.get(jobKey);
    const jobParsed = parseMaybeJSON(jobRaw);
    if (jobParsed && typeof jobParsed === "object") job = jobParsed;

    job.status = "ready";
    job.state = "ready";
    job.updated_at = nowISO();
    job.outputs = job.outputs || [];
    if (Array.isArray(job.outputs)) {
      job.outputs.push({
        id: output_id,
        type: "audio",
        mime,
        file_key: file_key || null,
        mp3_url: mp3_url || null,
      });
    }

    // redis write
    await redis.set(outputMetaKey, JSON.stringify(outputMeta));
    await redis.set(outputsIndexKey, JSON.stringify(index));
    await redis.set(jobKey, JSON.stringify(job));

    // response play url üret
    const origin = new URL(req.url).origin;
    const play_url = `${origin}/files/play?job_id=${encodeURIComponent(internal_job_id)}&output_id=${encodeURIComponent(output_id)}`;

    return safeJson(res, {
      ok: true,
      provider_job_id,
      internal_job_id,
      state: "ready",
      output_id,
      file_key: file_key || null,
      mp3_url: mp3_url || play_url,
      play_url,
      keys: { outputsIndexKey, outputMetaKey, jobKey },
    });

  } catch (err) {
    console.error("music/finalize error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
