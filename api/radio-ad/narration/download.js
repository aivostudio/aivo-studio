// api/radio-ad/narration/download.js
export const config = { runtime: "nodejs" };

import {
  buildPublicUrl,
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 1800) {
  return String(value ?? "").trim().slice(0, max);
}

function isOwnedAudioUrl(url, user, projectId) {
  const prefix = mediaPrefix(user, projectId);
  const publicPrefix = buildPublicUrl(prefix);
  if (String(url || "").startsWith(publicPrefix)) return true;
  try {
    const parsed = new URL(String(url || ""));
    const path = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    return parsed.protocol === "https:" && path.includes(prefix);
  } catch (_) {
    return false;
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

    const audio = project.narration?.audio;
    const url = clean(audio?.url || audio?.previewUrl);
    if (!url) return sendJson(res, 404, { ok: false, error: "narration_audio_missing" });
    if (!isOwnedAudioUrl(url, user, projectId)) {
      return sendJson(res, 403, { ok: false, error: "unowned_audio_url" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let upstream;
    try {
      upstream = await fetch(url, { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return sendJson(res, 502, { ok: false, error: "audio_fetch_failed", upstream_status: upstream.status });
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    if (!body.length || body.length > 25 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: "audio_too_large" });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(body.length));
    res.setHeader("Content-Disposition", 'attachment; filename="aivo-radyo-seslendirme.mp3"');
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(body);
  } catch (error) {
    console.error("[radio-ad/narration/download]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
