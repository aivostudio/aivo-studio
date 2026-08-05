// api/radio-ad/project.js
export const config = { runtime: "nodejs" };

import {
  createEmptyRadioProject,
  deleteRadioProject,
  getOwnedRadioProject,
  mediaPrefix,
  mergeRadioProject,
  newRadioProjectId,
  resolveRadioAdUser,
  sanitizeRadioProjectPatch,
  saveRadioProject,
  sendJson,
} from "../_lib/radio-ad-projects.js";
import { deleteR2Prefix } from "../_lib/delete-r2-prefix.js";

function readProjectId(req) {
  return String(req.query?.id || req.body?.id || "").trim();
}

function rawProject(req) {
  return req.body?.project && typeof req.body.project === "object"
    ? req.body.project
    : req.body || {};
}

export default async function handler(req, res) {
  try {
    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    if (req.method === "POST") {
      const id = newRadioProjectId();
      const empty = createEmptyRadioProject(user, id);
      const patch = sanitizeRadioProjectPatch(rawProject(req), user, id);
      const saved = await saveRadioProject(user, mergeRadioProject(empty, patch));
      return sendJson(res, 201, { ok: true, project: saved });
    }

    const id = readProjectId(req);
    if (!id) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    if (req.method === "GET") {
      const project = await getOwnedRadioProject(user, id);
      if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
      return sendJson(res, 200, { ok: true, project });
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const project = await getOwnedRadioProject(user, id);
      if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
      const patch = sanitizeRadioProjectPatch(rawProject(req), user, id);
      const saved = await saveRadioProject(user, mergeRadioProject(project, patch));
      return sendJson(res, 200, { ok: true, project: saved });
    }

    if (req.method === "DELETE") {
      const project = await getOwnedRadioProject(user, id);
      if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

      const prefix = mediaPrefix(user, id);
      const deletedObjects = await deleteR2Prefix(prefix);
      const deleted = await deleteRadioProject(user, id);
      if (!deleted) return sendJson(res, 409, { ok: false, error: "project_delete_failed" });

      return sendJson(res, 200, {
        ok: true,
        deleted: true,
        id,
        deleted_r2_objects: deletedObjects,
      });
    }

    res.setHeader("Allow", "GET, POST, PATCH, PUT, DELETE");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("[radio-ad/project]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
