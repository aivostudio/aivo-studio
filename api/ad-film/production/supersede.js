// api/ad-film/production/supersede.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";
import { cancelFalJobs } from "../../_lib/ad-film-production-sla.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

function activeProduction(project) {
  const generation = project?.generation || {};
  const pipeline = project?.avatar?.pipeline || {};
  const finalization = project?.finalization || generation?.finalization || {};
  const active = new Set(["queued", "processing", "running", "in_queue", "finalizing", "rendering"]);
  return (
    active.has(clean(project?.status, 40).toLowerCase()) ||
    active.has(clean(generation.status, 40).toLowerCase()) ||
    active.has(clean(pipeline.status, 40).toLowerCase()) ||
    active.has(clean(finalization.status, 40).toLowerCase()) ||
    generation.awaitingFinalComposite === true ||
    generation.avatarWaiting === true ||
    generation.finalizing === true
  );
}

function productionIdOf(project) {
  return clean(
    project?.generation?.productionId ||
    project?.generation?.input?.productionId ||
    project?.avatar?.pipeline?.productionId ||
    project?.productionPlan?.productionId,
    200,
  );
}

function requestIdOf(project) {
  return clean(project?.generation?.requestId, 240);
}

function withoutAsyncJobs(project) {
  const jobs = { ...(project?.productionJobs || {}) };
  delete jobs.avatar;
  delete jobs.finalization;
  delete jobs.seedance;
  return jobs;
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
    const nextProductionId = clean(req.body?.production_id, 200);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    if (!nextProductionId) return sendJson(res, 400, { ok: false, error: "missing_production_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const previousProductionId = productionIdOf(project);
    if (previousProductionId && previousProductionId === nextProductionId && activeProduction(project)) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        production_id: nextProductionId,
        alreadyPrepared: true,
        project,
      });
    }

    let providerCancellation = [];
    if (activeProduction(project)) {
      providerCancellation = await cancelFalJobs(project, falKey()).catch((error) => [{
        ok: false,
        error: clean(error?.message || error, 500),
      }]);
    }

    const now = new Date().toISOString();
    const supersededRecord = previousProductionId || requestIdOf(project)
      ? {
          productionId: previousProductionId || null,
          requestId: requestIdOf(project) || null,
          supersededAt: now,
          reason: "user_started_new_production",
          providerCancellation,
        }
      : null;
    const previousRecords = Array.isArray(project?.supersededProductions)
      ? project.supersededProductions.filter(Boolean)
      : [];

    const saved = await saveProject(user, {
      ...project,
      status: "draft",
      error: null,
      lastError: null,
      generation: null,
      finalization: null,
      activeOutputId: null,
      preparingNewVersion: true,
      productionJobs: withoutAsyncJobs(project),
      productionPlan: project?.productionPlan
        ? { ...project.productionPlan, productionId: null }
        : project?.productionPlan,
      avatar: project?.avatar
        ? { ...project.avatar, pipeline: null, videoUrl: null }
        : project?.avatar,
      launchIntent: {
        productionId: nextProductionId,
        requestedAt: now,
        status: "prepared",
      },
      supersededProductions: supersededRecord
        ? [supersededRecord, ...previousRecords].slice(0, 40)
        : previousRecords,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      production_id: nextProductionId,
      previous_production_id: previousProductionId || null,
      provider_cancellation: providerCancellation,
      project: saved,
    });
  } catch (error) {
    console.error("[ad-film/production/supersede]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "production_supersede_failed",
      message: clean(error?.message || error, 1200),
    });
  }
}
