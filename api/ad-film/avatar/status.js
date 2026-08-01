// api/ad-film/avatar/status.js
export const config = { runtime: "nodejs" };
export const maxDuration = 90;

import { putObject } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const FRESH_404_GRACE_MS = 90 * 1000;
const MAX_JOB_MS = 25 * 60 * 1000;

function clean(value, max = 4000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function parseJson(value) {
  try { return value ? JSON.parse(value) : {}; }
  catch (_) { return {}; }
}
function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}
function pick(object, paths) {
  for (const path of paths) {
    let current = object;
    let valid = true;
    for (const key of path.split(".")) {
      if (!current || typeof current !== "object" || !(key in current)) {
        valid = false;
        break;
      }
      current = current[key];
    }
    if (valid && current != null) return current;
  }
  return null;
}
function providerError(payload, fallback = "avatar_generation_failed") {
  const value = pick(payload, [
    "error", "message", "detail", "data.error", "data.message", "data.detail",
    "result.error", "result.message",
  ]);
  if (typeof value === "string" && value.trim()) return clean(value, 1200);
  if (Array.isArray(value)) {
    const text = value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.msg || item.message || item.error || JSON.stringify(item);
      return "";
    }).filter(Boolean).join(" | ");
    if (text) return clean(text, 1200);
  }
  try {
    const serialized = JSON.stringify(payload || {});
    if (serialized && serialized !== "{}") return clean(serialized, 1200);
  } catch (_) {}
  return fallback;
}
function imageUrlFrom(payload) {
  const direct = pick(payload, [
    "images.0.url", "data.images.0.url", "result.images.0.url", "output.images.0.url",
    "image.url", "data.image.url", "result.image.url", "output.image.url",
  ]);
  return typeof direct === "string" && /^https:\/\//i.test(direct) ? direct : "";
}
function normalizeStatus(value, imageUrl) {
  if (imageUrl) return "COMPLETED";
  const status = clean(value, 80).toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(status)) return "COMPLETED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}
function fresh(job) {
  const submittedAt = Date.parse(job?.submittedAt || "");
  return Number.isFinite(submittedAt) && Date.now() - submittedAt < FRESH_404_GRACE_MS;
}
async function falFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Key ${falKey()}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    return { response, data: parseJson(await response.text().catch(() => "")) };
  } finally {
    clearTimeout(timeout);
  }
}
async function readJob(job) {
  if (!job?.model || !job?.requestId) return { status: "FAILED", error: "avatar_job_missing" };
  const statusUrl = clean(job.statusUrl, 1800) || `https://queue.fal.run/${job.model}/requests/${encodeURIComponent(job.requestId)}/status`;
  const responseUrl = clean(job.responseUrl, 1800) || `https://queue.fal.run/${job.model}/requests/${encodeURIComponent(job.requestId)}`;
  const statusResult = await falFetch(statusUrl);
  if (!statusResult.response.ok) {
    if (statusResult.response.status === 404 && fresh(job)) return { status: "IN_QUEUE", statusUrl, responseUrl };
    return { status: "FAILED", error: providerError(statusResult.data, `avatar_status_http_${statusResult.response.status}`), statusUrl, responseUrl };
  }
  const raw = pick(statusResult.data, ["status", "state", "data.status", "result.status"]);
  let imageUrl = imageUrlFrom(statusResult.data);
  let status = normalizeStatus(raw, imageUrl);
  if (!imageUrl && status === "COMPLETED") {
    const result = await falFetch(responseUrl);
    if (!result.response.ok) {
      if ((result.response.status === 202 || result.response.status === 404) && fresh(job)) return { status: "RUNNING", statusUrl, responseUrl };
      return { status: "FAILED", error: providerError(result.data, `avatar_result_http_${result.response.status}`), statusUrl, responseUrl };
    }
    imageUrl = imageUrlFrom(result.data);
    status = normalizeStatus(raw, imageUrl);
    if (!imageUrl && status === "COMPLETED") return { status: "RUNNING", statusUrl, responseUrl };
  }
  return {
    status,
    imageUrl,
    statusUrl,
    responseUrl,
    error: status === "FAILED" ? providerError(statusResult.data) : null,
  };
}
async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`avatar_copy_fetch_failed:${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length || body.length > 25 * 1024 * 1024) throw new Error("avatar_copy_invalid_size");
    return {
      body,
      contentType: clean(response.headers.get("content-type"), 120) || "image/jpeg",
    };
  } finally {
    clearTimeout(timeout);
  }
}
async function markFailed(user, project, message) {
  const avatar = project.avatar || {};
  const generation = avatar.imageGeneration || {};
  const now = new Date().toISOString();
  return saveProject(user, {
    ...project,
    avatar: {
      ...avatar,
      imageGeneration: {
        ...generation,
        status: "failed",
        stage: "failed",
        updatedAt: now,
        failedAt: now,
        error: clean(message, 1200) || "avatar_generation_failed",
      },
    },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const projectId = clean(source.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const avatar = project.avatar || {};
    const generation = avatar.imageGeneration;
    if (!generation) return sendJson(res, 200, { ok: true, status: "IDLE", avatar, project });
    if (generation.status === "completed" && avatar.image?.url) {
      return sendJson(res, 200, { ok: true, status: "COMPLETED", avatar, generation, project });
    }
    if (generation.status === "failed") {
      return sendJson(res, 200, { ok: true, status: "FAILED", avatar, generation, project });
    }
    const startedAt = Date.parse(generation.startedAt || "");
    if (Number.isFinite(startedAt) && Date.now() - startedAt > MAX_JOB_MS) {
      const saved = await markFailed(user, project, "avatar_generation_timeout");
      return sendJson(res, 200, { ok: true, status: "FAILED", avatar: saved.avatar, generation: saved.avatar.imageGeneration, project: saved });
    }
    if (!falKey()) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const result = await readJob(generation.job);
    const now = new Date().toISOString();
    if (result.status === "FAILED") {
      const saved = await markFailed(user, project, result.error || "avatar_generation_failed");
      return sendJson(res, 200, { ok: true, status: "FAILED", avatar: saved.avatar, generation: saved.avatar.imageGeneration, project: saved });
    }
    if (result.status !== "COMPLETED" || !result.imageUrl) {
      const nextGeneration = {
        ...generation,
        status: result.status === "IN_QUEUE" ? "queued" : "running",
        stage: result.status === "IN_QUEUE" ? "queued" : "generating",
        updatedAt: now,
        job: { ...generation.job, statusUrl: result.statusUrl, responseUrl: result.responseUrl },
        error: null,
      };
      const saved = await saveProject(user, { ...project, avatar: { ...avatar, imageGeneration: nextGeneration } });
      return sendJson(res, 200, {
        ok: true,
        status: result.status === "IN_QUEUE" ? "IN_QUEUE" : "RUNNING",
        stage: nextGeneration.stage,
        avatar: saved.avatar,
        generation: nextGeneration,
        project: saved,
      });
    }

    const savingGeneration = { ...generation, status: "saving", stage: "saving", updatedAt: now, sourceUrl: result.imageUrl, error: null };
    await saveProject(user, { ...project, avatar: { ...avatar, imageGeneration: savingGeneration } });
    const downloaded = await downloadImage(result.imageUrl);
    const extension = downloaded.contentType.includes("png") ? "png" : downloaded.contentType.includes("webp") ? "webp" : "jpg";
    const objectKey = `${mediaPrefix(user, projectId)}avatar/generated-${Date.now()}.${extension}`;
    const avatarUrl = await putObject({
      key: objectKey,
      body: downloaded.body,
      contentType: downloaded.contentType,
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });
    const image = {
      key: objectKey,
      url: avatarUrl,
      name: `aivo-avatar.${extension}`,
      contentType: downloaded.contentType,
      size: downloaded.body.length,
      kind: "avatar-image",
      source: "generated",
      uploadedAt: new Date().toISOString(),
    };
    const completedAt = new Date().toISOString();
    const completedGeneration = {
      ...savingGeneration,
      status: "completed",
      stage: "completed",
      updatedAt: completedAt,
      completedAt,
      outputUrl: avatarUrl,
      error: null,
    };
    const saved = await saveProject(user, {
      ...project,
      avatar: {
        ...avatar,
        enabled: true,
        mode: "suggest",
        ...(generation.settings || {}),
        image,
        imageGeneration: completedGeneration,
        pipeline: null,
        videoUrl: null,
      },
    });
    return sendJson(res, 200, {
      ok: true,
      status: "COMPLETED",
      avatar: saved.avatar,
      generation: completedGeneration,
      project: saved,
    });
  } catch (error) {
    console.error("[ad-film/avatar/status]", error);
    const timeout = error?.name === "AbortError";
    return sendJson(res, Number(error?.status) || (timeout ? 504 : 500), {
      ok: false,
      error: timeout ? "avatar_status_timeout" : clean(error?.message || error, 1200) || "server_error",
    });
  }
}
