async function copyToR2({ url, key, contentType }) {
  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    "https://media.aivo.tr";

  if (!process.env.R2_BUCKET) throw new Error("missing_env:R2_BUCKET");
  if (!process.env.R2_ENDPOINT) throw new Error("missing_env:R2_ENDPOINT");
  if (!process.env.R2_ACCESS_KEY_ID)
    throw new Error("missing_env:R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY)
    throw new Error("missing_env:R2_SECRET_ACCESS_KEY");

  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true, // ✅ R2 için kritik
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const r = await fetch(url);

  if (!r.ok) {
    throw new Error(`copy_fetch_failed:${r.status}`);
  }

  const ct =
    contentType || r.headers.get("content-type") || "application/octet-stream";

  // ✅ STREAM upload (RAM patlatmaz)
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: r.body, // 🔥 stream
      ContentType: ct,
      CacheControl: "public, max-age=31536000, immutable",
      ContentDisposition: "inline",
    })
  );

  const base = String(publicBase).replace(/\/$/, "");
  return `${base}/${key}`;
}

function needsPersist(url) {
  if (!url) return false;
  const u = String(url);

  // ✅ Eğer zaten R2 public domain ise tekrar persist etme
  if (u.startsWith("https://media.aivo.tr/")) return false;

  // provider / signed url ise persist et
  if (u.startsWith("http://") || u.startsWith("https://")) return true;

  return false;
}
