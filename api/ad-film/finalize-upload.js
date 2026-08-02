export const config = { runtime: "nodejs" };
export const maxDuration = 60;

import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  sendJson,
} from "../_lib/ad-film-projects.js";
import { normalizeStoredMedia } from "../_lib/ad-film-image-normalizer.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function allowedKind(value) {
  const kind = clean(value, 40).toLowerCase();
  return kind === "logo" || kind === "product-image" ? kind : "";
}

function ownedKey(user, projectId, key) {
  const prefix = mediaPrefix(user, projectId);
  return Boolean(key && String(key).startsWith(prefix));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    const kind = allowedKind(req.body?.kind);
    const item = req.body?.item && typeof req.body.item === "object" ? req.body.item : null;

    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    if (!kind) return sendJson(res, 400, { ok: false, error: "unsupported_normalization_kind" });
    if (!item) return sendJson(res, 400, { ok: false, error: "missing_media_item" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const key = clean(item.key, 1200);
    if (!ownedKey(user, projectId, key)) {
      return sendJson(res, 403, { ok: false, error: "media_key_not_owned" });
    }

    const normalized = await normalizeStoredMedia({ user, projectId, item, kind });
    return sendJson(res, 200, {
      ok: true,
      projectId,
      kind,
      item: normalized,
    });
  } catch (error) {
    console.error("[ad-film/finalize-upload]", error);
    const message = clean(error?.message || error, 1200);
    const status =
      message.includes("too_large") || message.includes("invalid_media_input_size") ? 413 :
      message.includes("invalid_") || message.includes("unsupported_") ? 400 :
      500;
    return sendJson(res, status, {
      ok: false,
      error: "media_normalization_failed",
      message,
    });
  }
}
