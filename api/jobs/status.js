// /pages/api/jobs/status.js
// CommonJS
// ✅ FAL (ATMO) poll FIX: providers/fal/video/status endpoint’ine request_id değil,
//    job_id (veya status_url) ile gidiyoruz.
// ✅ DONE anında (opsiyonel) MP4 içine audio embed (mux) yapıp R2'ye upload ediyoruz.

const { neon } = require("@neondatabase/serverless");
const fs = require("node:fs");

// ✅ doğru path (pages/api/jobs/status.js -> pages/api/_lib/mux-mp4-with-audio.js)
const { muxMp4WithAudio } = require("../_lib/mux-mp4-with-audio");

// ---------- helpers ----------
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

/**
 * DB ENUM hedefi: queued | processing | done | error
 * Provider statusları bunlara map’lenir.
 */
function toDbStatus(providerStatus) {
  const st = String(providerStatus || "").toUpperCase();

  // done
  if (
    st === "SUCCEEDED" ||
    st === "COMPLETED" ||
    st === "COMPLETE" ||
    st === "READY" ||
    st === "DONE" ||
    st === "SUCCESS"
  ) {
    return "done";
  }

  // processing
  if (
    st === "IN_PROGRESS" ||
    st === "PROCESSING" ||
    st === "RUNNING" ||
    st === "STARTED" ||
    st === "EXECUTING"
  ) {
    return "processing";
  }

  // queued
  if (
    st === "IN_QUEUE" ||
    st === "QUEUED" ||
    st === "PENDING" ||
    st === "SUBMITTED"
  ) {
    return "queued";
  }

  // error
  if (
    st === "FAILED" ||
    st === "ERROR" ||
    st === "CANCELED" ||
    st === "CANCELLED" ||
    st === "TIMEOUT"
  ) {
    return "error";
  }

  return null; // bilinmiyor -> DB’ye dokunma
}

function toApiStatus(dbStatus) {
  const s = String(dbStatus || "").toLowerCase();
  if (s === "done") return "ready";
  if (s === "error") return "error";
  return "processing"; // queued/processing/unknown
}

// ---------- RUNWAY ----------
async function fetchRunwayTask(taskId) {
  const key = process.env.RUNWAYML_API_SECRET;
  if (!key) return { ok: false, error: "missing_env:RUNWAYML_API_SECRET" };

  const r = await fetch(
    `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
      },
    }
  );

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, error: `runway_http_${r.status}`, body: t };
  }

  const j = await r.json().catch(() => null);
  return { ok: true, task: j };
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

  if (
    task?.output?.video_url &&
    String(task.output.video_url).startsWith("http")
  ) {
    return task.output.video_url;
  }

  return null;
}

// ---------- FAL (ATMOSFER ONLY) ----------
function pickRequestIdFromJob(job) {
  return (
    job?.request_id ||
    job?.meta?.request_id ||
    job?.meta?.provider_request_id ||
    job?.meta?.provider_response?.request_id ||
    job?.meta?.provider_response?.raw?.request_id ||
    null
  );
}

function pickFalStatus(payload) {
  return (
    payload?.status ||
    payload?.fal?.status ||
    payload?.fal_status ||
    payload?.state ||
    payload?.data?.status ||
    payload?.data?.state ||
    payload?.response?.status ||
    payload?.response?.state ||
    null
  );
}

function pickFalStatusUrlFromJob(job) {
  const meta = job?.meta || {};
  const pr = meta?.provider_response || {};
  const raw = pr?.raw || meta?.raw || {};

  return (
    pr?.status_url ||
    pr?.response_url ||
    raw?.status_url ||
    raw?.response_url ||
    meta?.status_url ||
    meta?.response_url ||
    meta?.fal?.status_url ||
    meta?.fal?.response_url ||
    null
  );
}

async function fetchFalAtmoStatus(req, { job_id, status_url }) {
  const baseUrl = getBaseUrl(req);

  const qs = new URLSearchParams();
  qs.set("app", "atmo");

  if (status_url && String(status_url).trim()) {
    qs.set("status_url", String(status_url).trim());
  } else {
    qs.set("job_id", String(job_id || "").trim());
  }

  const url = `${baseUrl}/api/providers/fal/video/status?${qs.toString()}`;

  const r = await fetch(url, {
    method: "GET",
    headers: { cookie: req.headers.cookie || "" },
  });

  const text = await r.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!r.ok || json?.ok === false) {
    return { ok: false, error: `fal_status_http_${r.status}`, body: json };
  }

  return { ok: true, body: json };
}

function pickFalVideoUrl(body) {
  const direct = body?.video_url || body?.video?.url || null;
  if (direct && String(direct).startsWith("http")) return direct;

  const outs = Array.isArray(body?.outputs) ? body.outputs : [];
  const hit = outs.find((o) => {
    const u = pickUrl(o);
    return u && String(u).startsWith("http");
  });
  return hit ? pickUrl(hit) : null;
}

// ---------- R2 PERSIST (REMOTE URL -> R2) ----------
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
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const r = await fetch(url);
  if (!r.ok) throw new Error(`copy_fetch_failed:${r.status}`);

  const ct =
    contentType || r.headers.get("content-type") || "application/octet-stream";
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

// ---------- R2 UPLOAD (LOCAL FILE -> R2) ----------
async function uploadFileToR2({ filePath, key, contentType }) {
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
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const bodyStream = fs.createReadStream(filePath);

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: bodyStream,
      ContentType: contentType || "application/octet-stream",
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

  return u.startsWith("http://") || u.startsWith("https://");
}

// ---------- MAIN ----------
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

    if (!isUuidLike(job_id)) {
      return res.status(400).json({
        ok: false,
        error: "job_id_invalid",
        hint: "job_id must be uuid",
      });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({
        ok: false,
        error: "missing_db_env",
        hint:
          "Set one of POSTGRES_URL_NON_POOLING / DATABASE_URL / POSTGRES_URL / DATABASE_URL_UNPOOLED",
      });
    }

    const sql = neon(conn);

    const rows = await sql`
      select * from jobs
      where id = ${job_id}::uuid
      limit 1
    `;

    let job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    const provider = String(job.provider || job.meta?.provider || "").toLowerCase();
    const appKey = String(job.app || job.type || job.meta?.app || "").toLowerCase();
    const requestId = pickRequestIdFromJob(job);

   // =========================
// 1) FAL POLL (ONLY ATMO)
// =========================
if (provider === "fal" && appKey === "atmo") {
  const current = String(job.status || "").toLowerCase();
  const outputsNow = Array.isArray(job.outputs) ? job.outputs : [];

  const shouldPoll =
    current !== "done" && current !== "error" ? true : outputsNow.length === 0;

  if (shouldPoll) {
    const statusUrl = pickFalStatusUrlFromJob(job);

    const fr = await fetchFalAtmoStatus(req, {
      job_id,
      status_url: statusUrl,
    });

    if (fr.ok) {
      const body = fr.body || {};
      const stRaw = pickFalStatus(body);
      const dbSt = toDbStatus(stRaw);

      const patchMeta = {
        fal: {
          status: String(stRaw || "").toUpperCase(),
          request_id: requestId || null,
          status_url: statusUrl || body?.status_url || null,
          updated_at: new Date().toISOString(),
        },
      };

      if (dbSt === "done") {
        let videoUrl = pickFalVideoUrl(body);

        // 🔥 Provider output id’yi body’den çek (deterministik kimlik)
        const providerOutputId =
          body?.outputs?.[0]?.id ||
          body?.outputs?.[0]?.output_id ||
          requestId ||
          job_id;

        // ✅ MP4 içine audio embed (mux) + R2 upload
        const audioMode = job?.meta?.audio_mode || null;
        const audioUrl = job?.meta?.audio_url || null;
        const silentCopy = Boolean(job?.meta?.silent_copy);

        // daha önce mux edilmişse tekrar yapma
        const alreadyMuxed = job?.meta?.muxed_url || null;
        if (alreadyMuxed) {
          videoUrl = alreadyMuxed;
        } else if (videoUrl && audioMode === "embed" && audioUrl && !silentCopy) {
          let tmpDir = null;
          let muxRes = null;

          try {
            muxRes = await muxMp4WithAudio(videoUrl, audioUrl);
            const outMp4 = muxRes?.outMp4Path || muxRes?.outMp4;
            tmpDir = muxRes?.tmpDir || null;

            if (outMp4) {
              const output_id = `${providerOutputId}-with-audio`;
              const key = `outputs/atmo/${job_id}/${output_id}.mp4`;

              const muxedPublicUrl = await uploadFileToR2({
                filePath: outMp4,
                key,
                contentType: "video/mp4",
              });

              videoUrl = muxedPublicUrl;

              patchMeta.audio = {
                embedded: true,
                audio_mode: audioMode,
                audio_url: audioUrl,
                muxed_at: new Date().toISOString(),
              };

              // guard (bir daha mux yapmasın)
              patchMeta.muxed_url = muxedPublicUrl;
              patchMeta.muxed_key = key;
            }
          } catch (e) {
            console.error("atmo_mux_failed", e);
            patchMeta.audio = {
              ...(patchMeta.audio || {}),
              embedded: false,
              mux_error: String(e?.message || e),
            };
          } finally {
            try {
              if (typeof muxRes?.cleanup === "function") await muxRes.cleanup();
            } catch {}
            try {
              if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {}
          }
        }

        if (videoUrl) {
          const outputs = [
            {
              type: "video",
              url: videoUrl,
              output_id: providerOutputId, // ✅ kritik düzeltme
              meta: { app: "atmo", provider: "fal" },
            },
          ];

          await sql`
            update jobs
            set status = 'done',
                outputs = ${JSON.stringify(outputs)}::jsonb,
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}::uuid
          `;

          job.status = "done";
          job.outputs = outputs;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        } else {
          await sql`
            update jobs
            set status = 'done',
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
                  ...patchMeta,
                  fal: { ...patchMeta.fal, note: "done_but_no_video_url" },
                })}::jsonb,
                updated_at = now()
            where id = ${job_id}::uuid
          `;
          job.status = "done";
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
      } else if (dbSt === "error") {
        await sql`
          update jobs
          set status = 'error',
              meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
              updated_at = now()
          where id = ${job_id}::uuid
        `;
        job.status = "error";
        job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
      } else if (dbSt === "queued" || dbSt === "processing") {
        await sql`
          update jobs
          set status = ${dbSt},
              meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
              updated_at = now()
          where id = ${job_id}::uuid
        `;
        job.status = dbSt;
        job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
      }
    }
  }
}

    // =========================
    // 2) RUNWAY POLL (as-is)
    // =========================
    if (provider === "runway" && requestId && isUuidLike(requestId)) {
      const rr = await fetchRunwayTask(requestId);

      if (rr.ok) {
        const stRaw = String(rr.task?.status || rr.task?.state || "");
        const dbSt = toDbStatus(stRaw);

        const rawUrl = pickRunwayVideoUrl(rr.task);

        const patchMeta = {
          runway: {
            status: String(stRaw || "").toUpperCase(),
            task_id: requestId,
            updated_at: new Date().toISOString(),
          },
        };

        if (dbSt === "done" && rawUrl) {
          const outputs = [
            {
              type: "video",
              url: rawUrl,
              meta: { app: "video", provider: "runway" },
            },
          ];

          await sql`
            update jobs
            set status = 'done',
                outputs = ${JSON.stringify(outputs)}::jsonb,
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}::uuid
          `;

          job.status = "done";
          job.outputs = outputs;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        } else if (dbSt === "done" && !rawUrl) {
          await sql`
            update jobs
            set status = 'done',
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
                  ...patchMeta,
                  runway: { ...patchMeta.runway, note: "done_but_no_output_url" },
                })}::jsonb,
                updated_at = now()
            where id = ${job_id}::uuid
          `;
          job.status = "done";
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        } else if (dbSt === "error") {
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

          const patchMeta2 = {
            runway: {
              ...patchMeta.runway,
              failure: failureMessage,
              failureCode,
            },
          };

          await sql`
            update jobs
            set status = 'error',
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta2)}::jsonb,
                updated_at = now()
            where id = ${job_id}::uuid
          `;

          job.status = "error";
          job.meta = { ...(job.meta || {}), ...(patchMeta2 || {}) };
        } else if (dbSt === "queued" || dbSt === "processing") {
          await sql`
            update jobs
            set status = ${dbSt},
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}::uuid
          `;
          job.status = dbSt;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
      }
    }

    // =========================
    // 3) PERSIST-TO-R2 (REMOTE URL -> R2) (as-is)
    // =========================
    let outputs = Array.isArray(job.outputs) ? job.outputs : [];

    if (String(job.status).toLowerCase() === "done") {
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
              source_url: rawUrl,
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
          where id = ${job_id}::uuid
        `;

        job.outputs = outputs;
      }
    }

      // =========================
    // 4) RESPONSE NORMALIZE
    // =========================
    const outVideo =
      outputs.find((x) => String(x?.type).toLowerCase() === "video") || null;

    const outAudio =
      outputs.find((x) => String(x?.type).toLowerCase() === "audio") || null;

    const outImage =
      outputs.find((x) => String(x?.type).toLowerCase() === "image") || null;

    const failureReason =
      job?.meta?.runway?.failure ||
      job?.meta?.fal?.failure ||
      job?.meta?.failure ||
      null;

  // =========================
// AUTO LOGO OVERLAY (ATMO)
// =========================
try {
  const isAtmo =
    job?.app === "atmo" ||
    job?.meta?.app === "atmo";

  const isReady = ["ready", "completed"].includes(
    String(job?.status || "").toLowerCase()
  );

  const logoUrl = job?.meta?.logo_url;

  const baseVideoUrl =
    outVideo?.url ||
    job?.video_url ||
    null;

  const alreadyHasOverlay =
    Array.isArray(outputs) &&
    outputs.some(
      (o) =>
        o?.type === "video" &&
        (o?.meta?.variant === "logo_overlay" ||
          String(o?.url || "").includes("logo-overlay-"))
    );

  if (isAtmo && isReady && logoUrl && baseVideoUrl && !alreadyHasOverlay) {
    const resp = await fetch(
      `${process.env.APP_ORIGIN || "https://aivo.tr"}/api/atmo/overlay-logo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "atmo",
          job_id,
          video_url: baseVideoUrl,
          logo_url: logoUrl,
          logo_pos: job?.meta?.logo_pos || "br",
          logo_size: job?.meta?.logo_size || "sm",
          logo_opacity:
            typeof job?.meta?.logo_opacity === "number"
              ? job.meta.logo_opacity
              : 0.85,
        }),
      }
    );

    const data = await resp.json().catch(() => null);

    if (data?.ok && data?.url) {
      // 1) add overlay output to response
      outputs.unshift({
        type: "video",
        url: data.url,
        meta: { app: "atmo", variant: "logo_overlay" },
      });

      // 2) persist to DB so /api/jobs/list sees it and we don't re-overlay
   const conn = (typeof getConn === "function") ? getConn() : null;
      if (conn) {
        await conn.query(
          `
          UPDATE jobs
          SET
            outputs = $2::jsonb,
            meta = COALESCE(meta, '{}'::jsonb) || $3::jsonb,
            updated_at = NOW()
          WHERE id = $1
          `,
          [
            job_id,
            JSON.stringify(outputs || []),
            JSON.stringify({
              logo_overlay_done: true,
              logo_overlay_url: data.url,
            }),
          ]
        );
      }
    }
  }
} catch (e) {
  console.warn("AUTO_LOGO_OVERLAY_FAILED:", e?.message || e);
}

return res.status(200).json({
  ok: true,
  job_id,
  status: toApiStatus(job.status),
  error_reason:
    String(job.status).toLowerCase() === "error"
      ? failureReason || "provider_failed"
      : null,
  video: outVideo ? { url: outVideo.url } : null,
  audio: outAudio ? { url: outAudio.url } : null,
  image: outImage ? { url: outImage.url } : null,
  outputs: outputs || [],
  db_status: job.status, // debug
});
