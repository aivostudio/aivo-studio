// api/radio-ad/music/create.js
export const config = { runtime: "nodejs" };

import crypto from "crypto";
import { buildRadioAdMusicPrompt } from "../../_lib/radio-ad-music-prompt.js";
import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

const PRIMARY_MODEL = "fal-ai/stable-audio-3/small/music/text-to-audio";
const FALLBACK_MODEL = "fal-ai/stable-audio-3/medium/text-to-audio";
const PIPELINE_VERSION = "radio-music-v1";
const OUTPUT_FORMAT = "mp3";
const OUTPUT_BITRATE = "320k";
const NUM_INFERENCE_STEPS = 8;
const GUIDANCE_SCALE = 1;

function clean(value, max = 1800) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function parse(text) { try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text || "" }; } }
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
function errorMessage(data, status) {
  const detail = pick(data, ["detail.0.msg", "detail", "message", "error", "data.detail", "data.message"]);
  if (typeof detail === "string" && detail.trim()) return clean(detail, 900);
  if (detail && typeof detail === "object") return clean(JSON.stringify(detail), 900);
  return `Fal HTTP ${status}`;
}
async function submit(key, model, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { response, data: parse(await response.text().catch(() => "")), model };
  } finally {
    clearTimeout(timer);
  }
}
function signature(prompt) {
  return crypto.createHash("sha256").update(JSON.stringify({
    pipeline: PIPELINE_VERSION,
    primary: PRIMARY_MODEL,
    fallback: FALLBACK_MODEL,
    output: OUTPUT_FORMAT,
    bitrate: OUTPUT_BITRATE,
    steps: NUM_INFERENCE_STEPS,
    guidance: GUIDANCE_SCALE,
    duration: prompt.duration,
    requestedStyle: prompt.requestedStyle,
    requestedEnergy: prompt.requestedEnergy,
    resolvedStyle: prompt.resolvedStyle,
    resolvedEnergy: prompt.resolvedEnergy,
    prompt: prompt.prompt,
    negativePrompt: prompt.negativePrompt,
  })).digest("hex").slice(0, 32);
}
function reusable(audio, expected, duration) {
  const url = clean(audio?.url, 1800).toLowerCase().split("?")[0];
  return !!(
    audio?.url &&
    audio.pipelineVersion === PIPELINE_VERSION &&
    clean(audio.signature, 80) === expected &&
    Number(audio.duration) === Number(duration) &&
    (audio.contentType === "audio/mpeg" || url.endsWith(".mp3"))
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }
    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const music = project.music || {};
    if (music.mode === "off") return sendJson(res, 200, { ok: true, status: "DISABLED", project });
    if (music.mode === "upload") {
      if (!music.upload?.url) return sendJson(res, 409, { ok: false, error: "uploaded_music_missing" });
      return sendJson(res, 200, { ok: true, status: "COMPLETED", audio: music.upload, project });
    }

    const duration = Number(project.output?.duration);
    const prompt = buildRadioAdMusicPrompt({
      title: project.title,
      text: project.narration?.text,
      voiceStyle: project.narration?.voiceStyle,
      style: music.style,
      energy: music.energy,
      duration,
    });
    const expectedSignature = signature(prompt);

    if (reusable(music.audio, expectedSignature, duration)) {
      return sendJson(res, 200, {
        ok: true,
        status: "COMPLETED",
        reused: true,
        audio: music.audio,
        project,
      });
    }

    const active = project.musicGeneration;
    if (
      active &&
      ["queued", "processing"].includes(String(active.status)) &&
      active.pipelineVersion === PIPELINE_VERSION &&
      clean(active.signature, 80) === expectedSignature
    ) {
      return sendJson(res, 200, {
        ok: true,
        status: active.status === "queued" ? "IN_QUEUE" : "RUNNING",
        generation: active,
        project,
      });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const payload = {
      prompt: prompt.prompt,
      negative_prompt: prompt.negativePrompt,
      duration: prompt.duration,
      num_inference_steps: NUM_INFERENCE_STEPS,
      guidance_scale: GUIDANCE_SCALE,
      enable_prompt_expansion: false,
      enable_safety_checker: true,
      sync_mode: false,
      output_format: OUTPUT_FORMAT,
      bitrate: OUTPUT_BITRATE,
    };

    let attempt = await submit(key, PRIMARY_MODEL, payload);
    let fallbackUsed = false;
    if (!attempt.response.ok) {
      fallbackUsed = true;
      attempt = await submit(key, FALLBACK_MODEL, payload);
    }
    if (!attempt.response.ok) {
      const message = errorMessage(attempt.data, attempt.response.status);
      const now = new Date().toISOString();
      const failed = await saveRadioProject(user, {
        ...project,
        music: { ...music, audio: null },
        musicGeneration: {
          provider: "fal",
          model: attempt.model,
          status: "failed",
          startedAt: now,
          updatedAt: now,
          completedAt: now,
          error: message,
          falStatus: attempt.response.status,
          falResponse: attempt.data,
          fallbackUsed,
          pipelineVersion: PIPELINE_VERSION,
          signature: expectedSignature,
          meta: prompt,
        },
        final: null,
        finalGeneration: null,
      });
      return sendJson(res, attempt.response.status, {
        ok: false,
        error: "fal_error",
        message,
        project: failed,
      });
    }

    const requestId = clean(pick(attempt.data, ["request_id", "requestId", "id"]), 240);
    const statusUrl = clean(pick(attempt.data, ["status_url", "statusUrl", "urls.status"]), 1800);
    const responseUrl = clean(pick(attempt.data, ["response_url", "responseUrl", "urls.response"]), 1800);
    if (!requestId) return sendJson(res, 502, { ok: false, error: "fal_missing_request_id" });

    const now = new Date().toISOString();
    const saved = await saveRadioProject(user, {
      ...project,
      status: "processing",
      music: { ...music, audio: null },
      musicGeneration: {
        provider: "fal",
        model: attempt.model,
        requestId,
        statusUrl: statusUrl || null,
        responseUrl: responseUrl || null,
        status: "queued",
        startedAt: now,
        updatedAt: now,
        error: null,
        fallbackUsed,
        pipelineVersion: PIPELINE_VERSION,
        signature: expectedSignature,
        outputFormat: OUTPUT_FORMAT,
        bitrate: OUTPUT_BITRATE,
        meta: prompt,
      },
      final: null,
      finalGeneration: null,
    });

    return sendJson(res, 200, {
      ok: true,
      status: "IN_QUEUE",
      generation: saved.musicGeneration,
      project: saved,
      fallback_used: fallbackUsed,
    });
  } catch (error) {
    console.error("[radio-ad/music/create]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: clean(error?.message || error, 900),
    });
  }
}
