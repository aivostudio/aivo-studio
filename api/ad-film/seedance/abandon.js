// api/ad-film/seedance/abandon.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const STALE_AFTER_MS = 20 * 60 * 1000;

function clean(value, max = 1200) {
  return String(value ?? "").trim().slice(0, max);
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

    const generation = project.generation || {};
    const generationStatus = clean(generation.status, 80).toLowerCase();
    if (!["queued", "processing"].includes(generationStatus)) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        status: generationStatus === "completed" ? "COMPLETED" : "FAILED",
        generation,
        project,
      });
    }

    const startedAt = Date.parse(generation.startedAt || "");
    const ageMs = Number.isFinite(startedAt) ? Date.now() - startedAt : STALE_AFTER_MS;
    if (ageMs < STALE_AFTER_MS) {
      return sendJson(res, 409, {
        ok: false,
        error: "generation_not_stale",
        age_ms: ageMs,
        stale_after_ms: STALE_AFTER_MS,
      });
    }

    const now = new Date().toISOString();
    const outputs = Array.isArray(project.outputs) ? project.outputs.filter(Boolean).slice(0, 30) : [];
    const activeOutputId = generation.previousActiveOutputId || project.activeOutputId || outputs[0]?.id || null;
    const failedGeneration = {
      ...generation,
      status: "failed",
      updatedAt: now,
      completedAt: now,
      finalizing: false,
      awaitingFinalComposite: false,
      avatarWaiting: false,
      error: "provider_unavailable_timeout",
      providerUnavailableTimeout: true,
      abandonedAt: now,
    };

    const failedProject = await saveProject(user, {
      ...project,
      status: "failed",
      error: "provider_unavailable_timeout",
      generation: failedGeneration,
      outputs,
      activeOutputId,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      status: "FAILED",
      error: "provider_unavailable_timeout",
      video_url: null,
      generation: failedProject.generation || failedGeneration,
      outputs: failedProject.outputs || outputs,
      activeOutputId: failedProject.activeOutputId || activeOutputId,
      project: failedProject,
    });
  } catch (error) {
    console.error("[ad-film/seedance/abandon]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
