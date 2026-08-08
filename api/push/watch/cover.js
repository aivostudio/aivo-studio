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

function pickImageUrl(job) {
  const outputs = Array.isArray(job?.outputs) ? job.outputs : [];

  const image = outputs.find((item) => {
    const type = safeText(item?.type).toLowerCase();
    const url = safeText(
      item?.url ||
      item?.archive_url ||
      item?.image_url ||
      item?.meta?.archive_url ||
      item?.meta?.image_url
    );

    return type === "image" && !!url;
  });

  if (!image) return null;

  return (
    safeText(
      image.url ||
      image.archive_url ||
      image.image_url ||
      image?.meta?.archive_url ||
      image?.meta?.image_url
    ) || null
  );
}

async function processCoverJob(job) {
  const imageUrl = pickImageUrl(job);

  if (!imageUrl) {
    return {
      job_id: String(job.id),
      ok: false,
      pushed: false,
      skipped: true,
      reason: "cover_image_missing",
    };
  }

  const userId = safeText(job.user_id) || null;
  const userUuid = safeText(job.user_uuid) || null;

  if (!userId && !userUuid) {
    return {
      job_id: String(job.id),
      ok: true,
      pushed: false,
      skipped: true,
      reason: "missing_push_owner",
    };
  }

  try {
    const pushResult = await sendPushToUser({
      userId,
      userUuid,
      titleTr: "🖼️ Kapağın Hazır!",
      bodyTr: "AIVO'da oluşturduğun kapak hazır. Görmek için dokun.",
      titleEn: "🖼️ Your Cover Is Ready!",
      bodyEn: "Your AIVO cover is ready. Tap to view it.",
      source: "aivo_generation_complete",
      idempotencyKey: `generation-complete:cover:${String(job.id)}`,
      imageUrl,
      data: {
        job_id: String(job.id),
        module: "cover",
        type: "image",
        target: "productions",
      },
    });

    return {
      job_id: String(job.id),
      ok: true,
      pushed: Number(pushResult?.sent || 0) > 0,
      duplicate: pushResult?.duplicate === true,
      sent: Number(pushResult?.sent || 0),
      failed_pushes: Number(pushResult?.failed || 0),
    };
  } catch (pushError) {
    console.error("[push/watch/cover] completion push failed", pushError);

    return {
      job_id: String(job.id),
      ok: true,
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
      select id, user_id, user_uuid, status, outputs, created_at
      from jobs
      where lower(app) = 'cover'
        and deleted_at is null
        and lower(status) in ('ready', 'completed', 'done')
        and created_at >= now() - interval '15 minutes'
      order by created_at asc
      limit 10
    `;

    const results = [];

    for (const job of jobs || []) {
      try {
        results.push(await processCoverJob(job));
      } catch (jobError) {
        console.error("[push/watch/cover] job failed", jobError);

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
      pushed: results.filter((item) => item?.pushed === true).length,
      results,
    });
  } catch (error) {
    console.error("[push/watch/cover] watcher failed", error);

    return res.status(500).json({
      ok: false,
      error: "cover_push_watcher_failed",
      message: String(error?.message || error),
    });
  }
};
