// api/ad-film/project.js
import {
  createEmptyProject,
  deleteProject,
  getOwnedProject,
  mergeProject,
  newProjectId,
  resolveAdFilmUser,
  sanitizeProjectPatch,
  saveProject,
  sendJson,
} from "../_lib/ad-film-projects.js";

function readProjectId(req) {
  return String(req.query?.id || req.body?.id || "").trim();
}

export default async function handler(req, res) {
  try {
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    if (req.method === "POST") {
      const id = newProjectId();
      let project = createEmptyProject(user, id);
      const patch = sanitizeProjectPatch(req.body?.project || req.body || {}, user, id);
      project = mergeProject(project, patch);
      const saved = await saveProject(user, project);
      return sendJson(res, 201, { ok: true, project: saved });
    }

    const id = readProjectId(req);
    if (!id) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    if (req.method === "GET") {
      const project = await getOwnedProject(user, id);
      if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
      return sendJson(res, 200, { ok: true, project });
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const current = await getOwnedProject(user, id);
      if (!current) return sendJson(res, 404, { ok: false, error: "project_not_found" });
      const patch = sanitizeProjectPatch(req.body?.project || req.body || {}, user, id);
      const saved = await saveProject(user, mergeProject(current, patch));
      return sendJson(res, 200, { ok: true, project: saved });
    }

    if (req.method === "DELETE") {
      const deleted = await deleteProject(user, id);
      if (!deleted) return sendJson(res, 404, { ok: false, error: "project_not_found" });
      return sendJson(res, 200, { ok: true, deleted: true, id });
    }

    res.setHeader("Allow", "GET, POST, PATCH, PUT, DELETE");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("[ad-film/project]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
