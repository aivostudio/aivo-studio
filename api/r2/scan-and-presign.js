// api/r2/scan-and-presign.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
// bu blok tamamen silinecek

function safeName(name = "upload") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function safePrefix(p) {
  const s = String(p || "uploads/tmp/");
  const cleaned = s.replace(/[^a-zA-Z0-9/_-]+/g, "");
  const withSlash = cleaned.endsWith("/") ? cleaned : cleaned + "/";
  return withSlash.length >= 3 ? withSlash : "uploads/tmp/";
}

function normalizeContentType(value) {
  const ct = String(value || "").toLowerCase().trim();

  if (!ct) return "";
  if (ct === "audio/mp3") return "audio/mpeg";
  if (ct === "audio/x-wav") return "audio/wav";
  if (ct === "video/x-matroska") return "video/webm";

  return ct;
}

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_AUDIO = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

const ALLOWED_VIDEO = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function getAllowedSet(app, kind) {
  const appValue = String(app || "").toLowerCase().trim();
  const kindValue = String(kind || "").toLowerCase().trim();

  if (appValue === "cartoon" && kindValue === "studio-video") {
    return ALLOWED_VIDEO;
  }

  return new Set([...ALLOWED_IMAGE, ...ALLOWED_AUDIO]);
}

function isImageContentType(ct) {
  return String(ct || "").startsWith("image/");
}

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

function makeObjectKey({ app, prefix, filename, keyFromBody }) {
  if (keyFromBody) return String(keyFromBody).trim();

  const appValue = String(app || "").toLowerCase().trim();

  const basePrefix = safePrefix(
    prefix || (appValue ? `uploads/${appValue}/tmp/` : "uploads/tmp/")
  );

  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

  return `${basePrefix}${Date.now()}-${id}-${safeName(filename || "upload")}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      filename,
      contentType,
      key: keyFromBody,
      prefix,
      app,
      kind,
      title,
      description,
      prompt,
      personName,
      style,
      source,
    } = req.body || {};

    const finalName = String(keyFromBody || filename || "").trim();
    if (!finalName || !contentType) {
      return res
        .status(400)
        .json({ ok: false, error: "missing_filename_or_contentType" });
    }

    const ct = normalizeContentType(contentType);
    const allowedSet = getAllowedSet(app, kind);
    const isAllowed = allowedSet.has(ct);

    if (!isAllowed) {
      return res.status(400).json({
        ok: false,
        error: "invalid_contentType",
        allowed: {
          image: Array.from(ALLOWED_IMAGE),
          audio: Array.from(ALLOWED_AUDIO),
          video: Array.from(ALLOWED_VIDEO),
        },
      });
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_BASE;

    if (!accountId || !bucket || !publicBase) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }
const normalizedApp = String(app || "").toLowerCase().trim();
    const client = buildR2Client();
    const key = makeObjectKey({
      app: normalizedApp,
      prefix,
      filename: finalName,
      keyFromBody,
    });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: ct,
    });

    const upload_url = await getSignedUrl(client, cmd, { expiresIn: 60 * 10 });
    const public_url = `${publicBase.replace(/\/$/, "")}/${key}`;

 return res.status(200).json({
  ok: true,
  key,
  upload_url,
  public_url,
  required_headers: { "Content-Type": ct },
  policy: {
    scanned: false,
    decision: "pending_scan",
  },
});
  } catch (err) {
    console.error("scan-and-presign error:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
};
