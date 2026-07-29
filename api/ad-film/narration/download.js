// api/ad-film/narration/download.js
export const config = { runtime: "nodejs" };

import {
  buildPublicUrl,
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function safeName(value) {
  const name = clean(value || "aivo-reklam-sesi", 80)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return name || "aivo-reklam-sesi";
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

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.query?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const audio = project.narration?.audio;
    const url = clean(audio?.url, 1800);
    if (!url) return sendJson(res, 404, { ok: false, error: "narration_audio_missing" });
    if (!isOwnedAudioUrl(url, user, projectId)) {
      return sendJson(res, 403, { ok: false, error: "unowned_audio_url" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return sendJson(res, 502, { ok: false, error: "audio_fetch_failed", upstream_status: response.status });
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > 25 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: "audio_too_large" });
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 25 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: "audio_too_large" });
    }

    const contentType = clean(audio?.contentType || response.headers.get("content-type") || "audio/mpeg", 100);
    const extension = /wav/i.test(contentType) ? "wav" : /ogg/i.test(contentType) ? "ogg" : "mp3";
    const filename = `${safeName(project.brief?.productName)}-seslendirme.${extension}`;

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(body.length));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(body);
  } catch (error) {
    console.error("[ad-film/narration/download]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
