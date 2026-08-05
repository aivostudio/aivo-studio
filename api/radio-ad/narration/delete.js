// api/radio-ad/narration/delete.js
export const config = { runtime: "nodejs" };

import { deleteR2Prefix } from "../../_lib/delete-r2-prefix.js";
import {
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "DELETE") {
      res.setHeader("Allow", "POST, DELETE");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId || req.query?.projectId);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const narrationPrefix = `${mediaPrefix(user, projectId)}narration/`;
    const deletedObjects = await deleteR2Prefix(narrationPrefix);
    const saved = await saveRadioProject(user, {
      ...project,
      status: "draft",
      narration: {
        ...(project.narration || {}),
        audio: null,
      },
      narrationGeneration: null,
      final: null,
      finalGeneration: null,
    });

    return sendJson(res, 200, {
      ok: true,
      project: saved,
      deleted_r2_objects: deletedObjects,
    });
  } catch (error) {
    console.error("[radio-ad/narration/delete]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
