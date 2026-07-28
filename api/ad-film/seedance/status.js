// api/ad-film/seedance/status.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 1600) {
  return String(value ?? "").trim().slice(0, max);
}

function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return { raw: text || "" };
  }
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

function normalizeStatus(value, videoUrl) {
  if (videoUrl) return "COMPLETED";
  const status = clean(value, 80).toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(status)) return "COMPLETED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}

function videoUrlFrom(payload) {
  const value = pick(payload, [
    "video.url",
    "data.video.url",
    "result.video.url",
    "output.video.url",
    "response.video.url",
    "video_url",
  ]);
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : null;
}

function seedFrom(payload) {
  const value = pick(payload, ["seed", "data.seed", "result.seed", "output.seed"]);
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function falFetch(url, key) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Key ${key}`, Accept: "application/json" },
  });
  const text = await response.text().catch(() => "");
  return { response, data: parseJson(text) };
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

    const generation = project.generation || {};
    if (!generation.requestId) {
      return sendJson(res, 400, { ok: false, error: "missing_generation_request" });
    }

    if (["completed", "failed"].includes(String(generation.status))) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        status: String(generation.status).toUpperCase(),
        video_url: generation.videoUrl || null,
        seed: generation.seed ?? null,
        generation,
      });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    let statusUrl = clean(generation.statusUrl, 1600);
    let responseUrl = clean(generation.responseUrl, 1600);
    if (!statusUrl) {
      statusUrl = `https://queue.fal.run/bytedance/seedance-2.0/requests/${encodeURIComponent(generation.requestId)}/status`;
    }
    if (!responseUrl) {
      responseUrl = statusUrl.replace(/\/status\/?$/i, "");
    }

    const statusResult = await falFetch(statusUrl, key);
    if (statusResult.response.status === 404) {
      const failed = await saveProject(user, {
        ...project,
        status: "failed",
        generation: {
          ...generation,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: "fal_status_not_found",
        },
      });
      return sendJson(res, 200, { ok: true, projectId, status: "FAILED", video_url: null, generation: failed.generation });
    }
    if (!statusResult.response.ok) {
      return sendJson(res, 502, {
        ok: false,
        error: "fal_status_error",
        fal_status: statusResult.response.status,
        fal_response: statusResult.data,
      });
    }

    const rawStatus = pick(statusResult.data, ["status", "state", "data.status", "result.status"]);
    let videoUrl = videoUrlFrom(statusResult.data);
    let seed = seedFrom(statusResult.data);
    const preliminary = normalizeStatus(rawStatus, videoUrl);

    if (!videoUrl && preliminary === "COMPLETED") {
      const result = await falFetch(responseUrl, key);
      if (result.response.ok) {
        videoUrl = videoUrlFrom(result.data);
        seed = seedFrom(result.data) ?? seed;
      } else if (result.response.status !== 202) {
        return sendJson(res, 502, {
          ok: false,
          error: "fal_result_error",
          fal_status: result.response.status,
          fal_response: result.data,
        });
      }
    }

    const normalized = normalizeStatus(rawStatus, videoUrl);
    const now = new Date().toISOString();
    const nextStatus = normalized === "COMPLETED" ? "completed" : normalized === "FAILED" ? "failed" : "processing";
    const nextProject = await saveProject(user, {
      ...project,
      status: nextStatus,
      generation: {
        ...generation,
        status: nextStatus,
        statusUrl,
        responseUrl,
        updatedAt: now,
        ...(videoUrl ? { videoUrl, seed, completedAt: now, error: null } : {}),
        ...(normalized === "FAILED" ? { error: clean(pick(statusResult.data, ["error", "message", "detail"]), 1200) || "fal_generation_failed" } : {}),
      },
    });

    return sendJson(res, 200, {
      ok: true,
      provider: "fal",
      projectId,
      status: normalized,
      video_url: videoUrl || null,
      seed,
      generation: nextProject.generation,
    });
  } catch (error) {
    console.error("[ad-film/seedance/status]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
