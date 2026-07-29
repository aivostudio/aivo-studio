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

const NARRATION_LANGUAGES = new Set([
  "tr", "en", "de", "fr", "es", "it", "pt", "ar", "ru", "nl",
  "pl", "uk", "hi", "id", "ms", "ja", "ko", "zh", "vi", "th",
]);
const NARRATION_VOICES = new Set([
  "warm_female", "professional_male", "energetic_male", "clear_female",
]);

function readProjectId(req) {
  return String(req.query?.id || req.body?.id || "").trim();
}

function extendNarrationPatch(rawProject, sanitizedPatch) {
  const source = rawProject?.narration;
  if (!source || typeof source !== "object") return sanitizedPatch;
  const language = String(source.language || "").trim().toLowerCase();
  const voice = String(source.voice || "").trim().toLowerCase();
  const narration = { ...(sanitizedPatch.narration || {}) };
  if (NARRATION_LANGUAGES.has(language)) narration.language = language;
  if (NARRATION_VOICES.has(voice)) narration.voice = voice;
  return { ...sanitizedPatch, narration };
}

function projectPatch(req, user, id) {
  const raw = req.body?.project || req.body || {};
  return extendNarrationPatch(raw, sanitizeProjectPatch(raw, user, id));
}

export default async function handler(req, res) {
  try {
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    if (req.method === "POST") {
      const id = newProjectId();
      let project = createEmptyProject(user, id);
      project = mergeProject(project, projectPatch(req, user, id));
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
      const saved = await saveProject(user, mergeProject(current, projectPatch(req, user, id)));
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
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
