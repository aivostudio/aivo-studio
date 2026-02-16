// api/_lib/r2.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 S3 client
 * ENV:
 *  - R2_ENDPOINT (https://<accountid>.r2.cloudflarestorage.com)
 *  - R2_ACCESS_KEY_ID
 *  - R2_SECRET_ACCESS_KEY
 *  - R2_BUCKET
 *  - R2_PUBLIC_BASE_URL (https://media.aivo.tr)
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true, // ✅ R2 için kritik
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function putObject({
  key,
  body,
  contentType = "application/octet-stream",
  cacheControl = "public, max-age=31536000, immutable",
  contentDisposition = "inline", // ✅ video/audio browser playback için iyi
}) {
  const Bucket = process.env.R2_BUCKET;
  if (!Bucket) throw new Error("missing_env:R2_BUCKET");

  await r2.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
      ContentDisposition: contentDisposition,
    })
  );

  const base =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    "https://media.aivo.tr";

  return `${String(base).replace(/\/$/, "")}/${key}`;
}
