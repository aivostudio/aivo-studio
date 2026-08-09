// api/_lib/ad-film-projects.js
// Shared authentication, validation and KV persistence for AI Ad Film projects.

import crypto from "crypto";
import kvModule from "../_kv.js";
import authModule from "./auth.js";

const kv = kvModule?.default || kvModule || {};
const auth = authModule?.default || authModule || {};
const { kvGetJson, kvSetJson, kvDel } = kv;
const { requireAuth } = auth;

const PROJECT_PREFIX = "adfilm:project:";
const USER_INDEX_PREFIX = "adfilm:user:";
const MAX_PROJECTS_PER_USER = 50;

function assertDependencies() {
  if (
    typeof kvGetJson !== "function" ||
    typeof kvSetJson !== "function" ||
    typeof kvDel !== "function"
  ) {
    throw new Error("ad_film_kv_helpers_unavailable");
  }
  if (typeof requireAuth !== "function") {
    throw new Error("ad_film_auth_helper_unavailable");
  }
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function cleanText(value, max = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function boolValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function safeInteger(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const next = Number.parseInt(value, 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

export function ownerHash(principal) {
  return crypto
    .createHash("sha256")
    .update(String(principal || "").trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

export async function resolveAdFilmUser(req) {
  assertDependencies();
  let authResult = null;
  try {
    authResult = await requireAuth(req);
  } catch (_) {
    return null;
  }

  const userId = cleanText(authResult?.user_id, 160);
  const email = cleanText(authResult?.email, 240).toLowerCase();
  const principal = userId || email;
  if (!principal) return null;

  return {
    userId: principal,
    email: email || null,
    role: cleanText(authResult?.role || "user", 40),
    session: cleanText(authResult?.session || "unknown", 40),
    ownerHash: ownerHash(principal),
  };
}

export function newProjectId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
}

export function mediaPrefix(user, projectId) {
  return `uploads/ad-film/${user.ownerHash}/${projectId}/`;
}

export function buildPublicUrl(key) {
  const base =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    "https://media.aivo.tr";
  return `${String(base).replace(/\/$/, "")}/${String(key).replace(/^\/+/, "")}`;
}

function sanitizeMediaItem(item, expectedPrefix, fallbackKind) {
  if (!item || typeof item !== "object") return null;
  const key = cleanText(item.key, 600);
  if (!key || !key.startsWith(expectedPrefix)) return null;

  return {
    key,
    url: buildPublicUrl(key),
    name: cleanText(item.name || "media", 160),
    contentType: cleanText(
      item.contentType || "application/octet-stream",
      100
    ).toLowerCase(),
    size: Math.max(
      0,
      Math.min(Number(item.size) || 0, 150 * 1024 * 1024)
    ),
    kind: cleanText(item.kind || fallbackKind || "media", 40),
    uploadedAt: cleanText(item.uploadedAt || new Date().toISOString(), 40),
  };
}

function sanitizeMusic(source, mediaSource, prefix) {
  const musicSource = source && typeof source === "object" ? source : {};
  const mode = enumValue(musicSource.mode, ["auto", "upload", "off"], "auto");

  return {
    mode,
    style: enumValue(
      musicSource.style,
      ["auto", "pop", "cinematic", "electronic", "classical", "rnb", "latin"],
      "auto"
    ),
    energy: enumValue(
      musicSource.energy,
      ["calm", "balanced", "strong"],
      "balanced"
    ),
    track:
      mediaSource?.musicTrack === null
        ? null
        : sanitizeMediaItem(mediaSource?.musicTrack, prefix, "music-track"),
  };
}

export function sanitizeProjectPatch(patch, user, projectId) {
  const source = patch && typeof patch === "object" ? patch : {};
  const prefix = mediaPrefix(user, projectId);

  const briefSource = source.brief || source.product || {};
  const narrationSource = source.narration || {};
  const outputSource = source.output || {};
  const mediaSource = source.media || {};

  const productImages = Array.isArray(mediaSource.productImages)
    ? mediaSource.productImages
        .map((item) => sanitizeMediaItem(item, prefix, "product-image"))
        .filter(Boolean)
        .slice(0, 6)
    : undefined;

  const logo =
    mediaSource.logo === null
      ? null
      : sanitizeMediaItem(mediaSource.logo, prefix, "logo");
  const extraMedia =
    mediaSource.extraMedia === null
      ? null
      : sanitizeMediaItem(mediaSource.extraMedia, prefix, "extra-media");
  const music = sanitizeMusic(source.music, mediaSource, prefix);

  const result = {
    mode: enumValue(source.mode, ["basic"], "basic"),
    brief: {
      productName: cleanText(briefSource.productName, 80),
      brandName: cleanText(briefSource.brandName, 60),
      description: cleanText(briefSource.description, 420),
      creativeBrief: cleanText(briefSource.creativeBrief, 700),
      targetAudience: cleanText(briefSource.targetAudience, 100),
      cta: cleanText(briefSource.cta, 100),
    },
    narration: {
      enabled: boolValue(narrationSource.enabled, true),
      scriptMode: enumValue(
        narrationSource.scriptMode,
        ["ai", "manual"],
        "ai"
      ),
      language: enumValue(
        narrationSource.language,
        ["tr", "en", "de", "ar"],
        "tr"
      ),
      voiceStyle: enumValue(
        narrationSource.voiceStyle,
        ["warm", "energetic", "premium", "natural"],
        "warm"
      ),
      speed: enumValue(
        narrationSource.speed,
        ["slow", "balanced", "fast"],
        "balanced"
      ),
      flow: enumValue(
        narrationSource.flow,
        ["natural", "balanced", "emphatic"],
        "natural"
      ),
      text: cleanText(
        narrationSource.text || narrationSource.narrationText,
        650
      ),
    },
    sceneStyle: enumValue(
      source.sceneStyle,
      ["premium", "minimal", "luxury", "social", "studio", "cinematic"],
      "premium"
    ),
    music,
    output: {
      duration: enumValue(
        outputSource.duration,
        ["5", "10", "15", "20"],
        "10"
      ),
      aspectRatio: enumValue(
        outputSource.aspectRatio,
        ["9:16", "1:1", "16:9", "4:5", "3:4", "4:3", "21:9"],
        "9:16"
      ),
      quality: enumValue(outputSource.quality, ["1080p", "2k"], "1080p"),
      subtitles: boolValue(outputSource.subtitles, true),
      music: music.mode !== "off",
      soundEffects: boolValue(outputSource.soundEffects, false),
    },
  };

  if (
    productImages !== undefined ||
    logo !== undefined ||
    extraMedia !== undefined ||
    Object.prototype.hasOwnProperty.call(mediaSource, "musicTrack")
  ) {
    result.media = {};
    if (productImages !== undefined) result.media.productImages = productImages;
    if (logo !== undefined) result.media.logo = logo;
    if (extraMedia !== undefined) result.media.extraMedia = extraMedia;
    if (Object.prototype.hasOwnProperty.call(mediaSource, "musicTrack")) {
      result.media.musicTrack = music.track;
    }
  }

  return result;
}

export function createEmptyProject(user, id = newProjectId()) {
  const now = new Date().toISOString();
  return {
    version: 2,
    revision: 0,
    id,
    ownerHash: user.ownerHash,
    userId: user.userId,
    mode: "basic",
    status: "draft",
    brief: {
      productName: "",
      brandName: "",
      description: "",
      creativeBrief: "",
      targetAudience: "",
      cta: "",
    },
    narration: {
      enabled: true,
      scriptMode: "ai",
      language: "tr",
      voiceStyle: "warm",
      speed: "balanced",
      flow: "natural",
      text: "",
    },
    sceneStyle: "premium",
    music: {
      mode: "auto",
      style: "auto",
      energy: "balanced",
      track: null,
    },
    output: {
      duration: "10",
      aspectRatio: "9:16",
      quality: "1080p",
      subtitles: true,
      music: true,
      soundEffects: false,
    },
    media: {
      productImages: [],
      logo: null,
      extraMedia: null,
      musicTrack: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function projectKey(id) {
  return `${PROJECT_PREFIX}${id}`;
}

function indexKey(user) {
  return `${USER_INDEX_PREFIX}${user.ownerHash}:projects`;
}

export async function getProject(id) {
  assertDependencies();
  return await kvGetJson(projectKey(id)).catch(() => null);
}

export async function getOwnedProject(user, id) {
  const project = await getProject(id);
  if (!project || project.ownerHash !== user.ownerHash) return null;
  return project;
}

export async function saveProject(user, project) {
  assertDependencies();
  if (!project?.id || project.ownerHash !== user.ownerHash) {
    throw new Error("invalid_project_owner");
  }

  const next = {
    ...project,
    version: 2,
    revision: safeInteger(project.revision, 0) + 1,
    ownerHash: user.ownerHash,
    userId: user.userId,
    updatedAt: new Date().toISOString(),
  };

  await kvSetJson(projectKey(next.id), next);

  const currentIndex = await kvGetJson(indexKey(user)).catch(() => []);
  const list = Array.isArray(currentIndex) ? currentIndex : [];
  const summary = {
    id: next.id,
    title: cleanText(
      next.brief?.productName || "İsimsiz Reklam Projesi",
      80
    ),
    status: cleanText(next.status || "draft", 30),
    duration: cleanText(next.output?.duration || "10", 4),
    aspectRatio: cleanText(next.output?.aspectRatio || "9:16", 10),
    quality: cleanText(next.output?.quality || "1080p", 10),
    updatedAt: next.updatedAt,
    createdAt: next.createdAt,
    thumbnailUrl: next.media?.productImages?.[0]?.url || null,
  };

  const updatedIndex = [
    summary,
    ...list.filter((item) => item?.id !== next.id),
  ]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_PROJECTS_PER_USER);

  await kvSetJson(indexKey(user), updatedIndex);
  return next;
}

export async function listProjects(user) {
  assertDependencies();
  const index = await kvGetJson(indexKey(user)).catch(() => []);
  return Array.isArray(index) ? index.slice(0, MAX_PROJECTS_PER_USER) : [];
}

export async function deleteProject(user, id) {
  assertDependencies();
  const project = await getOwnedProject(user, id);
  if (!project) return false;
  await kvDel(projectKey(id));
  const currentIndex = await kvGetJson(indexKey(user)).catch(() => []);
  const list = Array.isArray(currentIndex) ? currentIndex : [];
  await kvSetJson(
    indexKey(user),
    list.filter((item) => item?.id !== id)
  );
  return true;
}

export function mergeProject(project, sanitizedPatch) {
  return {
    ...project,
    mode: sanitizedPatch.mode || project.mode,
    brief: { ...project.brief, ...(sanitizedPatch.brief || {}) },
    narration: {
      ...project.narration,
      ...(sanitizedPatch.narration || {}),
    },
    sceneStyle: sanitizedPatch.sceneStyle || project.sceneStyle,
    music: { ...project.music, ...(sanitizedPatch.music || {}) },
    output: { ...project.output, ...(sanitizedPatch.output || {}) },
    media: { ...project.media, ...(sanitizedPatch.media || {}) },
    status: "draft",
  };
}