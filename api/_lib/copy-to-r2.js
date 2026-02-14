// api/_lib/copy-to-r2.js
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./r2.js";

function cleanBase(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

export async function copyUrlToR2({ url, key, contentType }) {
  const publicBase =
    process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE; // <-- FIX

  if (!publicBase) {
    throw new Error("missing_env:R2_PUBLIC_BASE_URL (or R2_PUBLIC_BASE)");
  }

  if (!url) throw new Error("missing_url");

  const r = await fetch(url);
  if (!r.ok) throw new Error(`copy_fetch_failed:${r.status}`);

  const ct = contentType || r.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await r.arrayBuffer());

  const put = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key || `covers/${crypto.randomUUID()}.jpg`,
    Body: buf,
    ContentType: ct,
    CacheControl: "public, max-age=31536000, immutable",
  });

  await r2.send(put);

  const base = cleanBase(publicBase);
  const finalKey = put.input.Key;
  return `${base}/${finalKey}`;
}
