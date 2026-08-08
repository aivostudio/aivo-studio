const { neon } = require("@neondatabase/serverless");
const { sendPushToUser } = require("../../_lib/push-user.js");

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function safeText(value) {
  return String(value || "").trim();
}

function getBaseUrl(req) {
  const proto =
    safeText(req.headers["x-forwarded-proto"])
      .split(",")[0]
      .trim() || "https";

  const host =
    safeText(req.headers["x-forwarded-host"])
      .split(",")[0]
      .trim() || safeText(req.headers.host);

  if (!host) throw new Error("missing_request_host");
  return `${proto}://${host}`;
}

function isAuthorizedCron(req) {
  const secret = safeText(process.env.CRON_SECRET);
  const authHeader = safeText(req.headers.authorization);

  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

function pickStatusLookupId(job) {
  const meta = job?.meta && typeof job.meta === "object" ? job.meta : {};

  return (
    safeText(meta.internal_job_id) ||
    safeText(meta.provider_job_id) ||
    safeText(job?.request_id) ||
    null
  );
}

function pickAudioUrl(job) {
  const outputs = Array.isArray(job?.outputs) ? job.outputs : [];
  const meta = job?.meta && typeof job.meta === "object" ? job.meta : {};

  const output = outputs.find((item) => {
    const type = safeText(item?.type).toLowerCase();
    const url = safeText(
      item?.url ||
      item?.archive_url ||
      item?.meta?.archive_url ||
      item?.meta?.audio_url
    );

    return type === "audio" && !!url;
  });

  if (output) {
    return safeText(
      output.url ||
      output.archive_url ||
      output?.meta?.archive_url ||
      output?.meta?.audio_url
    );
  }

  return safeText(meta.audio_src) || null;
}

async function callMusicStatus(req, lookupId) {
  const url = `${getBaseUrl(req)}/api/music/status?job_id=${encodeURIComponent(
    lookupId
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-aivo-completion-source": "music_push_watcher",
    },
    signal: AbortSignal.timeout(120000),
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  return {
    ok: response.ok && body?.ok !== false,
    statusCode: response.status,
    body,
  };
}

async function readJob(sql, jobId) {
  const rows = await sql`
    select id, user_id, user_uuid, request_id, status, meta, outputs
    from jobs
    where id = ${String(jobId)}::uuid
      and lower(app) = 'music'
      and deleted_at is null
    limit 1
  `;

  return rows?.[0] || null;
}

async function processMusicJob(req, sql, job) {
  const lookupId = pickStatusLookupId(job);

  if (!lookupId) {
    return {
      job_id: String(job.id),
      ok: false,
      skipped: true,
      reason: "missing_music_status_lookup_id",
    };
  }

  const statusResult = await callMusicStatus(req, lookupId);

  if (!statusResult.ok) {
    return {
      job_id: String(job.id),
      ok: false,
      skipped: true,
      reason: "music_status_check_failed",
      status_code: statusResult.statusCode,
    };
  }

  const normalizedStatus = safeText(
    statusResult.body?.status || statusResult.body?.state
  ).toLowerCase();

  if (normalizedStatus === "failed") {
    return {
      job_id: String(job.id),
      ok: true,
      completed: false,
      failed: true,
      pushed: false,
    };
  }

  if (normalizedStatus !== "completed") {
    return {
      job_id: String(job.id),
      ok: true,
      completed: false,
      pushed: false,
      status: normalizedStatus || "processing",
    };
  }

  const finalizedJob = await readJob(sql, job.id);
  const dbStatus = safeText(finalizedJob?.status).toLowerCase();
  const audioUrl = pickAudioUrl(finalizedJob);

  if (dbStatus !== "completed" || !audioUrl) {
    return {
      job_id: String(job.id),
      ok: false,
      completed: false,
      pushed: false,
      reason: "music_completion_not_persisted",
      db_status: dbStatus || null,
    };
  }

  const userId = safeText(finalizedJob?.user_id) || null;
  const userUuid = safeText(finalizedJob?.user_uuid) || null;

  if (!userId && !userUuid) {
    return {
      job_id: String(job.id),
      ok: true,
      completed: true,
      pushed: false,
      reason: "missing_push_owner",
    };
  }

  try {
    const pushResult = await sendPushToUser({
      userId,
      userUuid,
      titleTr: "🎵 Müziğin Hazır!",
      bodyTr: "AIVO'da oluşturduğun müzik tamamlandı. Dinlemek için dokun.",
      titleEn: "🎵 Your Music Is Ready!",
      bodyEn: "Your AIVO music is ready. Tap to listen.",
      source: "aivo_generation_complete",
      idempotencyKey: `generation-complete:music:${String(finalizedJob.id)}`,
      data: {
        job_id: String(finalizedJob.id),
        module: "music",
        type: "audio",
        target: "productions",
      },
    });

    return {
      job_id: String(job.id),
      ok: true,
      completed: true,
      pushed: Number(pushResult?.sent || 0) > 0,
      duplicate: pushResult?.duplicate === true,
      sent: Number(pushResult?.sent || 0),
      failed_pushes: Number(pushResult?.failed || 0),
    };
  } catch (pushError) {
    console.error("[push/watch/music] completion push failed", pushError);

    return {
      job_id: String(job.id),
      ok: true,
      completed: true,
      pushed: false,
      push_error: String(pushError?.message || pushError),
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const conn = getConn();
  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }

  try {
    const sql = neon(conn);

    const jobs = await sql`
      select id, user_id, user_uuid, request_id, status, meta, outputs
      from jobs
      where lower(app) = 'music'
        and deleted_at is null
        and lower(status) in ('queued', 'processing')
        and created_at >= now() - interval '24 hours'
      order by created_at asc
      limit 5
    `;

    const results = [];

    for (const job of jobs || []) {
      try {
        results.push(await processMusicJob(req, sql, job));
      } catch (jobError) {
        console.error("[push/watch/music] job failed", jobError);

        results.push({
          job_id: String(job?.id || ""),
          ok: false,
          error: String(jobError?.message || jobError),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      checked: Array.isArray(jobs) ? jobs.length : 0,
      completed: results.filter((item) => item?.completed === true).length,
      pushed: results.filter((item) => item?.pushed === true).length,
      results,
    });
  } catch (error) {
    console.error("[push/watch/music] watcher failed", error);

    return res.status(500).json({
      ok: false,
      error: "music_push_watcher_failed",
      message: String(error?.message || error),
    });
  }
};
