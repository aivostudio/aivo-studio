const { getRedis } = require("../../_kv.js");
const { sendPushToUser } = require("../../_lib/push-user.js");

const PROJECT_PREFIX = "adfilm:project:";
const CURSOR_KEY = "push:watch:adfilm:cursor";
const MAX_SCAN_PAGES = 5;
const SCAN_COUNT = 100;
const RECENT_COMPLETION_MS = 6 * 60 * 60 * 1000;

function safeText(value) {
  return String(value || "").trim();
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    safeText(value)
  );
}

function isAuthorizedCron(req) {
  const secret = safeText(process.env.CRON_SECRET);
  const authHeader = safeText(req.headers.authorization);

  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

function parseProject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function pickActiveOutput(project) {
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];
  const activeOutputId = safeText(project?.activeOutputId);
  const generationOutputId = safeText(project?.generation?.outputId);

  return (
    outputs.find((item) => safeText(item?.id) === activeOutputId) ||
    outputs.find((item) => safeText(item?.id) === generationOutputId) ||
    outputs[0] ||
    null
  );
}

function pickFinalVideoUrl(project) {
  const activeOutput = pickActiveOutput(project);

  return (
    safeText(activeOutput?.videoUrl) ||
    safeText(project?.generation?.videoUrl) ||
    null
  );
}

function pickPosterUrl(project) {
  const activeOutput = pickActiveOutput(project);

  return (
    safeText(activeOutput?.posterUrl) ||
    safeText(project?.generation?.posterUrl) ||
    null
  );
}

function pickOutputId(project) {
  const activeOutput = pickActiveOutput(project);

  return (
    safeText(activeOutput?.id) ||
    safeText(project?.generation?.outputId) ||
    safeText(project?.generation?.requestId) ||
    safeText(project?.id)
  );
}

function pickCompletedAt(project) {
  return (
    safeText(project?.generation?.finalization?.completedAt) ||
    safeText(project?.generation?.completedAt) ||
    safeText(project?.updatedAt) ||
    null
  );
}

function isRecentlyCompleted(project) {
  const projectStatus = safeText(project?.status).toLowerCase();
  const generationStatus = safeText(project?.generation?.status).toLowerCase();
  const finalizationStatus = safeText(
    project?.generation?.finalization?.status
  ).toLowerCase();

  if (
    projectStatus !== "completed" ||
    generationStatus !== "completed" ||
    finalizationStatus !== "completed"
  ) {
    return false;
  }

  const completedAt = pickCompletedAt(project);
  const completedMs = Date.parse(completedAt || "");

  if (!Number.isFinite(completedMs)) return false;
  return Date.now() - completedMs >= 0 && Date.now() - completedMs <= RECENT_COMPLETION_MS;
}

function resolvePushOwner(project) {
  const principal = safeText(project?.userId);

  if (!principal) {
    return { userId: null, userUuid: null };
  }

  if (isUuidLike(principal)) {
    return { userId: null, userUuid: principal };
  }

  return { userId: principal.toLowerCase(), userUuid: null };
}

async function processProject(project) {
  if (!project?.id) {
    return {
      project_id: null,
      ok: false,
      pushed: false,
      skipped: true,
      reason: "invalid_project",
    };
  }

  if (!isRecentlyCompleted(project)) {
    return {
      project_id: String(project.id),
      ok: true,
      pushed: false,
      skipped: true,
      reason: "not_recently_completed",
    };
  }

  const finalVideoUrl = pickFinalVideoUrl(project);

  if (!finalVideoUrl) {
    return {
      project_id: String(project.id),
      ok: true,
      completed: false,
      pushed: false,
      reason: "ad_film_video_missing",
    };
  }

  const outputId = pickOutputId(project);
  const { userId, userUuid } = resolvePushOwner(project);

  if (!userId && !userUuid) {
    return {
      project_id: String(project.id),
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
      titleTr: "🎥 Reklam Filmin Hazır!",
      bodyTr: "AIVO reklam filmini tamamladı. İzlemek için dokun.",
      titleEn: "🎥 Your Ad Film Is Ready!",
      bodyEn: "Your AIVO ad film is ready. Tap to watch.",
      source: "aivo_generation_complete",
      idempotencyKey: `generation-complete:ad-film:${String(project.id)}:${outputId}`,
      imageUrl: pickPosterUrl(project),
      data: {
        project_id: String(project.id),
        output_id: outputId,
        module: "ad-film",
        type: "video",
        target: "productions",
      },
    });

    return {
      project_id: String(project.id),
      output_id: outputId,
      ok: true,
      completed: true,
      pushed: Number(pushResult?.sent || 0) > 0,
      duplicate: pushResult?.duplicate === true,
      sent: Number(pushResult?.sent || 0),
      failed_pushes: Number(pushResult?.failed || 0),
    };
  } catch (pushError) {
    console.error("[push/watch/ad-film] completion push failed", pushError);

    return {
      project_id: String(project.id),
      output_id: outputId,
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

  try {
    const redis = getRedis();
    let cursor = safeText(await redis.get(CURSOR_KEY)) || "0";
    const projectKeys = [];
    let scannedPages = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${PROJECT_PREFIX}*`,
        count: SCAN_COUNT,
      });

      cursor = safeText(nextCursor) || "0";
      scannedPages += 1;

      for (const key of Array.isArray(keys) ? keys : []) {
        if (safeText(key).startsWith(PROJECT_PREFIX)) {
          projectKeys.push(safeText(key));
        }
      }
    } while (cursor !== "0" && scannedPages < MAX_SCAN_PAGES);

    await redis.set(CURSOR_KEY, cursor);

    const results = [];

    for (const key of projectKeys) {
      try {
        const project = parseProject(await redis.get(key));
        if (!project) continue;
        results.push(await processProject(project));
      } catch (projectError) {
        console.error("[push/watch/ad-film] project failed", projectError);
        results.push({
          project_key: key,
          ok: false,
          pushed: false,
          error: String(projectError?.message || projectError),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      scanned_pages: scannedPages,
      scanned_projects: projectKeys.length,
      next_cursor: cursor,
      completed: results.filter((item) => item?.completed === true).length,
      pushed: results.filter((item) => item?.pushed === true).length,
      results,
    });
  } catch (error) {
    console.error("[push/watch/ad-film] watcher failed", error);

    return res.status(500).json({
      ok: false,
      error: "ad_film_push_watcher_failed",
      message: String(error?.message || error),
    });
  }
};
