// api/music/finalize.js
const { getRedis } = require("../_kv");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function nowISO() {
  return new Date().toISOString();
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
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

async function putJson(key, data) {
  await getR2().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET || "aivo-archive",
    Key: key,
    Body: JSON.stringify(data),
    ContentType: "application/json; charset=utf-8",
  }));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const redis = getRedis();
    const body = req.body || {};

    const provider_job_id = String(body.provider_job_id || "").trim();
    const mp3_url = String(body.mp3_url || "").trim();

    if (!provider_job_id || !mp3_url) {
      return res.status(400).json({ ok: false, error: "missing_params" });
    }

    // provider → internal map
    const mapRaw = await redis.get(`provider_map:${provider_job_id}`);
    const map = mapRaw ? JSON.parse(mapRaw) : null;
    const internal_job_id = map?.internal_job_id;

    if (!internal_job_id) {
      return res.status(404).json({ ok: false, error: "internal_job_not_found" });
    }

    const output_id = "out_" + uuid();

    const outputMeta = {
      id: output_id,
      type: "audio",
      kind: "audio",
      mime: "audio/mpeg",
      mp3_url,
      created_at: nowISO(),
    };

    const indexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const outputKey = `jobs/${internal_job_id}/outputs/${output_id}.json`;
    const jobKey = `job:${internal_job_id}`;

    // R2 write
    await putJson(outputKey, outputMeta);
    await putJson(indexKey, { outputs: [output_id] });

    // Redis write
    await redis.set(outputKey, JSON.stringify(outputMeta));
    await redis.set(indexKey, JSON.stringify({ outputs: [output_id] }));

    const jobRaw = await redis.get(jobKey);
    const job = jobRaw ? JSON.parse(jobRaw) : {};
    job.status = "ready";
    job.state = "ready";
    job.outputs = [{ id: output_id, type: "audio" }];
    job.updated_at = nowISO();

    await redis.set(jobKey, JSON.stringify(job));

    return res.json({
      ok: true,
      provider_job_id,
      internal_job_id,
      output_id,
      play_url: `/files/play?job_id=${internal_job_id}&output_id=${output_id}`,
    });

  } catch (err) {
    console.error("finalize error:", err);
    return res.status(500).json({ ok: false });
  }
};
