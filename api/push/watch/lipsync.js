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

function isAuthorizedCron(req) {
  const secret = safeText(process.env.CRON_SECRET);
  const authHeader = safeText(req.headers.authorization);

  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
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

function pickUrl(output) {
  return safeText(
    output?.archive_url ||
      output?.url ||
      output?.video_url ||
      output?.meta?.archive_url ||
      output?.meta?.url ||
      output?.meta?.video_url
  );
}

function pickFinalVideoUrl(job) {
  const outputs = Array.isArray(job?.outputs) ? job.outputs : [];
  const meta = job?.meta && typeof job.meta === "object" ? job.meta : {};

  const finalFlagged = outputs.find((item) => {
    const type = safeText(item?.type).toLowerCase();
    return type === "video" && item?.meta?.is_final === true && !!pickUrl(item);
  });

  if (finalFlagged) return pickUrl(finalFlagged);

  const firstVideo = outputs.find((item) => {
    const type = safeText(item?.type).toLowerCase();
    return type === "video" && !!pickUrl(item);
  });

  if (firstVideo) return pickUrl(firstVideo);

  return safeText(meta.final_video_url) || null;
}

async function readJob(sql, jobId) {
  const rows = await sql`
    select id, user_id, user_uuid, provider, status, meta, outputs
    from jobs
    where id = ${String(jobId)}::uuid
      and lower(app) = 'lipsync'
      and deleted_at is null
    limit 1
  `;

  return rows?.[0] || null;
}

async function callJobsStatus(req, jobId) {
  const url = `${getBaseUrl(req)}/api/jobs/status?job_id=${encodeURIComponent(
    String(jobId)
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-aivo-completion-source": "lipsync_push_watcher",
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

async function processLipsyncJob(req, sql, job) {
  const currentStatus = safeText(job?.status).toLowerCase();

  if (currentStatus === "queued" || currentStatus === "processing") {
    const statusResult = await callJobsStatus(req, job.id);

    if (!statusResult.ok) {
      return {
        job_id: String(job.id),
        ok: false,
        pushed: false,
        reason: "lipsync_status_check_failed",
        status_code: statusResult.statusCode,
      };
    }
  }

  const finalizedJob = await readJob(sql, job.id);
  const dbStatus = safeText(finalizedJob?.status).toLowerCase();

  if (dbStatus === "error") {
    return {
      job_id: String(job.id),
      ok: true,
      completed: false,
      failed: true,
      pushed: false,
    };
  }

  if (dbStatus !== "done") {
    return {
      job_id: String(job.id),
      ok: true,
      completed: false,
      pushed: false,
      status: dbStatus || "processing",
    };
  }

  const finalVideoUrl = pickFinalVideoUrl(finalizedJob);

  if (!finalVideoUrl) {
    return {
      job_id: String(job.id),
      ok: true,
      completed: false,
      pushed: false,
      reason: "lipsync_video_missing",
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
      titleTr: "🎬 Dudak Senkron Videon Hazır!",
      bodyTr: "AIVO'da oluşturduğun dudak senkron video tamamlandı. İzlemek için dokun.",
      titleEn: "🎬 Your Lip Sync Video Is Ready!",
      bodyEn: "Your AIVO lip sync video is ready. Tap to watch.",
      source: "aivo_generation_complete",
      idempotencyKey: `generation-complete:lipsync:${String(finalizedJob.id)}`,
      data: {
        job_id: String(finalizedJob.id),
        module: "lipsync",
        type: "video",
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
    console.error("[push/watch/lipsync] completion push failed", pushError);

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
      select id, user_id, user_uuid, provider, status, meta, outputs
      from jobs
      where lower(app) = 'lipsync'
        and lower(coalesce(provider, meta->>'provider', '')) = 'heygen_image_to_video'
        and deleted_at is null
        and lower(status) in ('queued', 'processing', 'done')
        and created_at >= now() - interval '24 hours'
      order by created_at asc
      limit 5
    `;

    const results = [];

    for (const job of jobs || []) {
      try {
        results.push(await processLipsyncJob(req, sql, job));
      } catch (jobError) {
        console.error("[push/watch/lipsync] job failed", jobError);

        results.push({
          job_id: String(job?.id || ""),
          ok: false,
          pushed: false,
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
    console.error("[push/watch/lipsync] watcher failed", error);

    return res.status(500).json({
      ok: false,
      error: "lipsync_push_watcher_failed",
      message: String(error?.message || error),
    });
  }
};
