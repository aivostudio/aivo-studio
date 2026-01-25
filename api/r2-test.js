import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  try {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    // Basit ENV kontrolü (secret’ı loglamaz)
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing env",
        missing: {
          R2_ENDPOINT: !endpoint,
          R2_ACCESS_KEY_ID: !accessKeyId,
          R2_SECRET_ACCESS_KEY: !secretAccessKey,
        },
      });
    }

    const r2 = new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });

    const out = await r2.send(new ListBucketsCommand({}));

    return res.status(200).json({
      ok: true,
      buckets: (out.Buckets || []).map((b) => b.Name),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      name: e?.name,
      error: e?.message || String(e),
      // bazen AWS SDK detayları burada olur
      $metadata: e?.$metadata,
    });
  }
}
