import formidable from "formidable";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const config = { api: { bodyParser: false } };

function getR2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID) throw new Error("missing_env_R2_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) throw new Error("missing_env_R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) throw new Error("missing_env_R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET) throw new Error("missing_env_R2_BUCKET");

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return { client, bucket: R2_BUCKET };
}

function parseMultipart(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filter: (part) => (part.name === "image" ? (part.mimetype || "").startsWith("image/") : true),
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

async function uploadToR2AndGetUrl(file, { app = "video" } = {}) {
  const { client, bucket } = getR2();

  const fs = await import("fs/promises");
  const buf = await fs.readFile(file.filepath);

  const ext = (file.originalFilename || "").split(".").pop() || "jpg";
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
  const key = `uploads/${app}/${Date.now()}_${hash}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: file.mimetype || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  // varsa CDN/custom domain: direkt public URL
  const { R2_PUBLIC_BASE_URL } = process.env;
  if (R2_PUBLIC_BASE_URL) return `${R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;

  // yoksa signed URL (1 saat)
  return await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 * 60 }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });
    }

    // ✅ multipart parse (FormData)
    const { fields, files } = await parseMultipart(req);

    const prompt = (fields.prompt || "").toString().trim();
    const model = (fields.model || "veo3.1_fast").toString();
    const seconds = Number(fields.seconds || 8);
    const aspect_ratio = (fields.aspect_ratio || "16:9").toString();

    if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });

    const ratioMap = {
      "16:9": "1280:720",
      "9:16": "720:1280",
      "4:3": "1104:832",
      "1:1": "960:960",
      "3:4": "832:1104",
    };

    const basePayload = {
      model,
      promptText: prompt,
      duration: seconds,
      ratio: ratioMap[aspect_ratio] || ratioMap["16:9"],
    };

    const imageFile = files.image ? (Array.isArray(files.image) ? files.image[0] : files.image) : null;

    let runwayUrl = "https://api.dev.runwayml.com/v1/text_to_video";
    let runwayPayload = basePayload;

    if (imageFile) {
      const image_url = await uploadToR2AndGetUrl(imageFile, { app: "video" });
      runwayUrl = "https://api.dev.runwayml.com/v1/image_to_video";
      runwayPayload = { ...basePayload, promptImage: image_url };
    }

    const r = await fetch(runwayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(runwayPayload),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "runway_create_failed",
        details: data,
        sent: runwayPayload,
        url: runwayUrl,
      });
    }

    const request_id = data.id || data.task_id || data.request_id;
    if (!request_id) {
      return res.status(500).json({ ok: false, error: "runway_missing_request_id", raw: data });
    }

    return res.status(200).json({
      ok: true,
      job_id: request_id,
      request_id,
      status: "IN_QUEUE",
      outputs: [],
      raw: data,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
