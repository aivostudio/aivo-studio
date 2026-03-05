// api/music/master.js (CommonJS) - Vercel Node Serverless
const fs = require("fs");
const { execFile } = require("child_process");
const { neon } = require("@neondatabase/serverless");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

// getRedis optional (bu repo'da ../_kv varsa kullanır)
let getRedis = null;
try {
  // eslint-disable-next-line import/no-dynamic-require
  getRedis = require("../_kv").getRedis;
} catch {}

// ---- R2 (S3-compatible) ----
let r2;
function getR2() {
  if (r2) return r2;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("missing_r2_env");
  }

  r2 = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  return r2;
}

const BUCKET = process.env.R2_BUCKET || "aivo-archive";

async function appendMasterOutputToDB({ job_id, url }) {
  const conn = pickConn();
  if (!conn) return { ok: false, skipped: true, reason: "missing_db_env" };

  const sql = neon(conn);

  // job_id: db uuid / internal_job_id / provider_job_id olabiliyor
  // - internal_job_id ör: "job_10f..." gibi geliyor
  // - DB id UUID: "xxxxxxxx-xxxx-...." gibi
  // Burada internal_job_id içindeki "job_" prefix'ini kaldırıp,
  // UUID ise "-" karakterlerini kaldırarak karşılaştırıyoruz.
  const raw = String(job_id || "").replace(/^job_/, "");

  const found = await sql`
    select id
    from jobs
    where
      -- 1) body.job_id uuid ise: uuid normalize (dashsiz)
      replace(id::text,'-','') = ${raw}

      -- 2) body.job_id internal_job_id ise: meta.internal_job_id birebir
      or meta->>'internal_job_id' = ${String(job_id || "")}

      -- 3) body.job_id "job_" prefixsiz gelirse: "job_" eklenmiş halini de dene
      or meta->>'internal_job_id' = ${`job_${raw}`}
    limit 1
  `;

  if (!found || found.length === 0) {
    return { ok: false, skipped: true, reason: "job_not_found" };
  }

  const db_job_id = found[0].id;

  const output = {
    type: "audio",
    url,
    meta: {
      app: "music",
      kind: "master",
      source_job_id: job_id,
      createdAt: new Date().toISOString(),
    },
  };

  await sql`
    update jobs
    set outputs = coalesce(outputs, '[]'::jsonb) || ${JSON.stringify([output])}::jsonb
    where id = ${db_job_id}
  `;

  return { ok: true, db_job_id };
}

function execFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout: 1000 * 120 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || "").toString().slice(-4000);
        return reject(new Error(`ffmpeg_failed: ${err.message}\n${msg}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = async (req, res) => {
  try {
    res.setHeader("x-aivo-master-build", "master-cjs-r2-upload-2026-03-05");

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const provider_job_id = body.provider_job_id ? String(body.provider_job_id) : null;
    const audio_url = body.audio_url ? String(body.audio_url) : null;
    const auto = body.auto === true;

    if (!audio_url) {
      return res.status(400).json({ ok: false, error: "missing_audio_url" });
    }

    const id = String(body.job_id || provider_job_id || Date.now());
    const inputPath = `/tmp/${id}.mp3`;
    const outPath = `/tmp/${id}.master.mp3`;

    console.log("[MASTER] start", { id, provider_job_id, auto });

    // download audio
    const response = await fetch(audio_url, {
      headers: { "User-Agent": "AIVO-Mastering" },
    });

    if (!response.ok) {
      throw new Error(`download_failed_${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    console.log("[MASTER] downloaded", inputPath, "bytes=", buffer.length);

    // ✅ MASTERING (ffmpeg) -> outPath
    // hedef: daha dolu + parlak + loud (AMA clip yok) => I=-10 LUFS / TP=-0.9 / LRA=6
    const af =
      "highpass=f=30," +
      "acompressor=ratio=2:attack=30:release=200," +
      "equalizer=f=8000:t=q:w=1:g=1.5," +
      "equalizer=f=12000:t=q:w=1:g=1," +
      "loudnorm=I=-10:TP=-0.9:LRA=6";

    await execFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-af",
      af,
      "-ar",
      "44100",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "320k",
      outPath,
    ]);

    const masteredBuffer = fs.readFileSync(outPath);
    console.log("[MASTER] mastered", outPath, "bytes=", masteredBuffer.length);

    // ✅ Upload master to R2 so media.aivo.tr can serve it
    const masterKey = `outputs/master/${id}.mp3`;

    await getR2().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: masterKey,
        Body: masteredBuffer,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const master_url = `https://media.aivo.tr/${masterKey}`;

    console.log("[MASTER] uploaded", { masterKey, master_url });

    // (best-effort) Redis marker
    try {
      if (getRedis && provider_job_id) {
        const redis = getRedis();
        await redis.set(
          `music_master:${provider_job_id}`,
          JSON.stringify({
            at: new Date().toISOString(),
            tmp: outPath,
            master_url,
            auto,
            mastering: { I: -10, TP: -0.9, LRA: 6 },
          })
        );
      }
    } catch {}

    // (best-effort) DB append
    const db = await appendMasterOutputToDB({
      job_id: String(body.job_id || provider_job_id || id),
      url: master_url,
    });

    return res.status(200).json({
      ok: true,
      job_id: id,
      provider_job_id,
      downloaded: true,
      mastering: "completed",
      tmp_in: inputPath,
      tmp_out: outPath,
      master_key: masterKey,
      master_url,
      db,
      auto,
      settings: { I: -10, TP: -0.9, LRA: 6, air8k: 1.5, air12k: 1.0, hp: 30, comp: "2:1" },
    });
  } catch (err) {
    console.error("[MASTER] error", err);
    return res.status(500).json({
      ok: false,
      error: "master_failed",
      message: err?.message || String(err),
      env: {
        R2_ENDPOINT: !!process.env.R2_ENDPOINT,
        R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET: !!process.env.R2_BUCKET,
      },
    });
  }
};
