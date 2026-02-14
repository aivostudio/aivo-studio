// api/jobs/status.js
// CommonJS — Provider-agnostic "persist outputs to R2" on-read

const { neon } = require("@neondatabase/serverless");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function isUuidLike(id) {
  return /^[0-9a-f-]{36}$/i.test(String(id || ""));
}

function cleanBase(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

function getPublicBase() {
  return process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE || "";
}

function isPersistentUrl(url) {
  const base = cleanBase(getPublicBase());
  if (!base) return false;
  return typeof url === "string" && url.startsWith(base + "/outputs/");
}

function decodeProxyUrl(u) {
  // Accepts:
  // - "/api/media/proxy?url=ENC"
  // - "https://aivo.tr/api/media/proxy?url=ENC"
  // Returns upstream URL if possible.
  if (!u || typeof u !== "string") return u;

  const s = u.trim();

  // Absolute or relative proxy
  if (s.includes("/api/media/proxy")) {
    try {
      const full = s.startsWith("http") ? s : "https://aivo.tr" + s;
      const obj = new URL(full);
      const upstream = obj.searchParams.get("url");
      if (upstream) return upstream;
    } catch (_) {}
  }

  return s;
}

function inferApp(job) {
  // best-effort
  return (
    job?.meta?.app ||
    job?.app ||
    job?.type ||
    (job?.provider ? "video" : "unknown")
  );
}

function inferTaskId(job) {
  return (
    job?.request_id ||
    job?.meta?.request_id ||
    job?.meta?.task_id ||
    job?.meta?.id ||
    job?.meta?.raw?.id ||
    job?.id
  );
}

function inferExtByType(type, url) {
  const t = String(type || "").toLowerCase();
  const u = String(url || "");

  // Try from URL path extension first
  const m = u.match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
  if (m && m[1]) {
    const ext = m[1].toLowerCase();
    // allow common
    if (["mp4", "mov", "webm", "mp3", "wav", "m4a", "aac", "jpg", "jpeg", "png", "webp"].includes(ext)) {
      return ext;
    }
  }

  if (t === "video") return "mp4";
  if (t === "audio" || t === "music") return "mp3";
  if (t === "image" || t === "cover") return "jpg";
  return "bin";
}

function inferContentType(type, ext) {
  const t = String(type || "").toLowerCase();
  const e = String(ext || "").toLowerCase();

  if (t === "video" || ["mp4", "mov", "webm"].includes(e)) return "video/mp4";
  if (t === "audio" || ["mp3", "wav", "m4a", "aac"].includes(e)) return "audio/mpeg";
  if (t === "image" || ["jpg", "jpeg", "png", "webp"].includes(e)) {
    if (e === "png") return "image/png";
    if (e === "webp") return "image/webp";
    return "image/jpeg";
  }
  return "application/octet-stream";
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

async function copyUrlToR2({ url, key, contentType }) {
  const Bucket = process.env.R2_BUCKET;
  const publicBase = getPublicBase();
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

function mapStatus(jobStatus) {
  const s = String(jobStatus || "").toLowerCase();
  if (s === "completed" || s === "ready" || s === "succeeded") return "ready";
  if (s === "failed" || s === "error") return "error";
  return "processing";
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false });

    res.setHeader("Cache-Control", "no-store");

    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    // --- DB bağlantı ---
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    const sql = neon(conn);

    const rows = await sql`
      select * from jobs
      where id = ${job_id}
      limit 1
    `;

    let job = rows[0] || null;
    if (!job) return res.status(404).json({ ok: false, error: "job_not_found" });

    const provider = String(job.provider || "").toLowerCase();
    const app = String(inferApp(job) || "unknown").toLowerCase();
    const taskId = String(inferTaskId(job) || job_id);
    const publicBase = getPublicBase();

    // 0) Eğer outputs zaten kalıcı ise direkt dön
    if (Array.isArray(job.outputs) && job.outputs.some((o) => isPersistentUrl(o?.url))) {
      const firstVideo = job.outputs.find((o) => o?.type === "video") || null;
      return res.status(200).json({
        ok: true,
        job_id,
        status: mapStatus(job.status),
        video: firstVideo?.url ? { url: firstVideo.url } : null,
        outputs: job.outputs || [],
      });
    }

    // 1) Provider-poll (Runway özel): ready URL yakalarsak önce onu persist ederiz
    //    (Bu blok sadece "outputs boş / eski" durumlarda yardımcı)
    if (provider === "runway" && taskId && isUuidLike(taskId)) {
      const rr = await fetchRunwayTask(taskId);
      if (rr.ok) {
        const st = String(rr.task?.status || "").toUpperCase();
        const outArr = Array.isArray(rr.task?.output) ? rr.task.output : [];
        const rawUrl =
          outArr.find((x) => typeof x === "string" && x.startsWith("http")) || null;

        if ((st === "SUCCEEDED" || st === "COMPLETED") && rawUrl) {
          const ext = "mp4";
          const key = `outputs/video/${job_id}/runway/${taskId}/0.${ext}`;
          const persistentUrl = await copyUrlToR2({
            url: rawUrl,
            key,
            contentType: "video/mp4",
          });

          const outputs = [
            {
              type: "video",
              url: persistentUrl,
              meta: { app: "video", provider: "runway", task_id: taskId, index: 0 },
            },
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

          return res.status(200).json({
            ok: true,
            job_id,
            status: "ready",
            video: { url: persistentUrl },
            outputs,
          });
        }
      }
    }

    // 2) Provider-agnostic backfill: job.outputs içinde URL varsa ve kalıcı değilse -> R2'ye kopyala -> DB update
    if (Array.isArray(job.outputs) && job.outputs.length) {
      const newOutputs = [];
      let changed = false;

      for (let i = 0; i < job.outputs.length; i++) {
        const o = job.outputs[i] || {};
        const type = String(o.type || "").toLowerCase() || "file";
        const originalUrl = o.url ? String(o.url) : "";

        // zaten kalıcıysa
        if (isPersistentUrl(originalUrl)) {
          newOutputs.push(o);
          continue;
        }

        // proxy url ise upstream'e indir
        const upstream = decodeProxyUrl(originalUrl);

        // http değilse dokunma
        if (!/^https?:\/\//i.test(upstream)) {
          newOutputs.push(o);
          continue;
        }

        // key hesapla
        const ext = inferExtByType(type, upstream);
        const ct = inferContentType(type, ext);

        const safeApp = type === "video" ? "video" : type === "audio" ? "music" : type === "image" ? "cover" : app || "unknown";
        const safeProvider = provider || (o?.meta?.provider ? String(o.meta.provider).toLowerCase() : "unknown");
        const outTaskId = String(o?.meta?.task_id || taskId || job_id);
        const index = Number.isFinite(o?.meta?.index) ? Number(o.meta.index) : i;

        const key = `outputs/${safeApp}/${job_id}/${safeProvider}/${outTaskId}/${index}.${ext}`;

        try {
          const persistentUrl = await copyUrlToR2({
            url: upstream,
            key,
            contentType: ct,
          });

          const meta = Object.assign({}, o.meta || {}, {
            app: safeApp,
            provider: safeProvider,
            task_id: outTaskId,
            index,
          });

          newOutputs.push({
            type: type === "file" ? o.type || "file" : type,
            url: persistentUrl,
            meta,
          });

          changed = true;
        } catch (e) {
          // Eğer upstream 401/403 vs ise kopyalayamayız; eskiyi aynen bırakıyoruz.
          newOutputs.push(o);
        }
      }

      if (changed) {
        await sql`
          update jobs
          set outputs = ${JSON.stringify(newOutputs)}::jsonb,
              updated_at = now()
          where id = ${job_id}
        `;

        job.outputs = newOutputs;
      }
    }

    // 3) Final response (proxy yok)
    const firstVideo = Array.isArray(job.outputs)
      ? job.outputs.find((o) => o?.type === "video" && typeof o?.url === "string")
      : null;

    return res.status(200).json({
      ok: true,
      job_id,
      status: mapStatus(job.status),
      video: firstVideo?.url ? { url: firstVideo.url } : null,
      outputs: job.outputs || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
