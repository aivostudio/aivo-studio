// api/radio-ad/narration/status.js
export const config = { runtime: "nodejs" };

import {
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";
import {
  FALLBACK_MODEL,
  audioExtension,
  audioFrom,
  clean,
  copyRemoteAudioToR2,
  falFetch,
  falKey,
  normalizeStatus,
  pick,
  resultUrl,
  submitNarration,
} from "../../_lib/radio-ad-narration.js";

async function activateFallback(user, project, reason, key) {
  const generation = project.narrationGeneration || {};
  if (generation.provider === "fallback" || generation.fallbackUsed) return null;
  const settings = {
    ...(generation.input || {}),
    providerText: generation.input?.text || "",
  };
  const queued = await submitNarration("fallback", settings, key);
  if (!queued.ok) return { failed: queued };
  const now = new Date().toISOString();
  const saved = await saveRadioProject(user, {
    ...project,
    status: "processing",
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

export default async function handler(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const projectId = clean(source.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const existingAudio = project.narration?.audio;
    const generation = project.narrationGeneration || {};
    if (!generation.requestId) {
      return sendJson(res, 200, {
        ok: true,
        status: existingAudio?.url ? "COMPLETED" : "IDLE",
        audio: existingAudio || null,
      });
    }
    if (generation.status === "completed" && existingAudio?.url) {
      return sendJson(res, 200, {
        ok: true,
        status: "COMPLETED",
        audio: existingAudio,
        timing: generation.timing || null,
      });
    }
    if (generation.status === "failed") {
      return sendJson(res, 200, {
        ok: true,
        status: "FAILED",
        error: generation.error || "narration_generation_failed",
      });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const statusUrl = clean(generation.statusUrl, 1800)
      || `https://queue.fal.run/${generation.model}/requests/${encodeURIComponent(generation.requestId)}/status`;
    const statusResult = await falFetch(statusUrl, key);

    if (!statusResult.response.ok) {
      const fallback = await activateFallback(user, project, `status_http_${statusResult.response.status}`, key);
      if (fallback?.saved) {
        return sendJson(res, 200, { ok: true, status: "IN_QUEUE", fallback_used: true });
      }
      return sendJson(res, 502, {
        ok: false,
        error: "fal_status_error",
        fal_status: statusResult.response.status,
        fal_response: statusResult.data,
      });
    }

    const rawStatus = pick(statusResult.data, ["status", "state", "data.status", "result.status"]);
    let audio = audioFrom(statusResult.data);
    let normalized = normalizeStatus(rawStatus, audio?.url);

    if (!audio && normalized === "COMPLETED") {
      const responseUrl = resultUrl(generation);
      const result = responseUrl ? await falFetch(responseUrl, key) : null;
      if (result?.response?.ok) {
        audio = audioFrom(result.data);
      } else if (result && result.response.status !== 202) {
        const fallback = await activateFallback(user, project, `result_http_${result.response.status}`, key);
        if (fallback?.saved) {
          return sendJson(res, 200, { ok: true, status: "IN_QUEUE", fallback_used: true });
        }
        return sendJson(res, 502, {
          ok: false,
          error: "fal_result_error",
          fal_status: result.response.status,
          fal_response: result.data,
        });
      }
      normalized = normalizeStatus(rawStatus, audio?.url);
    }

    if (normalized === "FAILED") {
      const fallback = await activateFallback(user, project, "provider_failed", key);
      if (fallback?.saved) {
        return sendJson(res, 200, { ok: true, status: "IN_QUEUE", fallback_used: true });
      }
      const failed = await saveRadioProject(user, {
        ...project,
        status: "failed",
        narrationGeneration: {
          ...generation,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: "narration_generation_failed",
        },
      });
      return sendJson(res, 200, {
        ok: true,
        status: "FAILED",
        error: failed.narrationGeneration.error,
      });
    }

    if (audio?.url) {
      const ext = audioExtension(audio.contentType, audio.fileName, audio.url);
      const keyPath = `${mediaPrefix(user, projectId)}narration/source-${Date.now()}-${generation.requestId}.${ext}`;
      let publicUrl;
      try {
        publicUrl = await copyRemoteAudioToR2({
          url: audio.url,
          key: keyPath,
          contentType: audio.contentType,
        });
      } catch (error) {
        console.error("[radio-ad/narration/status] copy to R2", error);
        return sendJson(res, 502, {
          ok: false,
          error: "narration_r2_copy_failed",
          message: String(error?.message || error),
        });
      }

      const now = new Date().toISOString();
      const savedAudio = {
        sourceUrl: publicUrl,
        url: publicUrl,
        contentType: audio.contentType || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
        duration: audio.duration || generation.timing?.estimatedSeconds || null,
        timestamps: Array.isArray(audio.timestamps) ? audio.timestamps.slice(0, 5000) : null,
        provider: generation.provider,
        model: generation.model,
        requestId: generation.requestId,
        fingerprint: generation.fingerprint || null,
        createdAt: now,
        mastered: false,
        masteringVersion: null,
        masteredAt: null,
        approved: false,
        approvedAt: null,
      };
      const saved = await saveRadioProject(user, {
        ...project,
        status: "processing",
        narration: { ...(project.narration || {}), audio: savedAudio },
        narrationGeneration: {
          ...generation,
          status: "completed",
          updatedAt: now,
          completedAt: now,
          error: null,
        },
      });
      return sendJson(res, 200, {
        ok: true,
        status: "COMPLETED",
        requires_mastering: true,
        audio: saved.narration.audio,
        timing: saved.narrationGeneration.timing || null,
      });
    }

    const nextStatus = normalized === "IN_QUEUE" ? "queued" : "processing";
    let nextGeneration = generation;
    if (generation.status !== nextStatus) {
      const updated = await saveRadioProject(user, {
        ...project,
        status: "processing",
        narrationGeneration: {
          ...generation,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        },
      });
      nextGeneration = updated.narrationGeneration;
    }

    return sendJson(res, 200, {
      ok: true,
      status: normalized,
      audio: null,
      timing: nextGeneration.timing || null,
    });
  } catch (error) {
    console.error("[radio-ad/narration/status]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
