// api/r2/presign-put.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

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

function normalizeContentType(value) {
  const ct = String(value || "").toLowerCase().trim();

  if (!ct) return "";

  if (ct === "audio/mp3") return "audio/mpeg";
  if (ct === "audio/x-wav") return "audio/wav";
  if (ct === "video/x-matroska") return "video/webm";

  return ct;
}

function getAllowedSet(app, kind) {
  const appValue = String(app || "").toLowerCase().trim();
  const kindValue = String(kind || "").toLowerCase().trim();

  if (appValue === "cartoon" && kindValue === "studio-video") {
    return ALLOWED_VIDEO;
  }

  return new Set([...ALLOWED_IMAGE, ...ALLOWED_AUDIO]);
}

export default async function handler(req, res) {
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

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    let key = finalName;

    if (!keyFromBody) {
      const basePrefix = safePrefix(
        prefix ||
          (String(app || "").toLowerCase() === "cartoon" &&
          String(kind || "").toLowerCase() === "studio-video"
            ? "uploads/cartoon/studio-video/"
            : "uploads/tmp/")
      );

      const id = crypto.randomUUID
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString("hex");

      key = `${basePrefix}${Date.now()}-${id}-${safeName(filename || "upload")}`;
    }

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
    });
  } catch (err) {
    console.error("presign-put error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
