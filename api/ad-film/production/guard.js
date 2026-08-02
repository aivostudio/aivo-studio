// api/ad-film/production/guard.js
export const config = { runtime: "nodejs" };
export const maxDuration = 60;

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";
import {
  buildCancelledProject,
  cancelFalJobs,
  cancellationResponse,
  productionSla,
} from "../../_lib/ad-film-production-sla.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const projectId = clean(source.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const policy = productionSla(project);
    const status = clean(project.status, 40).toLowerCase();
    if (["cancelled", "canceled"].includes(status) && project?.error === "production_sla_timeout") {
      return sendJson(res, 200, cancellationResponse(project, policy));
    }

    if (!policy.expired) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        status: "ACTIVE",
        expired: false,
        resolution: policy.resolution,
        started_at: policy.startedAt,
        deadline_at: policy.deadlineAt,
        elapsed_ms: policy.elapsedMs,
        limit_ms: policy.limitMs,
      });
    }

    const cancellationResults = await cancelFalJobs(project, falKey());
    const now = new Date().toISOString();
    const cancelled = buildCancelledProject(project, policy, cancellationResults, now);
    const saved = await saveProject(user, cancelled);

    return sendJson(res, 200, cancellationResponse(saved, policy));
  } catch (error) {
    console.error("[ad-film/production/guard]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: clean(error?.message || error, 1200),
    });
  }
}
