// api/r2/scan-upload.js
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const {
  enforceMediaPolicy,
  mediaPolicyError,
} = require("../_lib/media-policy.js");

function buildR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function safeName(name = "upload") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function streamToFile(stream, filePath) {
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(filePath);
    stream.pipe(out);
    stream.on("error", reject);
    out.on("error", reject);
    out.on("finish", resolve);
  });
}

async function downloadR2ObjectToTemp({ client, bucket, key, filename }) {
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const ext = path.extname(String(filename || key || "")).toLowerCase();
  const tempDir = path.join(os.tmpdir(), "aivo-media-policy");
  await fsp.mkdir(tempDir, { recursive: true });

  const tempName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName(
    path.basename(filename || key || "upload")
  )}`;

  const tempPath = path.join(tempDir, ext ? tempName : `${tempName}.bin`);

  if (!res.Body) {
    throw new Error("r2_object_body_missing");
  }

  await streamToFile(res.Body, tempPath);

  return {
    tempPath,
    contentType: String(res.ContentType || "").toLowerCase().trim(),
    contentLength: Number(res.ContentLength || 0),
    etag: res.ETag || null,
  };
}

async function deleteR2Object({ client, bucket, key }) {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

module.exports = async (req, res) => {
  let tempPath = null;

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      key,
      app,
      filename,
      contentType,
      public_url,
      title,
      description,
      prompt,
      personName,
      style,
      source,
    } = req.body || {};

    const objectKey = String(key || "").trim();
    const normalizedApp = String(app || "").toLowerCase().trim();
    const finalName = String(filename || path.basename(objectKey || "") || "").trim();

    if (!objectKey) {
      return res.status(400).json({ ok: false, error: "missing_key" });
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_BASE;

    if (!accountId || !bucket || !publicBase) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }

    const client = buildR2Client();

    const downloaded = await downloadR2ObjectToTemp({
      client,
      bucket,
      key: objectKey,
      filename: finalName || objectKey,
    });

    tempPath = downloaded.tempPath;

    const effectiveContentType = String(
      downloaded.contentType || contentType || ""
    ).toLowerCase();

    const policyResult = await enforceMediaPolicy({
      app: normalizedApp,
      filePath: tempPath,
      fileName: finalName || path.basename(objectKey),
      mimeType: effectiveContentType,
      source: source || "scan_upload",
      title: title || finalName || path.basename(objectKey),
      description: description || finalName || path.basename(objectKey),
      prompt: prompt || "",
      personName: personName || "",
      style: style || "",
    });

    if (policyResult && policyResult.decision === "block") {
      try {
        await deleteR2Object({ client, bucket, key: objectKey });
      } catch (deleteErr) {
        console.error("scan-upload delete temp object error:", deleteErr);
      }

      return res.status(403).json({
        ...mediaPolicyError(policyResult),
        key: objectKey,
        deleted_temp_object: true,
      });
    }

    return res.status(200).json({
      ok: true,
      decision: policyResult?.decision || "allow",
      key: objectKey,
      public_url:
        public_url || `${publicBase.replace(/\/$/, "")}/${objectKey}`,
      policy: policyResult || null,
      object: {
        content_type: effectiveContentType || null,
        content_length: downloaded.contentLength || 0,
        etag: downloaded.etag || null,
      },
    });
  } catch (err) {
    console.error("scan-upload error:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  } finally {
    if (tempPath) {
      try {
        await fsp.unlink(tempPath);
      } catch (_) {}
    }
  }
};
