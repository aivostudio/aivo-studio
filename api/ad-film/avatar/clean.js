// api/ad-film/avatar/clean.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import { createAvatarCutout } from "../../_lib/ad-film-avatar-cutout.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function isGeneratedImage(image) {
  return Boolean(image && image.source === "generated" && /^https:\/\//i.test(clean(image.url)));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const avatar = project.avatar && typeof project.avatar === "object" ? project.avatar : null;
    const currentImage = avatar?.image || null;
    if (!isGeneratedImage(currentImage)) {
      return sendJson(res, 409, { ok: false, error: "generated_avatar_image_required" });
    }

    if (
      currentImage.backgroundRemoved === true &&
      currentImage.contentType === "image/png" &&
      /^https:\/\//i.test(clean(currentImage.url))
    ) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        alreadyClean: true,
        avatar: project.avatar,
        avatarImageUrl: currentImage.url,
        project,
      });
    }

    const generationSeed = Number(avatar?.imageGeneration?.seed || 0) || Date.now();
    const suffix = `${generationSeed}-${Date.now()}`;
    const objectKey = `${mediaPrefix(user, projectId)}avatar/generated-clean-${suffix}.png`;
    const cutout = await createAvatarCutout({ sourceUrl: currentImage.url, objectKey });
    const now = new Date().toISOString();

    const originalImage = avatar?.originalImage && /^https:\/\//i.test(clean(avatar.originalImage.url))
      ? avatar.originalImage
      : { ...currentImage, role: "original-generated-avatar" };

    const image = {
      key: cutout.key,
      url: cutout.url,
      name: `aivo-avatar-${generationSeed}-transparent.png`,
      contentType: "image/png",
      size: cutout.size,
      width: cutout.width,
      height: cutout.height,
      kind: "avatar-image",
      source: "generated",
      role: "clean-avatar-cutout",
      backgroundRemoved: true,
      transparent: true,
      edgeRefined: true,
      uploadedAt: now,
      processedAt: now,
    };

    const cleanedAvatar = {
      ...avatar,
      image,
      originalImage,
      backgroundRemoval: {
        status: "completed",
        provider: cutout.provider,
        model: cutout.model,
        profile: cutout.profile,
        operatingResolution: cutout.operatingResolution,
        refineForeground: cutout.refineForeground,
        sourceUrl: originalImage.url,
        outputUrl: cutout.url,
        width: cutout.width,
        height: cutout.height,
        padding: cutout.padding,
        completedAt: now,
        error: null,
      },
      pipeline: null,
      videoUrl: null,
    };

    const saved = await saveProject(user, { ...project, avatar: cleanedAvatar });
    return sendJson(res, 200, {
      ok: true,
      projectId,
      cleaned: true,
      avatar: saved.avatar,
      avatarImageUrl: saved.avatar?.image?.url || cutout.url,
      project: saved,
    });
  } catch (error) {
    console.error("[ad-film/avatar/clean]", error);
    const code = clean(error?.message || error, 240) || "avatar_background_removal_failed";
    const status = code === "avatar_background_removal_timeout" ? 504 : 502;
    return sendJson(res, status, {
      ok: false,
      error: code,
      message: code,
    });
  }
}
