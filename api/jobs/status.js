// api/jobs/status.js
// CommonJS

const { neon } = require("@neondatabase/serverless");

function pickUrl(x) {
  if (!x) return null;
  return (
    x.src ||
    x.url ||
    x.play_url ||
    x.output_url ||
    x.download_url ||
    x.signed_url ||
    null
  );
}

function isUuidLike(id) {
  return /^[0-9a-f-]{36}$/i.test(String(id || ""));
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

async function copyToR2({ url, key, contentType }) {
  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    "https://media.aivo.tr";

  if (!process.env.R2_BUCKET) throw new Error("missing_env:R2_BUCKET");
  if (!process.env.R2_ENDPOINT) throw new Error("missing_env:R2_ENDPOINT");
  if (!process.env.R2_ACCESS_KEY_ID) throw new Error("missing_env:R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY)
    throw new Error("missing_env:R2_SECRET_ACCESS_KEY");

  // Lazy require (CommonJS)
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const r = await fetch(url);
  if (!r.ok) throw new Error(`copy_fetch_failed:${r.status}`);

  const ct = contentType || r.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await r.arrayBuffer());

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: ct,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const base = String(publicBase).replace(/\/$/, "");
  return `${base}/${key}`;
}

function needsPersist(url) {
  if (!url) return false;
  const u = String(url);

  // zaten kalıcıysa dokunma
  if (u.includes("media.aivo.tr/outputs/")) return false;
  if (u.includes("media.aivo.tr/outputs")) return false;

  // signed URL / provider URL ise persist edilecek
  if (u.startsWith("http://") || u.startsWith("https://")) return true;

  return false;
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

    // --- Runway poll (varsa) ---
    if (provider === "runway" && requestId && isUuidLike(requestId)) {
      const rr = await fetchRunwayTask(requestId);

      if (rr.ok) {
        const st = String(rr.task?.status || "").toUpperCase();

        const outArr = Array.isArray(rr.task?.output) ? rr.task.output : [];

        const rawUrl =
          outArr.find((x) => typeof x === "string" && x.startsWith("http")) || null;

        if ((st === "SUCCEEDED" || st === "COMPLETED") && rawUrl) {
          const outputs = [
            { type: "video", url: rawUrl, meta: { app: "video", provider: "runway" } },
          ];

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

    // --- PERSIST-TO-R2 (PROVIDER BAĞIMSIZ) ---
    let outputs = Array.isArray(job.outputs) ? job.outputs : [];

    if (job.status === "completed" || job.status === "ready") {
      let changed = false;

      const newOutputs = [];

      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i] || {};
        const rawUrl = pickUrl(o);

        // eğer url yoksa aynen ekle
        if (!rawUrl) {
          newOutputs.push(o);
          continue;
        }

        // zaten kalıcıysa aynen ekle
        if (!needsPersist(rawUrl)) {
          newOutputs.push(o);
          continue;
        }

        const type = String(o.type || "").toLowerCase();

        // app belirle
        const app =
          o.meta?.app ||
          job.app ||
          (type === "video" ? "video" : type === "audio" ? "music" : "cover");

        // output_id belirle (stabil olsun)
        const output_id =
          o.output_id ||
          o.id ||
          requestId ||
          `${job_id}-${i}`;

        // extension
        const ext =
          type === "video"
            ? "mp4"
            : type === "audio"
            ? "mp3"
            : type === "image"
            ? "jpg"
            : "bin";

        const key = `outputs/${app}/${job_id}/${output_id}.${ext}`;

        try {
          const finalUrl = await copyToR2({
            url: rawUrl,
            key,
            contentType:
              type === "video"
                ? "video/mp4"
                : type === "audio"
                ? "audio/mpeg"
                : type === "image"
                ? "image/jpeg"
                : "application/octet-stream",
          });

          changed = true;

          newOutputs.push({
            ...o,
            type: o.type || type || "file",
            url: finalUrl,
            output_id,
            meta: {
              ...(o.meta || {}),
              app,
              persisted: true,
              persisted_at: new Date().toISOString(),
            },
          });
        } catch (e) {
          console.error("persist_to_r2_failed", e);

          // persist başarısızsa eski url ile devam et (UI yine proxy kullanır)
          newOutputs.push(o);
        }
      }

      if (changed) {
        outputs = newOutputs;

        await sql`
          update jobs
          set outputs = ${JSON.stringify(outputs)}::jsonb,
              updated_at = now()
          where id = ${job_id}
        `;

        job.outputs = outputs;
      }
    }

    // --- RESPONSE NORMALIZE ---
    const outVideo =
      outputs.find((x) => String(x?.type).toLowerCase() === "video") || null;

    const outAudio =
      outputs.find((x) => String(x?.type).toLowerCase() === "audio") || null;

    const outImage =
      outputs.find((x) => String(x?.type).toLowerCase() === "image") || null;

    return res.status(200).json({
      ok: true,
      job_id,
      status:
        job.status === "completed"
          ? "ready"
          : job.status === "failed"
          ? "error"
          : "processing",
      video: outVideo ? { url: outVideo.url } : null,
      audio: outAudio ? { url: outAudio.url } : null,
      image: outImage ? { url: outImage.url } : null,
      outputs: outputs || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
