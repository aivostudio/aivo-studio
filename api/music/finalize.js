// api/music/finalize.js
const { getRedis } = require("../_kv");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

function nowISO() {
  return new Date().toISOString();
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

let r2;
function getR2() {
  if (r2) return r2;

  r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  return r2;
}

const BUCKET = process.env.R2_BUCKET || "aivo-archive";

async function putJson(key, data) {
  await getR2().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
    })
  );
}

async function getJsonOrNull(key) {
  try {
    const r = await getR2().send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );

    const chunks = [];
    for await (const chunk of r.Body) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(text);
  } catch (e) {
    // Not found vb. durumlarda null dönelim
    return null;
  }
}

module.exports = async (req, res) => {
  // build/header debug
  res.setHeader("x-aivo-finalize-build", "finalize-v3-r2-index-append-2026-02-07");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const body = req.body || {};

    const provider_job_id = String(body.provider_job_id || "").trim();
    const mp3_url = String(body.mp3_url || "").trim();

    if (!provider_job_id) {
      return res.status(400).json({ ok: false, error: "missing_provider_job_id" });
    }
    if (!mp3_url) {
      return res.status(400).json({ ok: false, error: "missing_mp3_url" });
    }

    // provider → internal map
    const mapRaw = await redis.get(`provider_map:${provider_job_id}`);
    const map = mapRaw ? JSON.parse(mapRaw) : null;
    const internal_job_id = map?.internal_job_id;

    if (!internal_job_id) {
      return res.status(404).json({ ok: false, error: "internal_job_not_found" });
    }

    // Yeni output_id
    const output_id = "out_" + uuid();

    // R2 paths
    const indexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const outputMetaKey = `jobs/${internal_job_id}/outputs/${output_id}.json`;

    // 🔑 Worker/play genelde buradan mp3 buluyor (gerekirse değiştir)
    const file_key = `jobs/${internal_job_id}/outputs/${output_id}.mp3`;

    // Output meta — worker/status/player uyumlu
    const outputMeta = {
      job_id: internal_job_id,
      output_id,
      id: output_id,
      status: "ready",
      state: "ready",
      kind: "audio",
      type: "audio",
      content_type: "audio/mpeg",
      mime: "audio/mpeg",
      filename: `${output_id}.mp3`,
      file_key,
      // Referans amaçlı (zorunlu değil)
      mp3_url,
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    // ✅ index.json append (overwrite yok)
    const currentIndex = (await getJsonOrNull(indexKey)) || {};
    const prev = Array.isArray(currentIndex.outputs) ? currentIndex.outputs : [];

    // duplicate koruması (her ihtimale)
    const nextOutputs = prev.includes(output_id) ? prev : [...prev, output_id];

    const nextIndex = { outputs: nextOutputs, updated_at: nowISO() };

    // R2 write
    await putJson(outputMetaKey, outputMeta);
    await putJson(indexKey, nextIndex);

    // Redis write (okunmayabilir ama faydalı)
    // Not: Burada R2 key'lerini setlemek yerine "job:<id>" gibi consumer'ın okuduğu yerlere yazmak daha önemli.
    await redis.set(outputMetaKey, JSON.stringify(outputMeta));
    await redis.set(indexKey, JSON.stringify(nextIndex));

    // Job objesini güncelle
    const jobKey = `job:${internal_job_id}`;
    const jobRaw = await redis.get(jobKey);
    const job = jobRaw ? JSON.parse(jobRaw) : {};

    const play_url = `/files/play?job_id=${encodeURIComponent(internal_job_id)}&output_id=${encodeURIComponent(output_id)}`;

    job.id = job.id || internal_job_id;
    job.job_id = job.job_id || internal_job_id;
    job.status = "ready";
    job.state = "ready";
    job.updated_at = nowISO();

    // outputs listesi (append)
    const jobOutputs = Array.isArray(job.outputs) ? job.outputs : [];
    job.outputs = [
      ...jobOutputs,
      {
        id: output_id,
        output_id,
        type: "audio",
        kind: "audio",
        status: "ready",
        file_key,
        content_type: "audio/mpeg",
      },
    ];

    // UI tarafı için kritik: audio.src
    job.audio = job.audio || {};
    job.audio.src = job.audio.src || play_url;
    job.audio.output_id = job.audio.output_id || output_id;

    await redis.set(jobKey, JSON.stringify(job));

    return res.json({
      ok: true,
      provider_job_id,
      internal_job_id,
      output_id,
      file_key,
      index_key: indexKey,
      output_meta_key: outputMetaKey,
      play_url,
    });
  } catch (err) {
    console.error("finalize error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
