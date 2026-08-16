// Shared authentication, validation and KV persistence for AIVO Radio Ad projects.
import crypto from "crypto";
import kvModule from "../_kv.js";
import authModule from "./auth.js";

const kv = kvModule?.default || kvModule || {};
const auth = authModule?.default || authModule || {};
const { kvGetJson, kvSetJson, kvDel } = kv;
const { requireAuth } = auth;

const PROJECT_PREFIX = "radioad:project:";
const USER_INDEX_PREFIX = "radioad:user:";
const MAX_PROJECTS_PER_USER = 50;

export const RADIO_DURATIONS = Object.freeze([10, 15, 20, 30, 45, 60]);
export const RADIO_LANGUAGES = Object.freeze([
  "tr", "en", "de", "fr", "es", "it", "pt", "ar", "ru", "nl",
  "pl", "uk", "hi", "id", "ms", "ja", "ko", "zh", "vi", "th",
]);
export const RADIO_VOICES = Object.freeze([
  "warm_female", "professional_male", "energetic_male", "clear_female",
]);
export const RADIO_VOICE_STYLES = Object.freeze(["warm", "energetic", "premium", "natural"]);
export const RADIO_SPEEDS = Object.freeze(["slow", "balanced", "fast"]);
export const RADIO_FLOWS = Object.freeze(["natural", "balanced", "emphatic"]);
export const RADIO_MUSIC_MODES = Object.freeze(["ai", "upload", "off"]);
export const RADIO_MUSIC_STYLES = Object.freeze(["auto", "cinematic", "corporate", "electronic", "acoustic"]);
export const RADIO_MUSIC_ENERGIES = Object.freeze(["balanced", "soft", "strong", "high"]);
export const RADIO_OUTPUT_FORMATS = Object.freeze(["mp3", "wav"]);

function assertDependencies() {
  if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function" || typeof kvDel !== "function") {
    throw new Error("radio_ad_kv_helpers_unavailable");
  }
  if (typeof requireAuth !== "function") throw new Error("radio_ad_auth_helper_unavailable");
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export function cleanText(value, max = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function enumValue(value, allowed, fallback) {
  const normalized = cleanText(value, 80).toLocaleLowerCase("tr-TR");
  return allowed.includes(normalized) ? normalized : fallback;
}

function durationValue(value, fallback = 10) {
  const duration = Number.parseInt(value, 10);
  return RADIO_DURATIONS.includes(duration) ? duration : fallback;
}

function safeInteger(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function ownerHash(principal) {
  return crypto
    .createHash("sha256")
    .update(String(principal || "").trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

export async function resolveRadioAdUser(req) {
  assertDependencies();
  let authResult;
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
    ownerHash: ownerHash(principal),
  };
}

export function newRadioProjectId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
}

export function mediaPrefix(user, projectId) {
  return `uploads/radio-ad/${user.ownerHash}/${projectId}/`;
}

export function buildPublicUrl(key) {
  const base = process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE || "https://media.aivo.tr";
  return `${String(base).replace(/\/$/, "")}/${String(key).replace(/^\/+/, "")}`;
}

function sanitizeOwnedUpload(item, prefix) {
  if (!item || typeof item !== "object") return null;
  const key = cleanText(item.key, 900);
  if (!key || !key.startsWith(prefix)) return null;
  return {
    key,
    url: buildPublicUrl(key),
    name: cleanText(item.name || "music", 180),
    contentType: cleanText(item.contentType || "application/octet-stream", 100).toLowerCase(),
    size: Math.max(0, Math.min(Number(item.size) || 0, 30 * 1024 * 1024)),
    uploadedAt: cleanText(item.uploadedAt || new Date().toISOString(), 50),
  };
}

export function createEmptyRadioProject(user, id = newRadioProjectId()) {
  const now = new Date().toISOString();
  return {
    version: 1,
    revision: 0,
    id,
    ownerHash: user.ownerHash,
    userId: user.userId,
    status: "draft",
    title: "Radyo Reklamı",
    narration: {
      text: "",
      language: "tr",
      voice: "warm_female",
      voiceStyle: "warm",
      speed: "fast",
      flow: "natural",
      audio: null,
    },
    narrationGeneration: null,
    music: {
      mode: "ai",
      style: "auto",
      energy: "balanced",
      upload: null,
      audio: null,
    },
    musicGeneration: null,
    output: {
      duration: 10,
      format: "mp3",
    },
    final: null,
    finalGeneration: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizeRadioProjectPatch(raw, user, projectId) {
  const source = raw && typeof raw === "object" ? raw : {};
  const narration = source.narration && typeof source.narration === "object" ? source.narration : {};
  const music = source.music && typeof source.music === "object" ? source.music : {};
  const output = source.output && typeof source.output === "object" ? source.output : {};
  const prefix = mediaPrefix(user, projectId);
  return {
    title: cleanText(source.title || "Radyo Reklamı", 100) || "Radyo Reklamı",
    narration: {
      text: cleanText(narration.text, 2400),
      language: enumValue(narration.language, RADIO_LANGUAGES, "tr"),
      voice: enumValue(narration.voice, RADIO_VOICES, "warm_female"),
      voiceStyle: enumValue(narration.voiceStyle, RADIO_VOICE_STYLES, "warm"),
      speed: enumValue(narration.speed, RADIO_SPEEDS, "fast"),
      flow: enumValue(narration.flow, RADIO_FLOWS, "natural"),
    },
    music: {
      mode: enumValue(music.mode, RADIO_MUSIC_MODES, "ai"),
      style: enumValue(music.style, RADIO_MUSIC_STYLES, "auto"),
      energy: enumValue(music.energy, RADIO_MUSIC_ENERGIES, "balanced"),
      upload: Object.prototype.hasOwnProperty.call(music, "upload")
        ? sanitizeOwnedUpload(music.upload, prefix)
        : undefined,
    },
    output: {
      duration: durationValue(output.duration, 10),
      format: enumValue(output.format, RADIO_OUTPUT_FORMATS, "mp3"),
    },
  };
}

function stableObject(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function sameNarrationSettings(a, b) {
  return stableObject({
    text: a?.text || "",
    language: a?.language || "tr",
    voice: a?.voice || "warm_female",
    voiceStyle: a?.voiceStyle || "warm",
    speed: a?.speed || "fast",
    flow: a?.flow || "natural",
  }) === stableObject({
    text: b?.text || "",
    language: b?.language || "tr",
    voice: b?.voice || "warm_female",
    voiceStyle: b?.voiceStyle || "warm",
    speed: b?.speed || "fast",
    flow: b?.flow || "natural",
  });
}

function sameMusicSettings(a, b) {
  return stableObject({
    mode: a?.mode || "ai",
    style: a?.style || "auto",
    energy: a?.energy || "balanced",
    uploadKey: a?.upload?.key || "",
  }) === stableObject({
    mode: b?.mode || "ai",
    style: b?.style || "auto",
    energy: b?.energy || "balanced",
    uploadKey: b?.upload?.key || "",
  });
}

export function mergeRadioProject(project, patch) {
  const nextNarration = { ...(project.narration || {}), ...(patch.narration || {}) };
  const nextMusic = { ...(project.music || {}), ...(patch.music || {}) };
  if (patch.music && patch.music.upload === undefined) nextMusic.upload = project.music?.upload || null;
  const nextOutput = { ...(project.output || {}), ...(patch.output || {}) };
  const durationChanged = Number(nextOutput.duration) !== Number(project.output?.duration);
  const formatChanged = String(nextOutput.format || "mp3") !== String(project.output?.format || "mp3");
  const narrationChanged = durationChanged || !sameNarrationSettings(project.narration, nextNarration);
  const musicChanged = durationChanged || !sameMusicSettings(project.music, nextMusic);
  const invalidated = narrationChanged || musicChanged || formatChanged;

  return {
    ...project,
    title: patch.title || project.title || "Radyo Reklamı",
    status: invalidated ? "draft" : project.status || "draft",
    narration: {
      ...nextNarration,
      audio: narrationChanged ? null : project.narration?.audio || null,
    },
    narrationGeneration: narrationChanged ? null : project.narrationGeneration || null,
    music: {
      ...nextMusic,
      audio: musicChanged ? null : project.music?.audio || null,
    },
    musicGeneration: musicChanged ? null : project.musicGeneration || null,
    output: nextOutput,
    final: invalidated ? null : project.final || null,
    finalGeneration: invalidated ? null : project.finalGeneration || null,
  };
}

function projectKey(id) {
  return `${PROJECT_PREFIX}${id}`;
}

function indexKey(user) {
  return `${USER_INDEX_PREFIX}${user.ownerHash}:projects`;
}

export async function getRadioProject(id) {
  assertDependencies();
  return await kvGetJson(projectKey(id)).catch(() => null);
}

export async function getOwnedRadioProject(user, id) {
  const project = await getRadioProject(id);
  if (!project || project.ownerHash !== user.ownerHash) return null;
  return project;
}

export async function saveRadioProject(user, project) {
  assertDependencies();
  if (!project?.id || project.ownerHash !== user.ownerHash) throw new Error("invalid_radio_project_owner");
  const next = {
    ...project,
    version: 1,
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
    title: cleanText(next.title || "Radyo Reklamı", 100),
    status: cleanText(next.status || "draft", 30),
    duration: Number(next.output?.duration) || 10,
    format: cleanText(next.output?.format || "mp3", 10),
    updatedAt: next.updatedAt,
    createdAt: next.createdAt,
  };
  const updated = [summary, ...list.filter((item) => item?.id !== next.id)]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_PROJECTS_PER_USER);
  await kvSetJson(indexKey(user), updated);
  return next;
}

export async function deleteRadioProject(user, id) {
  assertDependencies();
  const project = await getOwnedRadioProject(user, id);
  if (!project) return false;
  await kvDel(projectKey(id));
  const currentIndex = await kvGetJson(indexKey(user)).catch(() => []);
  const list = Array.isArray(currentIndex) ? currentIndex : [];
  await kvSetJson(indexKey(user), list.filter((item) => item?.id !== id));
  return true;
}
