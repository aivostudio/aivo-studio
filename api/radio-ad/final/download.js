// api/radio-ad/final/download.js
export const config = { runtime: "nodejs" };

import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 4000) { return String(value ?? "").trim().slice(0, max); }

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
    const final = project.final;
    if (!final?.url) return sendJson(res, 404, { ok: false, error: "final_audio_missing" });

    const response = await fetch(final.url, { cache: "no-store", redirect: "follow" });
    if (!response.ok) return sendJson(res, 502, { ok: false, error: "final_download_failed" });
    const body = Buffer.from(await response.arrayBuffer());
    const format = final.format === "wav" ? "wav" : "mp3";
    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(body.length));
    res.setHeader("Content-Disposition", `attachment; filename="AIVO-Radyo-Reklami.${format}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(body);
  } catch (error) {
    console.error("[radio-ad/final/download]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
