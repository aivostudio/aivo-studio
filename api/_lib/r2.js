// api/_lib/r2.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
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
    })
  );

  const base = process.env.R2_PUBLIC_BASE_URL; // örn: https://cdn.aivo.tr
  if (!base) throw new Error("missing_env:R2_PUBLIC_BASE_URL");

  return `${base.replace(/\/$/, "")}/${key}`;
}
