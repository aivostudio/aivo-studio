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
const AVATAR_COUNTRIES = new Set([
  "tr", "us", "de", "fr", "es", "it", "br", "arab", "ru", "nl",
  "pl", "ua", "in", "id", "my", "jp", "kr", "cn", "vn", "th",
]);
const AVATAR_MODES = new Set(["upload", "suggest"]);
const AVATAR_GENDERS = new Set(["female", "male"]);
const AVATAR_AGES = new Set(["18-25", "26-35", "36-50", "50+"]);
const AVATAR_HAIR_COLORS = new Set(["black", "brown", "blonde", "red", "gray"]);
const AVATAR_HAIR_STYLES = new Set(["short", "medium", "long", "straight", "wavy", "curly"]);
const AVATAR_FRAMINGS = new Set(["shoulders", "chest", "waist", "full"]);
const AVATAR_EXPRESSIONS = new Set(["friendly", "confident", "calm", "energetic"]);
const AVATAR_OUTFITS = new Set(["casual", "business", "premium", "sport", "elegant"]);
const AVATAR_PROMPT_MAX = 1000;

function readProjectId(req) {
  return String(req.query?.id || req.body?.id || "").trim();
}

function clean(value, max = 160) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = AVATAR_PROMPT_MAX) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function boolValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeAvatarMedia(item, user, projectId) {
  if (!item || typeof item !== "object") return null;
  const key = clean(item.key, 600);
  const prefix = `uploads/ad-film/${user.ownerHash}/${projectId}/`;
  if (!key || !key.startsWith(prefix)) return null;
  const base = String(process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE || "https://media.aivo.tr").replace(/\/$/, "");
  return {
    key,
    url: `${base}/${key.replace(/^\/+/, "")}`,
    name: clean(item.name || "avatar.jpg", 160),
    contentType: clean(item.contentType || "image/jpeg", 100).toLowerCase(),
    size: Math.max(0, Math.min(Number(item.size) || 0, 12 * 1024 * 1024)),
    kind: "avatar-image",
    uploadedAt: clean(item.uploadedAt || new Date().toISOString(), 40),
    source: enumValue(item.source, new Set(["upload", "generated"]), "upload"),
  };
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

function extendAvatarPatch(rawProject, sanitizedPatch, user, projectId) {
  if (!Object.prototype.hasOwnProperty.call(rawProject || {}, "avatar")) return sanitizedPatch;
  const source = rawProject.avatar && typeof rawProject.avatar === "object" ? rawProject.avatar : {};
  const avatar = {
    enabled: boolValue(source.enabled, false),
    mode: enumValue(source.mode, AVATAR_MODES, "upload"),
    country: enumValue(source.country, AVATAR_COUNTRIES, "tr"),
    gender: enumValue(source.gender, AVATAR_GENDERS, "female"),
    age: enumValue(source.age, AVATAR_AGES, "26-35"),
    hairColor: enumValue(source.hairColor, AVATAR_HAIR_COLORS, "brown"),
    hairStyle: enumValue(source.hairStyle, AVATAR_HAIR_STYLES, "medium"),
    framing: enumValue(source.framing, AVATAR_FRAMINGS, "chest"),
    expression: enumValue(source.expression, AVATAR_EXPRESSIONS, "friendly"),
    outfit: enumValue(source.outfit, AVATAR_OUTFITS, "business"),
    directorNote: cleanMultiline(source.directorNote, AVATAR_PROMPT_MAX),
    sceneDescription: cleanMultiline(source.sceneDescription, AVATAR_PROMPT_MAX),
    image: source.image === null ? null : sanitizeAvatarMedia(source.image, user, projectId),
  };
  return { ...sanitizedPatch, avatar };
}

function projectPatch(req, user, id) {
  const raw = req.body?.project || req.body || {};
  const narrationExtended = extendNarrationPatch(raw, sanitizeProjectPatch(raw, user, id));
  return extendAvatarPatch(raw, narrationExtended, user, id);
}

function mergeWithAvatar(current, patch) {
  const merged = mergeProject(current, patch);
  if (!patch.avatar) return merged;
  return {
    ...merged,
    avatar: {
      enabled: false,
      mode: "upload",
      country: "tr",
      gender: "female",
      age: "26-35",
      hairColor: "brown",
      hairStyle: "medium",
      framing: "chest",
      expression: "friendly",
      outfit: "business",
      directorNote: "",
      sceneDescription: "",
      image: null,
      ...(current.avatar || {}),
      ...patch.avatar,
    },
  };
}

export default async function handler(req, res) {
  try {
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    if (req.method === "POST") {
      const id = newProjectId();
      let project = createEmptyProject(user, id);
      project = mergeWithAvatar(project, projectPatch(req, user, id));
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
      const saved = await saveProject(user, mergeWithAvatar(current, projectPatch(req, user, id)));
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
