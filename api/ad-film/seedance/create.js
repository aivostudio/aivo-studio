// api/ad-film/seedance/create.js
export const config = { runtime: "nodejs" };

import {
  buildPublicUrl,
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "bytedance/seedance-2.0/reference-to-video";
const QUEUE_URL = `https://queue.fal.run/${MODEL}`;
const RESOLUTIONS = new Set(["480p", "720p", "1080p", "4k"]);
const ASPECT_RATIOS = new Set(["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
const BITRATES = new Set(["standard", "high"]);

function clean(value, max = 12000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
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

function ownedUrlPrefix(user, projectId) {
  return buildPublicUrl(mediaPrefix(user, projectId));
}

function validateOwnedUrls(values, prefix, max) {
  if (!Array.isArray(values)) return [];
  const next = [];
  for (const value of values) {
    const url = clean(value, 1200);
    if (!url || !url.startsWith(prefix)) throw new Error("unowned_media_url");
    if (!/^https:\/\//i.test(url)) throw new Error("invalid_media_url");
    if (!next.includes(url)) next.push(url);
    if (next.length >= max) break;
  }
  return next;
}

function normalizeDuration(value) {
  const duration = Number.parseInt(value, 10);
  if (!Number.isFinite(duration) || duration < 4 || duration > 15) return null;
  return String(duration);
}

function activeGeneration(project) {
  const generation = project?.generation;
  if (!generation || !["queued", "processing"].includes(String(generation.status))) return false;
  const startedAt = Date.parse(generation.startedAt || "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < 30 * 60 * 1000;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
    if (activeGeneration(project)) {
      return sendJson(res, 409, {
        ok: false,
        error: "generation_in_progress",
        generation: project.generation,
      });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const prompt = clean(req.body?.prompt);
    if (prompt.length < 20) return sendJson(res, 400, { ok: false, error: "missing_prompt" });

    const prefix = ownedUrlPrefix(user, projectId);
    let imageUrls;
    let audioUrls;
    let logoUrl = "";
    try {
      imageUrls = validateOwnedUrls(req.body?.image_urls, prefix, 9);
      audioUrls = validateOwnedUrls(req.body?.audio_urls, prefix, 3);
      logoUrl = clean(req.body?.logo_url, 1200);
      if (logoUrl && !logoUrl.startsWith(prefix)) throw new Error("unowned_media_url");
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: String(error?.message || error) });
    }

    if (!imageUrls.length) {
      return sendJson(res, 400, { ok: false, error: "missing_reference_image" });
    }

    const duration = normalizeDuration(req.body?.duration);
    const resolution = clean(req.body?.resolution, 20).toLowerCase();
    const aspectRatio = clean(req.body?.aspect_ratio, 20).toLowerCase();
    const bitrateMode = clean(req.body?.bitrate_mode, 20).toLowerCase();
    if (!duration) return sendJson(res, 400, { ok: false, error: "invalid_duration" });
    if (!RESOLUTIONS.has(resolution)) return sendJson(res, 400, { ok: false, error: "invalid_resolution" });
    if (!ASPECT_RATIOS.has(aspectRatio)) return sendJson(res, 400, { ok: false, error: "invalid_aspect_ratio" });
    if (!BITRATES.has(bitrateMode)) return sendJson(res, 400, { ok: false, error: "invalid_bitrate_mode" });

    const input = {
      prompt,
      image_urls: imageUrls,
      ...(audioUrls.length ? { audio_urls: audioUrls } : {}),
      resolution,
      duration,
      aspect_ratio: aspectRatio,
      generate_audio: req.body?.generate_audio !== false,
      bitrate_mode: bitrateMode,
      end_user_id: user.ownerHash,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;
    try {
      response = await fetch(QUEUE_URL, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch (error) {
      return sendJson(res, 504, {
        ok: false,
        error: "fal_timeout_or_network_error",
        message: String(error?.message || error),
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text().catch(() => "");
    const fal = parseJson(text);
    if (!response.ok) {
      return sendJson(res, response.status, {
        ok: false,
        error: "fal_error",
        fal_status: response.status,
        fal_response: fal,
      });
    }

    const requestId = clean(fal?.request_id || fal?.requestId || fal?.id, 240);
    const statusUrl = clean(fal?.status_url || fal?.statusUrl || fal?.urls?.status, 1200);
    const responseUrl = clean(fal?.response_url || fal?.responseUrl || fal?.urls?.response, 1200);
    if (!requestId) {
      return sendJson(res, 502, { ok: false, error: "fal_missing_request_id", fal_response: fal });
    }

    const now = new Date().toISOString();
    const nextProject = await saveProject(user, {
      ...project,
      status: "processing",
      generation: {
        provider: "fal",
        model: MODEL,
        requestId,
        statusUrl: statusUrl || null,
        responseUrl: responseUrl || null,
        status: "queued",
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        videoUrl: null,
        seed: null,
        logoUrl: logoUrl || null,
        input: {
          duration,
          resolution,
          aspectRatio,
          bitrateMode,
          generateAudio: input.generate_audio,
          imageCount: imageUrls.length,
          audioCount: audioUrls.length,
        },
        referenceMap: req.body?.reference_map && typeof req.body.reference_map === "object"
          ? req.body.reference_map
          : null,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      provider: "fal",
      model: MODEL,
      projectId,
      request_id: requestId,
      status_url: statusUrl || null,
      response_url: responseUrl || null,
      status: "IN_QUEUE",
      generation: nextProject.generation,
    });
  } catch (error) {
    console.error("[ad-film/seedance/create]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
