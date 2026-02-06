// api/music/finalize.js
const { getRedis } = require("../_kv");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

let r2;
function getR2() {
  if (r2) return r2;
  r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return r2;
}

async function r2PutJson(key, obj) {
  const Bucket = process.env.R2_BUCKET || "aivo-archive";
  await getR2().send(new PutObjectCommand({
    Bucket,
    Key: key,
    Body: JSON.stringify(obj),
    ContentType: "application/json",
  }));
}

// ✅ R2 (Cloudflare) için S3 uyumlu client


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
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrigin(req) {
  const proto =
    (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim() ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] || "").toString().split(",")[0].trim() ||
    (req.headers.host || "").toString().trim();

  if (!host) return "https://aivo.tr";
  return `${proto}://${host}`;
}

function normalizeFileKey(k) {
  if (!k) return "";
  const s = String(k).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

// ✅ R2 client (lazy)
let _r2 = null;
function getR2() {
  if (_r2) return _r2;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _r2;
}

async function r2PutJSON(key, obj) {
  const Bucket = process.env.R2_BUCKET || "aivo-archive"; // ✅ worker bucket’ı
  const Body = JSON.stringify(obj);
  const client = getR2();

  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body,
      ContentType: "application/json; charset=utf-8",
    })
  );
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return safeJson(res, { ok: false, error: "method_not_allowed" }, 405);
    }

    const redis = getRedis();

    const body = req.body || {};
    const provider_job_id = String(body.provider_job_id || "").trim();
    const internal_job_id_body = String(body.internal_job_id || "").trim();

    const file_key_raw = String(body.file_key || "").trim();
    const mp3_url_raw = String(body.mp3_url || "").trim();
    const file_name = String(body.file_name || "output.mp3").trim();
    const mime = String(body.mime || "audio/mpeg").trim();

    if (!provider_job_id) {
      return safeJson(res, { ok: false, error: "provider_job_id_required" }, 400);
    }

    // provider -> internal mapping
    let internal_job_id = internal_job_id_body;
    if (!internal_job_id) {
      const mapRaw = await redis.get(`provider_map:${provider_job_id}`);
      const map = parseMaybeJSON(mapRaw);
      internal_job_id = String(map?.internal_job_id || "").trim();
    }

    if (!internal_job_id) {
      return safeJson(
        res,
        { ok: false, error: "internal_job_id_not_found", provider_job_id },
        404
      );
    }

    const origin = getOrigin(req);

    const file_key = normalizeFileKey(file_key_raw);
    const mp3_url =
      mp3_url_raw ||
      (/^https?:\/\//i.test(file_key)
        ? file_key
        : (file_key ? new URL(file_key, origin).toString() : ""));

    const output_id = "out_" + uuidLike();

    const outputsIndexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const outputMetaKey = `jobs/${internal_job_id}/outputs/${output_id}.json`;
    const jobKey = `job:${internal_job_id}`;

    // index oku (Redis)
    let index = { outputs: [] };
    const indexRaw = await redis.get(outputsIndexKey);
    const indexParsed = parseMaybeJSON(indexRaw);
    if (indexParsed && typeof indexParsed === "object") index = indexParsed;
    if (!Array.isArray(index.outputs)) index.outputs = [];
    if (!index.outputs.includes(output_id)) index.outputs.push(output_id);

    // job oku (Redis)
    let job = {};
    const jobRaw = await redis.get(jobKey);
    const jobParsed = parseMaybeJSON(jobRaw);
    if (jobParsed && typeof jobParsed === "object") job = jobParsed;
    if (!Array.isArray(job.outputs)) job.outputs = [];

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

    job.status = "ready";
    job.state = "ready";
    job.updated_at = nowISO();

    if (!job.outputs.some(o => o && o.id === output_id)) {
      job.outputs.push({
        id: output_id,
        type: "audio",
        kind: "audio",
        mime,
        file_name,
        file_key: file_key || null,
        mp3_url: mp3_url || null,
      });
    }

   

   // ✅ önce R2’ye yaz (worker buradan okuyor)
await r2PutJson(outputMetaKey, outputMeta);
await r2PutJson(outputsIndexKey, index);

// sonra Redis’e de yaz (status vs bozulmasın)
await redis.set(outputMetaKey, JSON.stringify(outputMeta));
await redis.set(outputsIndexKey, JSON.stringify(index));
await redis.set(jobKey, JSON.stringify(job));


    const play_url = `${origin}/files/play?job_id=${encodeURIComponent(
      internal_job_id
    )}&output_id=${encodeURIComponent(output_id)}`;

    return safeJson(res, {
      ok: true,
      provider_job_id,
      internal_job_id,
      state: "ready",
      output_id,
      file_key: file_key || null,
      play_url,
      mp3_url: mp3_url || play_url,
      keys: { outputsIndexKey, outputMetaKey, jobKey },
    });
  } catch (err) {
    console.error("music/finalize error:", err);
    return res.status(500).json({ ok: false, error: "server_error", message: String(err?.message || err) });
  }
};
