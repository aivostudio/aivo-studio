// api/jobs/status.js
// CommonJS

const { neon } = require("@neondatabase/serverless");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function isUuidLike(id) {
  return /^[0-9a-f-]{36}$/i.test(String(id || ""));
}

function cleanBase(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

function hasPersistentOutput(outputs, baseUrl) {
  const base = cleanBase(baseUrl || "");
  if (!base) return false;
  if (!Array.isArray(outputs)) return false;
  return outputs.some((o) => typeof o?.url === "string" && o.url.startsWith(base + "/outputs/"));
}

async function fetchRunwayTask(taskId) {
  const key = process.env.RUNWAYML_API_SECRET;
  if (!key) return { ok: false };

  const r = await fetch(
    `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
      },
    }
  );

  if (!r.ok) return { ok: false };
  const j = await r.json().catch(() => null);
  return { ok: true, task: j };
}

// --- R2 client (CommonJS) ---
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function copyUrlToR2({ url, key, contentType = "application/octet-stream" }) {
  const Bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE;
  if (!Bucket) throw new Error("missing_env:R2_BUCKET");
  if (!publicBase) throw new Error("missing_env:R2_PUBLIC_BASE_URL");
  if (!url) throw new Error("missing_url");

  const r = await fetch(url);
  if (!r.ok) throw new Error(`copy_fetch_failed:${r.status}`);

  const ct = contentType || r.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await r.arrayBuffer());

  await r2.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: buf,
      ContentType: ct,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${cleanBase(publicBase)}/${key}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false });
    }

    res.setHeader("Cache-Control", "no-store");

    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    // --- DB bağlantı ---
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    const sql = neon(conn);

    // --- DB’den job çek ---
    const rows = await sql`
      select * from jobs
      where id = ${job_id}
      limit 1
    `;

    let job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    const provider = String(job.provider || "").toLowerCase();
    const requestId = job.request_id || job.meta?.request_id || null;

    const publicBase = process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE;

    // Eğer zaten kalıcı output varsa, status sadece onu dönsün
    if (hasPersistentOutput(job.outputs, publicBase)) {
      const first = Array.isArray(job.outputs) ? job.outputs.find((o) => o?.type === "video") : null;
      return res.status(200).json({
        ok: true,
        job_id,
        status: job.status === "failed" ? "error" : "ready",
        video: first?.url ? { url: first.url } : null,
        outputs: job.outputs || [],
      });
    }

    let persistentVideoUrl = null;

    // --- Runway ise poll et ---
    if (provider === "runway" && requestId && isUuidLike(requestId)) {
      const rr = await fetchRunwayTask(requestId);

      if (rr.ok) {
        const st = String(rr.task?.status || "").toUpperCase();

        const outArr = Array.isArray(rr.task?.output) ? rr.task.output : [];
        const rawUrl =
          outArr.find((x) => typeof x === "string" && x.startsWith("http")) || null;

        if ((st === "SUCCEEDED" || st === "COMPLETED") && rawUrl) {
          // ✅ Final kalıcı path şeması
          const key = `outputs/video/${job_id}/runway/${requestId}/0.mp4`;

          // ✅ Persist to R2 (signed URL expire olsa bile artık problem yok)
          persistentVideoUrl = await copyUrlToR2({
            url: rawUrl,
            key,
            contentType: "video/mp4",
          });

          const outputs = [
            {
              type: "video",
              url: persistentVideoUrl,
              meta: { app: "video", provider: "runway", task_id: requestId, index: 0 },
            },
          ];

          // ✅ DB UPDATE artık kalıcı URL yazar
          await sql`
            update jobs
            set status = 'completed',
                outputs = ${JSON.stringify(outputs)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.status = "completed";
          job.outputs = outputs;
        }
      }
    }

    // ✅ Proxy artık kalıcı outputlarda kullanılmıyor
    const first = Array.isArray(job.outputs) ? job.outputs.find((o) => o?.type === "video") : null;

    return res.status(200).json({
      ok: true,
      job_id,
      status:
        job.status === "completed"
          ? "ready"
          : job.status === "failed"
          ? "error"
          : "processing",
      video: first?.url ? { url: first.url } : null,
      outputs: job.outputs || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
