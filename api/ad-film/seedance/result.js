// api/ad-film/seedance/result.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "DELETE" && req.method !== "POST") {
      res.setHeader("Allow", "DELETE, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.query?.projectId || req.body?.projectId, 120);
    if (!projectId) {
      return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    }

    const project = await getOwnedProject(user, projectId);
    if (!project) {
      return sendJson(res, 404, { ok: false, error: "project_not_found" });
    }

    const saved = await saveProject(user, {
      ...project,
      status: "draft",
      generation: null,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      removed: true,
      project: saved,
    });
  } catch (error) {
    console.error("[ad-film/seedance/result]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
