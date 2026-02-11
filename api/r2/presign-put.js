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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { filename, contentType, prefix } = req.body || {};
    if (!filename || !contentType) {
      return res.status(400).json({ ok: false, error: "missing_filename_or_contentType" });
    }

    // sadece image kabul (güvenlik)
    if (!String(contentType).startsWith("image/")) {
      return res.status(400).json({ ok: false, error: "invalid_contentType" });
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

    // uploads/tmp/ altında tutuyoruz (lifecycle 3 gün)
    const basePrefix = (prefix && String(prefix)) || "uploads/tmp/";
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const key = `${basePrefix}${Date.now()}-${id}-${safeName(filename)}`;

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // İstersen: CacheControl: "public, max-age=31536000, immutable",
    });

    // 10 dk geçerli upload linki
    const upload_url = await getSignedUrl(client, cmd, { expiresIn: 60 * 10 });
    const public_url = `${publicBase.replace(/\/$/, "")}/${key}`;

    return res.status(200).json({
      ok: true,
      key,
      upload_url,
      public_url,
      required_headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("presign-put error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
