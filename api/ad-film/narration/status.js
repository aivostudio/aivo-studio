// api/ad-film/narration/status.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";
import { copyUrlToR2 } from "../../_lib/copy-to-r2.js";

const FALLBACK_MODEL = "fal-ai/gemini-3.1-flash-tts";
const GEMINI_LANGUAGES = new Map([
  ["tr", "Turkish (Turkey)"], ["en", "English (US)"], ["de", "German (Germany)"],
  ["fr", "French (France)"], ["es", "Spanish (Spain)"], ["it", "Italian (Italy)"],
  ["pt", "Portuguese (Brazil)"], ["ar", "Arabic (World)"], ["ru", "Russian (Russia)"],
  ["nl", "Dutch (Netherlands)"], ["pl", "Polish (Poland)"], ["uk", "Ukrainian (Ukraine)"],
  ["hi", "Hindi (India)"], ["id", "Indonesian (Indonesia)"], ["ms", "Malay (Malaysia)"],
  ["ja", "Japanese (Japan)"], ["ko", "Korean (South Korea)"], ["zh", "Chinese Mandarin (China)"],
  ["vi", "Vietnamese (Vietnam)"], ["th", "Thai (Thailand)"],
]);
const FALLBACK_VOICES = {
  warm_female: "Aoede",
  professional_male: "Charon",
  energetic_male: "Puck",
  clear_female: "Zephyr",
};

function clean(value, max = 1600) {
  return String(value ?? "").trim().slice(0, max);
}
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function parseJson(text) { try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text || "" }; } }
function pick(object, paths) {
  for (const path of paths) {
    let current = object;
    let valid = true;
    for (const key of path.split(".")) {
      if (!current || typeof current !== "object" || !(key in current)) { valid = false; break; }
      current = current[key];
    }
    if (valid && current != null) return current;
  }
  return null;
}
function normalizeStatus(value, audioUrl) {
  if (audioUrl) return "COMPLETED";
  const status = clean(value, 80).toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(status)) return "COMPLETED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}
function audioFrom(payload) {
  const object = pick(payload, ["audio", "data.audio", "result.audio", "output.audio", "response.audio"]);
  if (object && typeof object === "object" && /^https:\/\//i.test(String(object.url || ""))) {
    return {
      url: String(object.url),
      contentType: clean(object.content_type || object.contentType, 100) || null,
      fileName: clean(object.file_name || object.fileName, 180) || null,
      fileSize: Number(object.file_size || object.fileSize) || null,
      duration: Number(object.duration || object.duration_seconds) || null,
    };
  }
  const url = pick(payload, ["audio_url", "data.audio_url", "result.audio_url", "output.audio_url", "response.audio_url"]);
  return typeof url === "string" && /^https:\/\//i.test(url) ? { url, contentType: null, fileName: null, fileSize: null, duration: null } : null;
}
async function falFetch(url, key) {
  const response = await fetch(url, { headers: { Authorization: `Key ${key}`, Accept: "application/json" } });
  return { response, data: parseJson(await response.text().catch(() => "")) };
}
function fallbackInstructions(input) {
  const style = {
    warm: "Warm, reassuring and trustworthy commercial delivery.",
    energetic: "Energetic, confident and lively advertising delivery.",
    premium: "Premium, calm, polished and cinematic commercial delivery.",
    natural: "Natural, conversational and human delivery.",
  }[input.voiceStyle] || "Natural, polished commercial delivery.";
  const pace = input.speed === "slow" ? "Use a measured pace." : input.speed === "fast" ? "Use a brisk but clearly intelligible pace." : "Use a balanced pace.";
  const flow = input.flow === "emphatic" ? "Emphasize key product and brand words." : input.flow === "balanced" ? "Keep emphasis controlled and balanced." : "Use smooth phrasing and natural pauses.";
  return `${style} ${pace} ${flow} Speak only the supplied text. Do not add, remove or translate any words.`;
}
async function queueFallback(generation, key) {
  const input = generation?.input || {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`https://queue.fal.run/${FALLBACK_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        prompt: clean(input.text, 650),
        style_instructions: fallbackInstructions(input),
        voice: FALLBACK_VOICES[input.voice] || FALLBACK_VOICES.warm_female,
        language_code: GEMINI_LANGUAGES.get(input.language) || "English (US)",
        output_format: "mp3",
      }),
      signal: controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    return {
      ok: response.ok && !!requestId,
      status: response.status,
      data,
      requestId,
      statusUrl: clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1600),
      responseUrl: clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1600),
    };
  } catch (error) {
    return { ok: false, status: 504, data: { message: String(error?.message || error) } };
  } finally {
    clearTimeout(timeout);
  }
}
async function activateFallback(user, project, reason, key) {
  const generation = project.narrationGeneration || {};
  if (generation.provider === "fallback" || generation.fallbackUsed) return null;
  const queued = await queueFallback(generation, key);
  if (!queued.ok) return { failed: queued };
  const now = new Date().toISOString();
  const saved = await saveProject(user, {
    ...project,
    narrationGeneration: {
      ...generation,
      provider: "fallback",
      model: FALLBACK_MODEL,
      previousRequestId: generation.requestId || null,
      requestId: queued.requestId,
      statusUrl: queued.statusUrl || null,
      responseUrl: queued.responseUrl || null,
      status: "queued",
      fallbackUsed: true,
      fallbackReason: clean(reason, 400),
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      error: null,
    },
  });
  return { saved };
}
function resultUrl(generation) {
  if (generation.responseUrl) return generation.responseUrl;
  return clean(generation.statusUrl).replace(/\/status\/?(?:\?.*)?$/i, "");
}
function extension(contentType, fileName) {
  if (/ogg/i.test(contentType || fileName || "")) return "ogg";
  if (/wav/i.test(contentType || fileName || "")) return "wav";
  return "mp3";
}

export default async function handler(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) {
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

    if (req.method === "POST" && clean(source.action, 30) === "approve") {
      if (!project.narration?.audio?.url) return sendJson(res, 409, { ok: false, error: "narration_audio_missing" });
      const saved = await saveProject(user, {
        ...project,
        narration: {
          ...(project.narration || {}),
          audio: { ...(project.narration.audio || {}), approved: true, approvedAt: new Date().toISOString() },
        },
      });
      return sendJson(res, 200, { ok: true, status: "COMPLETED", audio: saved.narration.audio });
    }

    const existingAudio = project.narration?.audio;
    const generation = project.narrationGeneration || {};
    if (!generation.requestId) {
      return sendJson(res, 200, { ok: true, status: existingAudio?.url ? "COMPLETED" : "IDLE", audio: existingAudio || null });
    }
    if (generation.status === "completed" && existingAudio?.url) {
      return sendJson(res, 200, { ok: true, status: "COMPLETED", audio: existingAudio, timing: generation.timing || null });
    }
    if (generation.status === "failed") {
      return sendJson(res, 200, { ok: true, status: "FAILED", error: generation.error || "narration_generation_failed" });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });
    const statusUrl = clean(generation.statusUrl, 1600) || `https://queue.fal.run/${generation.model}/requests/${encodeURIComponent(generation.requestId)}/status`;
    const statusResult = await falFetch(statusUrl, key);

    if (!statusResult.response.ok) {
      const fallback = await activateFallback(user, project, `status_http_${statusResult.response.status}`, key);
      if (fallback?.saved) return sendJson(res, 200, { ok: true, status: "IN_QUEUE", fallback_used: true });
      return sendJson(res, 502, { ok: false, error: "fal_status_error", fal_status: statusResult.response.status, fal_response: statusResult.data });
    }

    const rawStatus = pick(statusResult.data, ["status", "state", "data.status", "result.status"]);
    let audio = audioFrom(statusResult.data);
    let normalized = normalizeStatus(rawStatus, audio?.url);

    if (!audio && normalized === "COMPLETED") {
      const responseUrl = resultUrl(generation);
      const result = responseUrl ? await falFetch(responseUrl, key) : null;
      if (result?.response?.ok) audio = audioFrom(result.data);
      else if (result && result.response.status !== 202) {
        const fallback = await activateFallback(user, project, `result_http_${result.response.status}`, key);
        if (fallback?.saved) return sendJson(res, 200, { ok: true, status: "IN_QUEUE", fallback_used: true });
        return sendJson(res, 502, { ok: false, error: "fal_result_error", fal_status: result.response.status, fal_response: result.data });
      }
      normalized = normalizeStatus(rawStatus, audio?.url);
    }

    if (normalized === "FAILED") {
      const fallback = await activateFallback(user, project, "provider_failed", key);
      if (fallback?.saved) return sendJson(res, 200, { ok: true, status: "IN_QUEUE", fallback_used: true });
      const failed = await saveProject(user, {
        ...project,
        narrationGeneration: { ...generation, status: "failed", updatedAt: new Date().toISOString(), error: "narration_generation_failed" },
      });
      return sendJson(res, 200, { ok: true, status: "FAILED", error: failed.narrationGeneration.error });
    }

    if (audio?.url) {
      const ext = extension(audio.contentType, audio.fileName);
      const keyPath = `${mediaPrefix(user, projectId)}narration/${Date.now()}-${generation.requestId}.${ext}`;
      let publicUrl;
      try {
        publicUrl = await copyUrlToR2({ url: audio.url, key: keyPath, contentType: audio.contentType || (ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : "audio/mpeg") });
      } catch (error) {
        console.error("[ad-film/narration/status] copy to R2", error);
        return sendJson(res, 502, { ok: false, error: "narration_r2_copy_failed", message: String(error?.message || error) });
      }
      const now = new Date().toISOString();
      const savedAudio = {
        url: publicUrl,
        contentType: audio.contentType || (ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : "audio/mpeg"),
        duration: audio.duration || generation.timing?.estimatedSeconds || null,
        createdAt: now,
        approved: false,
        approvedAt: null,
      };
      const saved = await saveProject(user, {
        ...project,
        narration: { ...(project.narration || {}), audio: savedAudio },
        narrationGeneration: { ...generation, status: "completed", updatedAt: now, completedAt: now, error: null },
      });
      return sendJson(res, 200, { ok: true, status: "COMPLETED", audio: saved.narration.audio, timing: saved.narrationGeneration.timing || null });
    }

    const nextStatus = normalized === "IN_QUEUE" ? "queued" : "processing";
    let nextGeneration = generation;
    if (generation.status !== nextStatus) {
      const updated = await saveProject(user, {
        ...project,
        narrationGeneration: { ...generation, status: nextStatus, updatedAt: new Date().toISOString() },
      });
      nextGeneration = updated.narrationGeneration;
    }
    return sendJson(res, 200, { ok: true, status: normalized, audio: null, timing: nextGeneration.timing || null });
  } catch (error) {
    console.error("[ad-film/narration/status]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
