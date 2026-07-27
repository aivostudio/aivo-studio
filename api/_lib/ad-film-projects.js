// api/_lib/ad-film-projects.js
// Shared auth, validation and KV persistence for AI Ad Film drafts.

import crypto from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const kvMod = require("../_kv.js");
const { kvGetJson, kvSetJson, kvDel } = kvMod;

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET || "";
const PROJECT_PREFIX = "adfilm:project:";
const USER_INDEX_PREFIX = "adfilm:user:";
const MAX_PROJECTS_PER_USER = 50;

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index < 0) return;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) out[key] = value;
    });
  return out;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function b64urlDecode(value) {
  let source = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (source.length % 4) source += "=";
  return Buffer.from(source, "base64").toString("utf8");
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function verifyLegacyJwt(token) {
  if (!JWT_SECRET) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = signHS256(`${header}.${payload}`, JWT_SECRET);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(b64urlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && now > Number(decoded.exp)) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

export function ownerHash(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 24);
}

export async function resolveAdFilmUser(req) {
  const cookies = parseCookies(req?.headers?.cookie);
  const sid = cookies[COOKIE_KV];

  if (sid) {
    const session = await kvGetJson(`sess:${sid}`).catch(() => null);
    const email = normalizeEmail(session?.email);
    if (!email) return null;
    return {
      email,
      role: String(session?.role || "user"),
      session: "kv",
      ownerHash: ownerHash(email),
    };
  }

  const legacy = verifyLegacyJwt(cookies[COOKIE_JWT]);
  const email = normalizeEmail(legacy?.email || legacy?.sub);
  if (!email) return null;
  return {
    email,
    role: String(legacy?.role || "user"),
    session: "jwt",
    ownerHash: ownerHash(email),
  };
}

export function newProjectId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
}

function cleanText(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function boolValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeMediaItem(item, expectedPrefix) {
  if (!item || typeof item !== "object") return null;
  const key = cleanText(item.key, 600);
  if (!key || !key.startsWith(expectedPrefix)) return null;
  return {
    key,
    url: buildPublicUrl(key),
    name: cleanText(item.name || "media", 160),
    contentType: cleanText(item.contentType || "application/octet-stream", 100).toLowerCase(),
    size: Math.max(0, Math.min(Number(item.size) || 0, 150 * 1024 * 1024)),
    kind: cleanText(item.kind || "media", 40),
    uploadedAt: cleanText(item.uploadedAt || new Date().toISOString(), 40),
  };
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

export function sanitizeProjectPatch(patch, user, projectId) {
  const source = patch && typeof patch === "object" ? patch : {};
  const prefix = mediaPrefix(user, projectId);

  const briefSource = source.brief || source.product || {};
  const narrationSource = source.narration || {};
  const outputSource = source.output || {};
  const mediaSource = source.media || {};

  const productImages = Array.isArray(mediaSource.productImages)
    ? mediaSource.productImages
        .map((item) => sanitizeMediaItem(item, prefix))
        .filter(Boolean)
        .slice(0, 6)
    : undefined;

  const logo = mediaSource.logo === null
    ? null
    : sanitizeMediaItem(mediaSource.logo, prefix);
  const extraMedia = mediaSource.extraMedia === null
    ? null
    : sanitizeMediaItem(mediaSource.extraMedia, prefix);

  const result = {
    mode: enumValue(source.mode, ["basic"], "basic"),
    brief: {
      productName: cleanText(briefSource.productName, 80),
      brandName: cleanText(briefSource.brandName, 60),
      description: cleanText(briefSource.description, 420),
      targetAudience: cleanText(briefSource.targetAudience, 100),
      cta: cleanText(briefSource.cta, 100),
    },
    narration: {
      enabled: boolValue(narrationSource.enabled, true),
      scriptMode: enumValue(narrationSource.scriptMode, ["ai", "manual"], "ai"),
      language: enumValue(narrationSource.language, ["tr", "en", "de", "ar"], "tr"),
      voiceStyle: enumValue(
        narrationSource.voiceStyle,
        ["warm", "energetic", "premium", "natural"],
        "warm"
      ),
      text: cleanText(narrationSource.text || narrationSource.narrationText, 650),
    },
    sceneStyle: enumValue(
      source.sceneStyle,
      ["premium", "minimal", "luxury", "social", "studio", "cinematic"],
      "premium"
    ),
    output: {
      duration: enumValue(outputSource.duration, ["5", "10", "15", "20"], "10"),
      aspectRatio: enumValue(outputSource.aspectRatio, ["9:16", "1:1", "16:9", "4:5"], "9:16"),
      quality: enumValue(outputSource.quality, ["1080p", "2k"], "1080p"),
      subtitles: boolValue(outputSource.subtitles, true),
      music: boolValue(outputSource.music, true),
      soundEffects: boolValue(outputSource.soundEffects, false),
    },
  };

  if (productImages !== undefined || logo !== undefined || extraMedia !== undefined) {
    result.media = {};
    if (productImages !== undefined) result.media.productImages = productImages;
    if (logo !== undefined) result.media.logo = logo;
    if (extraMedia !== undefined) result.media.extraMedia = extraMedia;
  }

  return result;
}

export function createEmptyProject(user, id = newProjectId()) {
  const now = new Date().toISOString();
  return {
    version: 1,
    id,
    ownerHash: user.ownerHash,
    mode: "basic",
    status: "draft",
    brief: {
      productName: "",
      brandName: "",
      description: "",
      targetAudience: "",
      cta: "",
    },
    narration: {
      enabled: true,
      scriptMode: "ai",
      language: "tr",
      voiceStyle: "warm",
      text: "",
    },
    sceneStyle: "premium",
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
  return await kvGetJson(projectKey(id)).catch(() => null);
}

export async function getOwnedProject(user, id) {
  const project = await getProject(id);
  if (!project || project.ownerHash !== user.ownerHash) return null;
  return project;
}

export async function saveProject(user, project) {
  if (!project?.id || project.ownerHash !== user.ownerHash) {
    throw new Error("invalid_project_owner");
  }

  const next = {
    ...project,
    ownerHash: user.ownerHash,
    updatedAt: new Date().toISOString(),
  };

  await kvSetJson(projectKey(next.id), next);

  const currentIndex = await kvGetJson(indexKey(user)).catch(() => []);
  const list = Array.isArray(currentIndex) ? currentIndex : [];
  const summary = {
    id: next.id,
    title: cleanText(next.brief?.productName || "İsimsiz Reklam Projesi", 80),
    status: cleanText(next.status || "draft", 30),
    aspectRatio: cleanText(next.output?.aspectRatio || "9:16", 10),
    updatedAt: next.updatedAt,
    createdAt: next.createdAt,
    thumbnailUrl: next.media?.productImages?.[0]?.url || null,
  };
  const updatedIndex = [summary, ...list.filter((item) => item?.id !== next.id)]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_PROJECTS_PER_USER);
  await kvSetJson(indexKey(user), updatedIndex);

  return next;
}

export async function listProjects(user) {
  const index = await kvGetJson(indexKey(user)).catch(() => []);
  return Array.isArray(index) ? index.slice(0, MAX_PROJECTS_PER_USER) : [];
}

export async function deleteProject(user, id) {
  const project = await getOwnedProject(user, id);
  if (!project) return false;
  await kvDel(projectKey(id));
  const currentIndex = await kvGetJson(indexKey(user)).catch(() => []);
  const list = Array.isArray(currentIndex) ? currentIndex : [];
  await kvSetJson(indexKey(user), list.filter((item) => item?.id !== id));
  return true;
}

export function mergeProject(project, sanitizedPatch) {
  const next = {
    ...project,
    mode: sanitizedPatch.mode || project.mode,
    brief: { ...project.brief, ...(sanitizedPatch.brief || {}) },
    narration: { ...project.narration, ...(sanitizedPatch.narration || {}) },
    sceneStyle: sanitizedPatch.sceneStyle || project.sceneStyle,
    output: { ...project.output, ...(sanitizedPatch.output || {}) },
    media: { ...project.media, ...(sanitizedPatch.media || {}) },
    status: "draft",
  };
  return next;
}
