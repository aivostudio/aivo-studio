// /api/atmo/finalize.js
// CommonJS
// Atmo finalize:
// input: provider / mux / final url
// işlem: ffmpeg remux + faststart
// output: R2 final mp4 + DB meta.final_video_url

const { neon } = require("@neondatabase/serverless");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function isUuidLike(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

function pickUrl(o) {
  return String(
    o?.archive_url ||
    o?.url ||
    o?.video_url ||
    o?.meta?.archive_url ||
    o?.meta?.url ||
    o?.meta?.video_url ||
    ""
  ).trim();
}

function normVariant(o) {
  return String(o?.meta?.variant || "").toLowerCase().trim();
}

function isVideo(o) {
  return String(o?.type || "").toLowerCase().trim() === "video";
}

function removeFinalFlags(outputs) {
  const arr = Array.isArray(outputs) ? outputs.slice() : [];
  return arr.map((o) => {
    if (!o || !o.meta) return o;
    return {
      ...o,
      meta: {
        ...(o.meta || {}),
        is_final: false,
      },
    };
  });
}

function upsertFinalizedOutput(outputs, finalUrl) {
  let arr = removeFinalFlags(outputs);

  const idx = arr.findIndex(
    (o) => isVideo(o) && normVariant(o) === "finalized"
  );

  const item = {
    type: "video",
    url: finalUrl,
    meta: {
      app: "atmo",
      variant: "finalized",
      is_final: true,
    },
  };

  if (idx >= 0) {
    arr[idx] = {
      ...(arr[idx] || {}),
      ...item,
      meta: { ...((arr[idx] || {}).meta || {}), ...(item.meta || {}) },
    };
    return arr;
  }

  arr.unshift(item);
  return arr;
}

function getR2Client() {
  if (!process.env.R2_ENDPOINT) throw new Error("missing_env:R2_ENDPOINT");
  if (!process.env.R2_ACCESS_KEY_ID) throw new Error("missing_env:R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("missing_env:R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadFileToR2({ filePath, key, contentType }) {
  if (!process.env.R2_BUCKET) throw new Error("missing_env:R2_BUCKET");

  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    "https://media.aivo.tr";

  const r2 = getR2Client();

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType || "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${String(publicBase).replace(/\/$/, "")}/${key}`;
}

async function downloadToFile(url, outPath) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`download_failed:${r.status}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await fsp.writeFile(outPath, buf);
}

async function runFfmpegFaststart(inputPath, outputPath) {
  await new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", inputPath,
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ];

   const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg_failed:${code}:${stderr.slice(-1000)}`));
    });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let tmpDir = null;

  try {
    const body = req.body || {};
    const job_id = String(body.job_id || "").trim();

    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    if (!isUuidLike(job_id)) {
      return res.status(400).json({ ok: false, error: "job_id_invalid" });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    const rows = await sql`
      select *
      from jobs
      where id = ${job_id}::uuid
      limit 1
    `;

    const job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    if (String(job.app || "").toLowerCase() !== "atmo") {
      return res.status(400).json({ ok: false, error: "job_not_atmo" });
    }

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    const meta = job.meta || {};

 const muxOut = outputs.find((o) => isVideo(o) && normVariant(o) === "mux");
const providerOut = outputs.find((o) => isVideo(o) && normVariant(o) === "provider");
const finalizedOut = outputs.find((o) => isVideo(o) && normVariant(o) === "finalized");

const existingFinalized = pickUrl(finalizedOut);

if (existingFinalized && !body.force) {
  return res.status(200).json({
    ok: true,
    job_id,
    input_url: null,
    final_url: existingFinalized,
    skipped: true,
    reason: "already_finalized",
  });
}

const input_url =
  String(meta?.muxed_url || "").trim() ||
  pickUrl(muxOut) ||
  pickUrl(providerOut) ||
  "";

    if (!input_url) {
      return res.status(400).json({
        ok: false,
        error: "finalize_input_missing",
        job_id,
      });
    }

    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "aivo-atmo-finalize-"));
    const inputPath = path.join(tmpDir, "input.mp4");
    const outputPath = path.join(tmpDir, "finalized.mp4");

    await downloadToFile(input_url, inputPath);
    await runFfmpegFaststart(inputPath, outputPath);

    const outputId = `finalized-${Date.now()}`;
    const key = `outputs/atmo/${job_id}/${outputId}.mp4`;

    const final_url = await uploadFileToR2({
      filePath: outputPath,
      key,
      contentType: "video/mp4",
    });

    const nextOutputs = upsertFinalizedOutput(outputs, final_url);
    const patchMeta = {
      final_video_url: final_url,
      final_variant: "finalized",
      finalized_at: new Date().toISOString(),
      finalized_from_url: input_url,
      finalized_key: key,
    };

    await sql`
      update jobs
      set
        outputs = ${JSON.stringify(nextOutputs)}::jsonb,
        meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
        updated_at = now()
      where id = ${job_id}::uuid
    `;

    return res.status(200).json({
      ok: true,
      job_id,
      input_url,
      final_url,
      step: "finalized",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
};
