// api/radio-ad/final/status.js
export const config = { runtime: "nodejs" };

import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 240) { return String(value ?? "").trim().slice(0, max); }

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }
    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const projectId = clean(req.query?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    if (project.final?.url) {
      return sendJson(res, 200, { ok: true, status: "COMPLETED", final: project.final, project });
    }
    const generation = project.finalGeneration || {};
    if (generation.status === "failed") {
      return sendJson(res, 200, { ok: true, status: "FAILED", error: generation.error || "final_mix_failed", project });
    }
    if (generation.status === "processing") {
      return sendJson(res, 200, { ok: true, status: "RUNNING", stage: generation.stage || "mixing", project });
    }
    return sendJson(res, 200, { ok: true, status: "IDLE", project });
  } catch (error) {
    console.error("[radio-ad/final/status]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
