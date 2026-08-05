// api/radio-ad/final/download.js
export const config = { runtime: "nodejs" };

import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function selectFinal(project, finalId) {
  if (!finalId) return project.final || null;
  const history = Array.isArray(project.finalHistory) ? project.finalHistory : [];
  return history.find((item) => clean(item?.id, 160) === finalId) || null;
}

function asciiFilename(value) {
  return clean(value || "AIVO-Radyo-Reklami", 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "AIVO-Radyo-Reklami";
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
    const finalId = clean(req.query?.finalId, 160);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const final = selectFinal(project, finalId);
    if (!final?.url) return sendJson(res, 404, { ok: false, error: "final_audio_missing" });

    const response = await fetch(final.url, { cache: "no-store", redirect: "follow" });
    if (!response.ok) return sendJson(res, 502, { ok: false, error: "final_download_failed" });

    const body = Buffer.from(await response.arrayBuffer());
    const format = final.format === "wav" ? "wav" : "mp3";
    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    const title = clean(final.title || project.title || "AIVO Radyo Reklami", 80);
    const fallbackName = `${asciiFilename(title)}.${format}`;
    const utf8Name = encodeURIComponent(`${title}.${format}`);

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(body.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fallbackName}"; filename*=UTF-8''${utf8Name}`
    );
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(body);
  } catch (error) {
    console.error("[radio-ad/final/download]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
