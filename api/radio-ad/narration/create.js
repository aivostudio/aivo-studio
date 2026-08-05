// api/radio-ad/narration/create.js
export const config = { runtime: "nodejs" };

import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";
import {
  GENERATION_TTL_MS,
  FALLBACK_MODEL,
  PRIMARY_MODEL,
  falKey,
  narrationFingerprint,
  normalizeNarrationInput,
  submitNarration,
  validateNarrationInput,
} from "../../_lib/radio-ad-narration.js";

function generationIsActive(generation) {
  if (!generation || !["queued", "processing"].includes(String(generation.status))) return false;
  const startedAt = Date.parse(generation.startedAt || "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < GENERATION_TTL_MS;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = String(req.body?.projectId || "").trim();
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
    if (generationIsActive(project.narrationGeneration)) {
      return sendJson(res, 409, {
        ok: false,
        error: "narration_generation_in_progress",
        generation: project.narrationGeneration,
      });
    }

    const settings = normalizeNarrationInput(req.body || {}, project);
    const validation = validateNarrationInput(settings);
    if (validation.error) return sendJson(res, 400, { ok: false, ...validation });

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    let queued = await submitNarration("primary", settings, key);
    let provider = "primary";
    let fallbackUsed = false;
    let fallbackReason = null;

    if (!queued.ok) {
      fallbackReason = `primary_submit_http_${queued.status || 0}`;
      queued = await submitNarration("fallback", settings, key);
      provider = "fallback";
      fallbackUsed = true;
    }

    if (!queued.ok) {
      return sendJson(res, 502, {
        ok: false,
        error: "narration_queue_failed",
        fal_status: queued.status,
        fal_response: queued.data,
      });
    }

    const now = new Date().toISOString();
    const fingerprint = narrationFingerprint(settings);
    const saved = await saveRadioProject(user, {
      ...project,
      status: "processing",
      narration: {
        ...(project.narration || {}),
        text: settings.text,
        language: settings.language,
        voice: settings.voice,
        voiceStyle: settings.voiceStyle,
        speed: settings.speed,
        flow: settings.flow,
        audio: null,
      },
      narrationGeneration: {
        provider,
        model: queued.model || (provider === "primary" ? PRIMARY_MODEL : FALLBACK_MODEL),
        requestId: queued.requestId,
        statusUrl: queued.statusUrl || null,
        responseUrl: queued.responseUrl || null,
        status: "queued",
        fallbackUsed,
        fallbackReason,
        fingerprint,
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        error: null,
        input: {
          text: settings.text,
          language: settings.language,
          voice: settings.voice,
          voiceStyle: settings.voiceStyle,
          speed: settings.speed,
          flow: settings.flow,
          duration: settings.duration,
        },
        timing: validation.timing,
      },
      final: null,
      finalGeneration: null,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      status: "IN_QUEUE",
      provider,
      fallback_used: fallbackUsed,
      timing: validation.timing,
      generation: saved.narrationGeneration,
    });
  } catch (error) {
    console.error("[radio-ad/narration/create]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
