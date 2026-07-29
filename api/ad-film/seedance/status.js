// api/ad-film/seedance/status.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "bytedance/seedance-2.0/reference-to-video";
const QUEUE_URL = `https://queue.fal.run/${MODEL}`;

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

function normalizeOutputs(project) {
  const list = Array.isArray(project?.outputs) ? project.outputs.filter(Boolean) : [];
  if (!list.length && project?.generation?.videoUrl) {
    const generation = project.generation;
    list.push({
      id: generation.outputId || generation.requestId || `legacy-${Date.now()}`,
      requestId: generation.requestId || null,
      version: generation.version || 1,
      videoUrl: generation.videoUrl,
      logoUrl: generation.logoUrl || project?.media?.logo?.url || null,
      createdAt: generation.completedAt || generation.startedAt || project.updatedAt,
      completedAt: generation.completedAt || project.updatedAt,
      seed: generation.seed ?? null,
      duration: generation.input?.duration || project?.output?.duration || "15",
      aspectRatio: generation.input?.aspectRatio || project?.output?.aspectRatio || "9:16",
      resolution: generation.input?.resolution || project?.output?.quality || "1080p",
      generateAudio: generation.input?.generateAudio !== false,
    });
  }
  return list.slice(0, 30);
}

function outputFromGeneration(project, generation, videoUrl, seed, completedAt) {
  return {
    id: generation.outputId || generation.requestId,
    requestId: generation.requestId || null,
    version: Number.parseInt(generation.version, 10) || normalizeOutputs(project).length + 1,
    videoUrl,
    logoUrl: generation.logoUrl || project?.media?.logo?.url || null,
    createdAt: generation.startedAt || completedAt,
    completedAt,
    seed: seed ?? null,
    duration: generation.input?.duration || project?.output?.duration || "15",
    aspectRatio: generation.input?.aspectRatio || project?.output?.aspectRatio || "9:16",
    resolution: generation.input?.resolution || project?.output?.quality || "1080p",
    generateAudio: generation.input?.generateAudio !== false,
  };
}

async function falFetch(url, key) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Key ${key}`, Accept: "application/json" },
  });
  const text = await response.text().catch(() => "");
  return { response, data: parseJson(text) };
}

function isSensitiveAudioFailure(payload, status) {
  if (Number(status) !== 422) return false;
  let text = "";
  try {
    text = JSON.stringify(payload || {}).toLowerCase();
  } catch (_) {
    text = String(payload || "").toLowerCase();
  }
  return (
    text.includes("output audio has sensitive content") ||
    (text.includes("content_policy_violation") && text.includes("audio")) ||
    (text.includes("partner_validation_failed") && text.includes("audio"))
  );
}

function visualOnlyPrompt(prompt) {
  const source = clean(prompt, 12000)
    .replace(/Generate synchronized native audio\.[\s\S]*?seconds\./gi, "")
    .replace(/Generate synchronized commercial ambience and sound effects, but no spoken dialogue\./gi, "")
    .replace(/Generate synchronized ambience and sound effects without speech\./gi, "")
    .trim();
  return `${source} Create the visual video only. Do not generate audio, music, speech, dialogue or sound effects. AIVO will add the selected music, ambience and narration during final post-production.`;
}

async function queueAudioSafetyFallback(generation, key, ownerHash) {
  const retry = generation?.retryInput;
  if (!retry || !Array.isArray(retry.imageUrls) || !retry.imageUrls.length) return null;

  const input = {
    prompt: visualOnlyPrompt(retry.prompt),
    image_urls: retry.imageUrls,
    resolution: retry.resolution,
    duration: retry.duration,
    aspect_ratio: retry.aspectRatio,
    generate_audio: false,
    bitrate_mode: retry.bitrateMode || "standard",
    end_user_id: ownerHash,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(QUEUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    const data = parseJson(text);
    if (!response.ok) return { ok: false, status: response.status, data };

    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    const statusUrl = clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1200);
    const responseUrl = clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1200);
    if (!requestId) return { ok: false, status: 502, data };
    return { ok: true, requestId, statusUrl, responseUrl };
  } catch (error) {
    return { ok: false, status: 504, data: { message: String(error?.message || error) } };
  } finally {
    clearTimeout(timeout);
  }
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
    const savedOutputs = normalizeOutputs(project);
    if (!generation.requestId) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        status: savedOutputs.length ? "COMPLETED" : "IDLE",
        video_url: savedOutputs.find((item) => item.id === project.activeOutputId)?.videoUrl || savedOutputs[0]?.videoUrl || null,
        generation,
        outputs: savedOutputs,
        activeOutputId: project.activeOutputId || savedOutputs[0]?.id || null,
      });
    }

    if (["completed", "failed"].includes(String(generation.status))) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        status: String(generation.status).toUpperCase(),
        video_url: generation.videoUrl || null,
        seed: generation.seed ?? null,
        generation,
        outputs: savedOutputs,
        activeOutputId: project.activeOutputId || savedOutputs[0]?.id || null,
      });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    let statusUrl = clean(generation.statusUrl, 1600);
    let responseUrl = clean(generation.responseUrl, 1600);
    if (!statusUrl) {
      statusUrl = `https://queue.fal.run/bytedance/seedance-2.0/requests/${encodeURIComponent(generation.requestId)}/status`;
    }
    if (!responseUrl) responseUrl = statusUrl.replace(/\/status\/?$/i, "");

    const statusResult = await falFetch(statusUrl, key);
    if (statusResult.response.status === 404) {
      const failed = await saveProject(user, {
        ...project,
        status: "failed",
        outputs: savedOutputs,
        generation: {
          ...generation,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: "fal_status_not_found",
        },
      });
      return sendJson(res, 200, { ok: true, projectId, status: "FAILED", video_url: null, generation: failed.generation, outputs: failed.outputs || [], activeOutputId: failed.activeOutputId || null });
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
        if (isSensitiveAudioFailure(result.data, result.response.status) && Number(generation.audioSafetyRetry || 0) < 1) {
          const fallback = await queueAudioSafetyFallback(generation, key, user.ownerHash);
          if (fallback?.ok) {
            const now = new Date().toISOString();
            const retried = await saveProject(user, {
              ...project,
              status: "processing",
              outputs: savedOutputs,
              generation: {
                ...generation,
                previousRequestId: generation.requestId,
                requestId: fallback.requestId,
                outputId: fallback.requestId,
                statusUrl: fallback.statusUrl || null,
                responseUrl: fallback.responseUrl || null,
                status: "queued",
                startedAt: now,
                updatedAt: now,
                completedAt: null,
                videoUrl: null,
                seed: null,
                error: null,
                audioSafetyRetry: 1,
                audioFallback: true,
                input: {
                  ...(generation.input || {}),
                  generateAudio: false,
                  audioCount: 0,
                },
              },
            });
            return sendJson(res, 200, {
              ok: true,
              provider: "fal",
              projectId,
              status: "IN_QUEUE",
              video_url: null,
              audio_fallback: true,
              generation: retried.generation,
              outputs: retried.outputs || [],
              activeOutputId: retried.activeOutputId || null,
            });
          }
        }

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
    let outputs = savedOutputs;
    let activeOutputId = project.activeOutputId || savedOutputs[0]?.id || null;

    if (videoUrl && normalized === "COMPLETED") {
      const completedOutput = outputFromGeneration(project, generation, videoUrl, seed, now);
      outputs = [completedOutput, ...savedOutputs.filter((item) => item.id !== completedOutput.id && item.videoUrl !== completedOutput.videoUrl)].slice(0, 30);
      activeOutputId = completedOutput.id;
    }

    const nextProject = await saveProject(user, {
      ...project,
      status: nextStatus,
      outputs,
      activeOutputId,
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
      outputs: nextProject.outputs || [],
      activeOutputId: nextProject.activeOutputId || null,
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
