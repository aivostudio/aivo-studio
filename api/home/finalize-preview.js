// /api/home/finalize-preview.js
// CommonJS
// Home preview finalize:
// input: slug + input_url
// işlem: ffmpeg faststart + hafif preview encode + R2 upload
// output: final_url + preview_url

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const ALLOWED_SLUGS = new Set(["hero", "atmo", "cartoon", "photofx"]);

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
  const r = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  if (!r.ok) {
    throw new Error(`download_failed:${r.status}`);
  }

  const buf = Buffer.from(await r.arrayBuffer());
  await fsp.writeFile(outPath, buf);
}

async function verifyPublicUrl(url, label) {
  if (!url) throw new Error(`public_url_missing:${label}`);

  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, {
        method,
        cache: "no-store",
        redirect: "follow",
      });

      if (r.ok) {
        return {
          ok: true,
          status: r.status,
          method,
          contentType: r.headers.get("content-type") || "",
          contentLength: r.headers.get("content-length") || "",
        };
      }
    } catch (_) {}
  }

  throw new Error(`public_url_unreachable:${label}:${url}`);
}

async function runFfmpegFaststart(inputPath, outputPath) {
  await new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
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
      reject(new Error(`ffmpeg_faststart_failed:${code}:${stderr.slice(-1000)}`));
    });
  });
}

async function runFfmpegPreview(inputPath, outputPath) {
  await new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale='min(960,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-shortest",
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
      reject(new Error(`ffmpeg_preview_failed:${code}:${stderr.slice(-1000)}`));
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
    const slug = String(body.slug || "").trim().toLowerCase();
    const input_url = String(body.input_url || "").trim();

    if (!slug) {
      return res.status(400).json({ ok: false, error: "slug_required" });
    }

    if (!ALLOWED_SLUGS.has(slug)) {
      return res.status(400).json({
        ok: false,
        error: "slug_invalid",
        allowed: Array.from(ALLOWED_SLUGS),
      });
    }

    if (!input_url) {
      return res.status(400).json({ ok: false, error: "input_url_required" });
    }

    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "aivo-home-finalize-"));

    const inputPath = path.join(tmpDir, `${slug}-input.mp4`);
    const finalPath = path.join(tmpDir, `${slug}-final.mp4`);
    const previewPath = path.join(tmpDir, `${slug}-preview.mp4`);

    await downloadToFile(input_url, inputPath);
    await runFfmpegFaststart(inputPath, finalPath);
    await runFfmpegPreview(finalPath, previewPath);

    const ts = Date.now();
    const finalKey = `outputs/home/${slug}/${slug}-final-${ts}.mp4`;
    const previewKey = `outputs/home/${slug}/${slug}-preview-${ts}.mp4`;

    const final_url = await uploadFileToR2({
      filePath: finalPath,
      key: finalKey,
      contentType: "video/mp4",
    });

    await verifyPublicUrl(final_url, "final");

    const preview_url = await uploadFileToR2({
      filePath: previewPath,
      key: previewKey,
      contentType: "video/mp4",
    });

    await verifyPublicUrl(preview_url, "preview");

    return res.status(200).json({
      ok: true,
      slug,
      input_url,
      final_url,
      preview_url,
      final_key: finalKey,
      preview_key: previewKey,
      step: "home_preview_finalized",
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
      } catch (_) {}
    }
  }
};
