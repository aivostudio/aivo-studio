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

/**
 * ✅ DB enum job_status sadece: queued | processing | done | error
 * Provider status’larını DB’ye yazmadan önce buraya normalize et.
 */
function normalizeJobStatus(input) {
  const s = String(input || "").trim().toLowerCase();

  // provider "ready/completed/succeeded" vb
  if (s === "completed" || s === "complete" || s === "ready" || s === "succeeded" || s === "success")
    return "done";

  // provider "processing/in_progress" vb
  if (s === "processing" || s === "in_progress" || s === "running" || s === "started")
    return "processing";

  // provider "queued/in_queue" vb
  if (s === "queued" || s === "in_queue" || s === "pending")
    return "queued";

  // provider "failed/error/canceled" vb
  if (s === "failed" || s === "error" || s === "canceled" || s === "cancelled")
    return "error";

  // DB enum’e uymayan her şeyi güvenli default’a çek
  return "processing";
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
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("missing_env:R2_SECRET_ACCESS_KEY");

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

  // signed/provider url ise persist edilecek
  if (u.startsWith("http://") || u.startsWith("https://")) return true;

  return false;
}

function pickRunwayVideoUrl(task) {
  if (!task) return null;

  const output = task.output ?? task.outputs ?? task.result ?? null;

  if (typeof output === "string" && output.startsWith("http")) return output;

  if (Array.isArray(output)) {
    const hit = output.find(
      (x) =>
        (typeof x === "string" && x.startsWith("http")) ||
        (x?.url && String(x.url).startsWith("http")) ||
        (x?.src && String(x.src).startsWith("http"))
    );
    if (!hit) return null;
    return typeof hit === "string" ? hit : hit.url || hit.src || null;
  }

  if (output && typeof output === "object") {
    const u = output.url || output.src || output.video_url || null;
    if (u && String(u).startsWith("http")) return u;
  }

  if (task?.output?.video_url && String(task.output.video_url).startsWith("http"))
    return task.output.video_url;

  return null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
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

    if (!conn) {
      return res.status(500).json({
        ok: false,
        error: "missing_db_env",
        hint:
          "Set one of POSTGRES_URL_NON_POOLING / DATABASE_URL / POSTGRES_URL / DATABASE_URL_UNPOOLED",
      });
    }

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

    // ✅ Bizim DB kolonumuz enum: job_status (queued/processing/done/error)
    // Bazı eski kayıtlar "status" kolonu da taşıyabilir. Güvenli oku:
    job.job_status = job.job_status || job.status || "processing";

    const provider = String(job.provider || "").toLowerCase();
    const requestId = job.request_id || job.meta?.request_id || null;

    // --- Runway poll (varsa) ---
    if (provider === "runway" && requestId && isUuidLike(requestId)) {
      const rr = await fetchRunwayTask(requestId);

      if (rr.ok) {
        const stRaw = String(rr.task?.status || rr.task?.state || "").toUpperCase();

        // Runway output url
        const rawUrl = pickRunwayVideoUrl(rr.task);

        // provider -> DB enum normalize
        const mapped =
          (stRaw === "SUCCEEDED" || stRaw === "COMPLETED") ? "done"
          : (stRaw === "FAILED" || stRaw === "ERROR" || stRaw === "CANCELED" || stRaw === "CANCELLED") ? "error"
          : (stRaw === "IN_QUEUE" || stRaw === "QUEUED") ? "queued"
          : (stRaw === "IN_PROGRESS" || stRaw === "PROCESSING" || stRaw === "RUNNING") ? "processing"
          : "processing";

        // ✅ DONE + output varsa DB’ye yaz
        if (mapped === "done" && rawUrl) {
          const outputs = [
            { type: "video", url: rawUrl, meta: { app: "video", provider: "runway" } },
          ];

          await sql`
            update jobs
            set job_status = ${normalizeJobStatus(mapped)}::job_status,
                outputs = ${JSON.stringify(outputs)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.job_status = "done";
          job.outputs = outputs;
        }

        // ✅ ERROR
        else if (mapped === "error") {
          const failureMessage =
            rr.task?.failure ||
            rr.task?.error ||
            rr.task?.failureMessage ||
            rr.task?.failure_message ||
            rr.task?.message ||
            null;

          const failureCode =
            rr.task?.failureCode ||
            rr.task?.failure_code ||
            rr.task?.code ||
            null;

          const patchMeta = {
            runway: {
              status: stRaw,
              failure: failureMessage,
              failureCode: failureCode,
              task_id: requestId,
              updated_at: new Date().toISOString(),
            },
          };

          await sql`
            update jobs
            set job_status = 'error'::job_status,
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.job_status = "error";
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }

        // ✅ queued / processing ise DB enum’e uygun şekilde yaz (istersen bunu kapatabilirsin)
        else {
          await sql`
            update jobs
            set job_status = ${normalizeJobStatus(mapped)}::job_status,
                updated_at = now()
            where id = ${job_id}
          `;
          job.job_status = normalizeJobStatus(mapped);
        }
      }
    }

    // --- PERSIST-TO-R2 (PROVIDER BAĞIMSIZ) ---
    let outputs = Array.isArray(job.outputs) ? job.outputs : [];

    // ✅ sadece DONE iken persist
    if (job.job_status === "done") {
      let changed = false;
      const newOutputs = [];

      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i] || {};
        const rawUrl = pickUrl(o);

        if (!rawUrl) {
          newOutputs.push(o);
          continue;
        }

        if (!needsPersist(rawUrl)) {
          newOutputs.push(o);
          continue;
        }

        const type = String(o.type || "").toLowerCase();

        const app =
          o.meta?.app ||
          job.app ||
          (type === "video" ? "video" : type === "audio" ? "music" : "cover");

        const output_id = o.output_id || o.id || requestId || `${job_id}-${i}`;

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

    const failureReason =
      job?.meta?.runway?.failure ||
      job?.meta?.failure ||
      null;

    // ✅ UI mapping:
    // queued/processing/done/error -> processing/ready/error
    const uiStatus =
      job.job_status === "done" ? "ready" :
      job.job_status === "error" ? "error" :
      "processing";

    return res.status(200).json({
      ok: true,
      job_id,
      status: uiStatus,
      error_reason: job.job_status === "error" ? (failureReason || "provider_failed") : null,
      video: outVideo ? { url: outVideo.url } : null,
      audio: outAudio ? { url: outAudio.url } : null,
      image: outImage ? { url: outImage.url } : null,
      outputs: outputs || [],
    });
  } catch (err) {
    console.error("jobs/status server_error:", err);

    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(err?.message || err),
      stack: String(err?.stack || ""),
      has_db_env: Boolean(
        process.env.POSTGRES_URL_NON_POOLING ||
          process.env.DATABASE_URL ||
          process.env.POSTGRES_URL ||
          process.env.DATABASE_URL_UNPOOLED
      ),
    });
  }
};
