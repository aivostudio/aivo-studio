// api/radio-ad/narration/approve.js
export const config = { runtime: "nodejs" };

import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 2400) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
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

    const audio = project.narration?.audio;
    if (!audio?.url) return sendJson(res, 409, { ok: false, error: "narration_audio_missing" });
    if (audio.mastered !== true) return sendJson(res, 409, { ok: false, error: "narration_mastering_required" });

    const currentText = clean(project.narration?.text);
    const generatedText = clean(project.narrationGeneration?.input?.text);
    if (generatedText && currentText !== generatedText) {
      return sendJson(res, 409, { ok: false, error: "narration_text_changed" });
    }

    const now = new Date().toISOString();
    const saved = await saveRadioProject(user, {
      ...project,
      narration: {
        ...(project.narration || {}),
        audio: {
          ...audio,
          approved: true,
          approvedAt: now,
          approvedText: generatedText || currentText,
        },
      },
    });

    return sendJson(res, 200, {
      ok: true,
      status: "COMPLETED",
      project: saved,
      audio: saved.narration.audio,
    });
  } catch (error) {
    console.error("[radio-ad/narration/approve]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
