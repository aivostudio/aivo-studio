// api/ad-film/narration/delete.js
export const config = { runtime: "nodejs" };

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 1800) {
  return String(value ?? "").trim().slice(0, max);
}

function ownedKeyFromUrl(url, user, projectId) {
  const prefix = mediaPrefix(user, projectId);
  try {
    const parsed = new URL(String(url || ""));
    if (parsed.protocol !== "https:") return null;
    const path = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    const index = path.indexOf(prefix);
    if (index < 0) return null;
    const key = path.slice(index);
    return key.startsWith(prefix) ? key : null;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "DELETE") {
      res.setHeader("Allow", "POST, DELETE");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId || req.query?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const audio = project.narration?.audio || null;
    const key = ownedKeyFromUrl(audio?.url, user, projectId);

    if (key && process.env.R2_BUCKET) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
      } catch (error) {
        console.warn("[ad-film/narration/delete] R2 delete", error);
      }
    }

    const saved = await saveProject(user, {
      ...project,
      narration: {
        ...(project.narration || {}),
        audio: null,
      },
      narrationGeneration: null,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      deleted: !!audio,
      narration: saved.narration,
    });
  } catch (error) {
    console.error("[ad-film/narration/delete]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
