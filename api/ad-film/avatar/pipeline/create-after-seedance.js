// api/ad-film/avatar/pipeline/create-after-seedance.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import integratedHandler from "./create-integrated.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

function clean(value, max = 4000) {
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

    const requestedProductionId = clean(req.body?.production_id, 160);
    const acceptedProductionId = clean(
      project?.generation?.productionId ||
      project?.generation?.input?.productionId ||
      project?.productionPlan?.productionId,
      160,
    );

    if (!requestedProductionId || !acceptedProductionId || requestedProductionId !== acceptedProductionId) {
      return sendJson(res, 409, {
        ok: false,
        error: "production_lock_mismatch",
        accepted_production_id: acceptedProductionId || null,
      });
    }

    const seedanceVideoUrl = clean(
      project?.generation?.sourceVideoUrl || project?.generation?.videoUrl,
      4000,
    );
    if (!/^https:\/\//i.test(seedanceVideoUrl)) {
      return sendJson(res, 425, {
        ok: false,
        error: "seedance_generation_not_ready",
        status: project?.generation?.status || "processing",
      });
    }

    return integratedHandler(req, res);
  } catch (error) {
    console.error("[ad-film/avatar/pipeline/create-after-seedance]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: clean(error?.message || error, 1200),
    });
  }
}
