// api/ad-film/avatar/pipeline/prepare.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const ACTIVE = new Set([
  "waiting_for_seedance",
  "motion_queued",
  "motion_processing",
  "lipsync_queued",
  "lipsync_processing",
  "rendering",
  "completed",
]);

function clean(value, max = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeDuration(value) {
  const duration = Number.parseInt(value, 10);
  return [5, 10, 15].includes(duration) ? duration : 10;
}

function normalizeRatio(value) {
  const ratio = clean(value, 20);
  return ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"].includes(ratio)
    ? ratio
    : "16:9";
}

function normalizeQuality(value) {
  const quality = clean(value, 20).toLowerCase();
  return ["480p", "720p", "1080p", "4k"].includes(quality)
    ? quality
    : "1080p";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const avatar = project.avatar || {};
    if (avatar.enabled !== true) {
      return sendJson(res, 200, { ok: true, skipped: true, status: "DISABLED", project });
    }
    if (!avatar.image?.url) {
      return sendJson(res, 409, { ok: false, error: "avatar_image_required" });
    }

    const generation = project.generation || {};
    const productionId = clean(req.body?.production_id, 160);
    const acceptedProductionId = clean(
      generation.productionId ||
      generation.input?.productionId ||
      project.productionPlan?.productionId,
      160,
    );

    if (!productionId || !acceptedProductionId || productionId !== acceptedProductionId) {
      return sendJson(res, 409, {
        ok: false,
        error: "production_lock_mismatch",
        accepted_production_id: acceptedProductionId || null,
      });
    }

    const existing = avatar.pipeline;
    if (existing && ACTIVE.has(String(existing.status))) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        status: existing.status === "completed" ? "COMPLETED" : "IN_PROGRESS",
        pipeline: existing,
        project,
      });
    }

    const duration = normalizeDuration(
      req.body?.duration || project.output?.duration || generation.input?.duration,
    );
    const aspectRatio = normalizeRatio(
      req.body?.aspect_ratio || project.output?.aspectRatio || generation.input?.aspectRatio,
    );
    const quality = normalizeQuality(
      req.body?.quality || generation.input?.resolution || project.output?.quality,
    );
    const now = new Date().toISOString();

    const pipeline = {
      version: 9,
      compositeMode: "hybrid-timeline",
      status: "waiting_for_seedance",
      stage: "seedance",
      productionId,
      startedAt: now,
      updatedAt: now,
      duration,
      aspectRatio,
      quality,
      sourceSeedanceVideoUrl: generation.sourceVideoUrl || null,
      error: null,
    };

    const productionJobs = {
      ...(project.productionJobs || {}),
      avatar: {
        provider: "fal",
        model: null,
        requestId: null,
        status: "waiting_for_seedance",
        productionId,
        updatedAt: now,
      },
    };

    const nextProject = await saveProject(user, {
      ...project,
      status: "processing",
      generation: {
        ...generation,
        status: "processing",
        avatarWaiting: true,
        awaitingFinalComposite: true,
        error: null,
        updatedAt: now,
      },
      productionJobs,
      avatar: {
        ...avatar,
        pipeline,
        videoUrl: null,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      status: "WAITING_FOR_SEEDANCE",
      pipeline,
      project: nextProject,
    });
  } catch (error) {
    console.error("[ad-film/avatar/pipeline/prepare]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: clean(error?.message || error, 1200),
    });
  }
}
