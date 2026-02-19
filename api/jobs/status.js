// /api/jobs/status.js
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

// küçük helper: bu deployment’da aynı host üzerinden iç endpoint çağırmak için
function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

/**
 * DB ENUM: queued | processing | done | error
 * Provider statusları bunlara map’lenmeli.
 */
function toDbStatus(providerStatus) {
  const st = String(providerStatus || "").toUpperCase();

  // done
  if (
    st === "SUCCEEDED" ||
    st === "COMPLETED" ||
    st === "COMPLETE" ||
    st === "READY" ||
    st === "DONE"
  )
    return "done";

  // processing
  if (
    st === "IN_PROGRESS" ||
    st === "PROCESSING" ||
    st === "RUNNING" ||
    st === "STARTED"
  )
    return "processing";

  // queued
  if (st === "IN_QUEUE" || st === "QUEUED" || st === "PENDING") return "queued";

  // error
  if (
    st === "FAILED" ||
    st === "ERROR" ||
    st === "CANCELED" ||
    st === "CANCELLED"
  )
    return "error";

  return null; // bilinmiyor -> DB’ye dokunma
}

function toApiStatus(dbStatus) {
  const s = String(dbStatus || "").toLowerCase();
  if (s === "done") return "ready";
  if (s === "error") return "error";
  return "processing"; // queued/processing/unknown
}

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

// ✅ SADE ATMOSFER: Fal status poll (sadece app/type=atmo için kullanacağız)
async function fetchFalAtmoStatus(req, requestId) {
  try {
    const baseUrl = getBaseUrl(req);

    // iç endpoint: /api/providers/fal/video/status?app=atmo&request_id=...
    const url = `${baseUrl}/api/providers/fal/video/status?app=atmo&request_id=${encodeURIComponent(
      String(requestId)
    )}`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        cookie: req.headers.cookie || "",
      },
    });

    const t = await r.text().catch(() => "");
    let j = null;
    try {
      j = JSON.parse(t);
    } catch {
      j = { raw: t };
    }

    if (!r.ok || j?.ok === false) {
      return { ok: false, error: `fal_status_http_${r.status}`, body: j };
    }

    return { ok: true, status: j };
  } catch (e) {
    return { ok: false, error: "fal_status_fetch_failed", message: String(e?.message || e) };
  }
}

function needsPersist(url) {
  if (!url) return false;
  const u = String(url);

  // zaten kalıcıysa dokunma
  if (u.includes("media.aivo.tr/outputs/")) return false;
  if (u.includes("media.aivo.tr/outputs")) return false;

  // provider signed url / dış url -> persist et
  return u.startsWith("http://") || u.startsWith("https://");
}

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

// ✅ SADE ATMOSFER: Fal status -> video url çıkarma (çok toleranslı)
function pickFalVideoUrl(payload) {
  if (!payload) return null;

  // bazı endpointler direkt url döndürür
  if (typeof payload === "string" && payload.startsWith("http")) return payload;

  // yaygın alanlar
  const direct =
    payload.video_url ||
    payload.url ||
    payload.output_url ||
    payload.download_url ||
    payload.signed_url ||
    payload?.data?.video_url ||
    payload?.data?.url ||
    payload?.result?.video_url ||
    payload?.result?.url ||
    null;

  if (direct && String(direct).startsWith("http")) return direct;

  // array outputs / assets
  const arr =
    payload.outputs ||
    payload.output ||
    payload.assets ||
    payload?.data?.outputs ||
    payload?.data?.assets ||
    payload?.result?.outputs ||
    payload?.result?.assets ||
    null;

  if (Array.isArray(arr)) {
    const hit = arr.find((x) => {
      const u =
        (typeof x === "string" && x) ||
        x?.url ||
        x?.src ||
        x?.video_url ||
        x?.download_url ||
        x?.signed_url ||
        null;
      return u && String(u).startsWith("http");
    });
    if (!hit) return null;
    if (typeof hit === "string") return hit;
    return hit.url || hit.src || hit.video_url || hit.download_url || hit.signed_url || null;
  }

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

    const app = String(job.app || job.type || "").toLowerCase();

    // provider bazen column’da yok; meta’dan da yakala (mevcut modülleri bozmadan)
    const provider = String(job.provider || job.meta?.provider || "").toLowerCase();

    // requestId: column öncelikli ama atmo create akışında meta içine yazılmış olabilir
    const requestId =
      job.request_id ||
      job.meta?.request_id ||
      job.meta?.provider_request_id ||
      job.meta?.provider_response?.raw?.request_id ||
      job.meta?.provider_response?.request_id ||
      null;

    // --- Runway poll (varsa) ---
    if (provider === "runway" && requestId && isUuidLike(requestId)) {
      const rr = await fetchRunwayTask(requestId);

      if (rr.ok) {
        const stRaw = String(rr.task?.status || rr.task?.state || "");
        const dbSt = toDbStatus(stRaw);

        // output url (formatlar değişebilir)
        const rawUrl = pickRunwayVideoUrl(rr.task);

        // meta patch (her zaman faydalı)
        const patchMeta = {
          runway: {
            status: String(stRaw || "").toUpperCase(),
            task_id: requestId,
            updated_at: new Date().toISOString(),
          },
        };

        // DONE: outputs varsa yaz
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
            where id = ${job_id}
          `;

          job.status = "done";
          job.outputs = outputs;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // DONE ama url yoksa sadece status/meta güncelle (en azından stuck kalmasın)
        else if (dbSt === "done" && !rawUrl) {
          await sql`
            update jobs
            set status = 'done',
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
                  ...patchMeta,
                  runway: { ...patchMeta.runway, note: "done_but_no_output_url" },
                })}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;
          job.status = "done";
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // ERROR
        else if (dbSt === "error") {
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
            where id = ${job_id}
          `;

          job.status = "error";
          job.meta = { ...(job.meta || {}), ...(patchMeta2 || {}) };
        }
        // QUEUED / PROCESSING: DB enum’a uygun şekilde güncelle (opsiyonel ama iyi)
        else if (dbSt === "queued" || dbSt === "processing") {
          await sql`
            update jobs
            set status = ${dbSt},
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;
          job.status = dbSt;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // else: bilinmeyen -> dokunma
      }
    }

    // ✅ SADE ATMOSFER FIX: sadece atmo + fal için status poll yap ve outputs’i doldur
    if (app === "atmo" && provider === "fal" && requestId) {
      const fr = await fetchFalAtmoStatus(req, requestId);

      if (fr.ok) {
        // endpoint farklı shape döndürebilir, yine de status’u yakala
        const stRaw =
          fr.status?.status ||
          fr.status?.state ||
          fr.status?.data?.status ||
          fr.status?.data?.state ||
          fr.status?.raw?.status ||
          fr.status?.raw?.state ||
          null;

        const dbSt = toDbStatus(stRaw);

        const videoUrl = pickFalVideoUrl(fr.status);

        const patchMeta = {
          fal: {
            status: String(stRaw || "").toUpperCase(),
            request_id: String(requestId),
            updated_at: new Date().toISOString(),
          },
        };

        // done + url -> outputs yaz
        if (dbSt === "done" && videoUrl) {
          const outputs = [
            {
              type: "video",
              url: videoUrl,
              meta: { app: "atmo", provider: "fal" },
            },
          ];

          await sql`
            update jobs
            set status = 'done',
                outputs = ${JSON.stringify(outputs)}::jsonb,
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.status = "done";
          job.outputs = outputs;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // done ama url yok -> done yaz (UI stuck olmasın), meta’ya not düş
        else if (dbSt === "done" && !videoUrl) {
          await sql`
            update jobs
            set status = 'done',
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
                  ...patchMeta,
                  fal: { ...patchMeta.fal, note: "done_but_no_video_url" },
                })}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.status = "done";
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // error -> error yaz
        else if (dbSt === "error") {
          const reason =
            fr.status?.error ||
            fr.status?.message ||
            fr.status?.data?.error ||
            fr.status?.data?.message ||
            null;

          await sql`
            update jobs
            set status = 'error',
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
                  ...patchMeta,
                  fal: { ...patchMeta.fal, failure: reason || "fal_failed" },
                })}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.status = "error";
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // queued / processing -> status güncelle (bu önemli: "IN_QUEUE" DB’de de görünsün)
        else if (dbSt === "queued" || dbSt === "processing") {
          await sql`
            update jobs
            set status = ${dbSt},
                meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.status = dbSt;
          job.meta = { ...(job.meta || {}), ...(patchMeta || {}) };
        }
        // bilinmeyen -> dokunma, ama meta patch’i DB’ye yazmak istemiyorsan burada bırakıyoruz
      } else {
        // fal status fetch patladıysa diğer modüller etkilenmesin diye DB’ye dokunmuyoruz
        // sadece meta’ya küçük bir debug eklemek istersen açabilirsin:
        // await sql`update jobs set meta = coalesce(meta,'{}'::jsonb) || ${JSON.stringify({ fal: { status_poll_error: fr.error } })}::jsonb, updated_at=now() where id=${job_id}`;
      }
    }

    // --- PERSIST-TO-R2 (PROVIDER BAĞIMSIZ) ---
    let outputs = Array.isArray(job.outputs) ? job.outputs : [];

    // ✅ DB enum'a göre: done -> persist
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

        const appKey =
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

        const key = `outputs/${appKey}/${job_id}/${output_id}.${ext}`;

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
              app: appKey,
              persisted: true,
              persisted_at: new Date().toISOString(),
              source_url: rawUrl,
            },
          });
        } catch (e) {
          console.error("persist_to_r2_failed", e);
          // persist başarısızsa eski url ile devam et
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
      job?.meta?.runway?.failure || job?.meta?.failure || job?.meta?.fal?.failure || null;

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
      // debug (istersen kaldır)
      db_status: job.status,
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
