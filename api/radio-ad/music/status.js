// api/radio-ad/music/status.js
export const config = { runtime: "nodejs" };

import { putObject } from "../../_lib/r2.js";
import {
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

const PIPELINE_VERSION = "radio-music-v2";
const OUTPUT_FORMAT = "mp3";
const OUTPUT_BITRATE = "320k";
const MAX_BYTES = 80 * 1024 * 1024;

function clean(value, max = 1800) { return String(value ?? "").trim().slice(0, max); }
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function pick(data, keys) {
  for (const key of keys) {
    let current = data;
    let valid = true;
    for (const part of key.split(".")) {
      if (!current || typeof current !== "object" || !(part in current)) { valid = false; break; }
      current = current[part];
    }
    if (valid && current != null) return current;
  }
  return null;
}
function audioFile(data) {
  const item = pick(data, ["audio", "output.audio", "data.audio", "result.audio", "response.audio"]);
  if (item && typeof item === "object" && /^https:\/\//i.test(String(item.url || ""))) {
    return {
      url: String(item.url),
      contentType: clean(item.content_type || item.contentType, 100),
      fileName: clean(item.file_name || item.fileName, 180),
    };
  }
  const url = pick(data, ["audio_url", "output.audio_url", "data.audio_url", "result.audio_url", "response.audio_url"]);
  return /^https:\/\//i.test(String(url || "")) ? { url: String(url), contentType: "", fileName: "" } : null;
}
function normalizeStatus(value, url) {
  if (url) return "COMPLETED";
  const status = clean(value, 80).toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(status)) return "COMPLETED";
  if (["RUNNING", "IN_PROGRESS", "PROCESSING", "STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}
function errorMessage(data, status) {
  const detail = pick(data, ["detail.0.msg", "detail", "message", "error", "data.detail", "data.message", "logs.0.message"]);
  if (typeof detail === "string" && detail.trim()) return clean(detail, 900);
  if (detail && typeof detail === "object") return clean(JSON.stringify(detail), 900);
  return `Fal HTTP ${status}`;
}
async function falGet(url, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Key ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    let text = "";
    let data = {};
    try { text = await response.text(); data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }
    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const projectId = clean(req.query?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    if (project.music?.mode === "off") return sendJson(res, 200, { ok: true, status: "DISABLED", project });
    if (project.music?.mode === "upload" && project.music?.upload?.url) {
      return sendJson(res, 200, { ok: true, status: "COMPLETED", audio: project.music.upload, project });
    }
    if (project.music?.audio?.url && project.music?.audio?.pipelineVersion === PIPELINE_VERSION) {
      return sendJson(res, 200, { ok: true, status: "COMPLETED", audio: project.music.audio, project });
    }

    const generation = project.musicGeneration || {};
    if (generation.status === "failed") {
      return sendJson(res, 200, { ok: true, status: "FAILED", error: generation.error || "music_generation_failed", project });
    }
    if (!generation.requestId) return sendJson(res, 200, { ok: true, status: "IDLE", project });
    if (generation.pipelineVersion !== PIPELINE_VERSION) {
      return sendJson(res, 409, { ok: false, error: "stale_music_generation", project });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });
    const statusUrl = clean(generation.statusUrl) || `https://queue.fal.run/${generation.model}/requests/${encodeURIComponent(generation.requestId)}/status`;
    const first = await falGet(statusUrl, key);
    if (!first.response.ok) {
      const message = errorMessage(first.data, first.response.status);
      const now = new Date().toISOString();
      const saved = await saveRadioProject(user, {
        ...project,
        status: "draft",
        musicGeneration: {
          ...generation,
          status: "failed",
          updatedAt: now,
          completedAt: now,
          error: message,
          falStatus: first.response.status,
          falResponse: first.data,
        },
      });
      return sendJson(res, 200, { ok: true, status: "FAILED", error: message, project: saved });
    }

    let file = audioFile(first.data);
    let status = normalizeStatus(pick(first.data, ["status", "state", "data.status", "result.status"]), file?.url);
    if (!file && status === "COMPLETED") {
      const resultUrl = clean(generation.responseUrl) || statusUrl.replace(/\/status\/?(?:\?.*)?$/i, "");
      const second = await falGet(resultUrl, key);
      if (!second.response.ok && second.response.status !== 202) {
        const message = errorMessage(second.data, second.response.status);
        const now = new Date().toISOString();
        const saved = await saveRadioProject(user, {
          ...project,
          status: "draft",
          musicGeneration: { ...generation, status: "failed", updatedAt: now, completedAt: now, error: message },
        });
        return sendJson(res, 200, { ok: true, status: "FAILED", error: message, project: saved });
      }
      if (second.response.ok) file = audioFile(second.data);
      status = normalizeStatus("COMPLETED", file?.url);
    }

    if (status === "FAILED") {
      const message = errorMessage(first.data, 200) || "music_generation_failed";
      const now = new Date().toISOString();
      const saved = await saveRadioProject(user, {
        ...project,
        status: "draft",
        musicGeneration: { ...generation, status: "failed", updatedAt: now, completedAt: now, error: message },
      });
      return sendJson(res, 200, { ok: true, status: "FAILED", error: message, project: saved });
    }

    if (!file?.url) {
      const nextStatus = status === "IN_QUEUE" ? "queued" : "processing";
      let saved = project;
      if (generation.status !== nextStatus) {
        saved = await saveRadioProject(user, {
          ...project,
          status: "processing",
          musicGeneration: { ...generation, status: nextStatus, updatedAt: new Date().toISOString(), error: null },
        });
      }
      return sendJson(res, 200, { ok: true, status: status === "IN_QUEUE" ? "IN_QUEUE" : "RUNNING", project: saved });
    }

    const remote = await fetch(file.url, { cache: "no-store", redirect: "follow" });
    if (!remote.ok) return sendJson(res, 502, { ok: false, error: "music_download_failed" });
    const body = Buffer.from(await remote.arrayBuffer());
    if (!body.length || body.length > MAX_BYTES) return sendJson(res, 413, { ok: false, error: "invalid_music_size" });

    const now = new Date().toISOString();
    const objectKey = `${mediaPrefix(user, projectId)}music/generated-v2-${Date.now()}.mp3`;
    const storedUrl = await putObject({
      key: objectKey,
      body,
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });
    const duration = Number(generation.meta?.duration || project.output?.duration || 10);
    const audio = {
      url: storedUrl,
      contentType: "audio/mpeg",
      generated: true,
      createdAt: now,
      engine: generation.model,
      pipelineVersion: PIPELINE_VERSION,
      signature: generation.signature,
      seed: generation.seed || null,
      duration,
      outputFormat: OUTPUT_FORMAT,
      bitrate: generation.bitrate || OUTPUT_BITRATE,
      style: generation.meta?.resolvedStyle || project.music?.style || "auto",
      energy: generation.meta?.resolvedEnergy || project.music?.energy || "balanced",
    };
    const saved = await saveRadioProject(user, {
      ...project,
      status: "draft",
      music: { ...(project.music || {}), audio },
      musicGeneration: { ...generation, status: "completed", updatedAt: now, completedAt: now, error: null },
      final: null,
      finalGeneration: null,
    });
    return sendJson(res, 200, { ok: true, status: "COMPLETED", audio, project: saved });
  } catch (error) {
    console.error("[radio-ad/music/status]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: clean(error?.message || error, 900) });
  }
}
