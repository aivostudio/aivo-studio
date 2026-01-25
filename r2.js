import 'dotenv/config';
import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;      // Account ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY; // API Token
const R2_BUCKET = process.env.R2_BUCKET;

export const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 1) bağlantı testi
export async function testR2() {
  const out = await r2.send(new ListBucketsCommand({}));
  return out.Buckets?.map(b => b.Name) ?? [];
}

// 2) küçük upload testi
export async function putTestObject() {
  const key = `test/hello-${Date.now()}.txt`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: "hello from node",
    ContentType: "text/plain",
  }));
  return key;
}
