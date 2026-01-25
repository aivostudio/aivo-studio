import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  try {
    const r2 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const out = await r2.send(new ListBucketsCommand({}));
    res.status(200).json({ ok: true, buckets: out.Buckets?.map(b => b.Name) ?? [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
