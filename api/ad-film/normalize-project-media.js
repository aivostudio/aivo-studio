export const config = { runtime: "nodejs" };
export const maxDuration = 300;

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../_lib/ad-film-projects.js";
import { normalizeStoredMedia } from "../_lib/ad-film-image-normalizer.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function hasStoredUrl(item) {
  return Boolean(
    clean(item?.key, 1600) &&
    clean(item?.url || item?.readUrl || item?.publicUrl, 8000),
  );
}

function alreadyNormalized(item, kind) {
  if (!item || typeof item !== "object") return true;
  if (!hasStoredUrl(item)) return false;
  if (clean(item.kind, 40) && clean(item.kind, 40) !== kind) return false;

  const key = clean(item.key, 1600);
  const normalizedVersion = Number(item.normalizationVersion || 0);
  const finalizerLogoVersion = Number(item.finalizerLogoVersion || 0);
  return item.normalized === true && (
    normalizedVersion >= 1 ||
    finalizerLogoVersion >= 1 ||
    key.includes("/normalized/")
  );
}

function productionActive(project) {
  const generation = project?.generation || {};
  const pipeline = project?.avatar?.pipeline || {};
  const states = [project?.status, generation.status, pipeline.status]
    .map((value) => clean(value, 80).toLowerCase());
  if (states.some((value) => [
    "queued",
    "processing",
    "running",
    "in_queue",
    "motion_queued",
    "motion_processing",
    "lipsync_queued",
    "lipsync_processing",
    "rendering",
    "finalizing",
  ].includes(value))) return true;
  return generation.avatarWaiting === true ||
    generation.awaitingFinalComposite === true ||
    generation.finalizing === true ||
    project?.preparingNewVersion === true;
}

async function mapConcurrent(items, limit, worker) {
  const source = Array.isArray(items) ? items : [];
  const output = new Array(source.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= source.length) return;
      output[index] = await worker(source[index], index);
    }
  }

  const count = Math.max(1, Math.min(Number(limit) || 1, source.length || 1));
  await Promise.all(Array.from({ length: count }, () => run()));
  return output;
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
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    // Normalization is a pre-production preparation step. An active production
    // must never be mutated, but this is an expected no-op rather than an HTTP
    // conflict. Returning 200 prevents harmless page-mount preflight checks
    // from appearing as production failures in DevTools.
    if (productionActive(project)) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        changed: false,
        skipped: true,
        reason: "production_active",
        normalized_product_count: 0,
        normalized_logo_count: 0,
        project,
      });
    }

    const media = project.media && typeof project.media === "object" ? project.media : {};
    const productImages = Array.isArray(media.productImages) ? media.productImages : [];
    let normalizedProductCount = 0;
    let normalizedLogoCount = 0;

    const nextProductImages = await mapConcurrent(productImages, 3, async (item) => {
      if (alreadyNormalized(item, "product-image")) return item;
      const normalized = await normalizeStoredMedia({
        user,
        projectId,
        item,
        kind: "product-image",
      });
      normalizedProductCount += 1;
      return normalized;
    });

    let nextLogo = media.logo || null;
    if (nextLogo && !alreadyNormalized(nextLogo, "logo")) {
      nextLogo = await normalizeStoredMedia({
        user,
        projectId,
        item: nextLogo,
        kind: "logo",
      });
      normalizedLogoCount = 1;
    }

    if (!normalizedProductCount && !normalizedLogoCount) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        changed: false,
        normalized_product_count: 0,
        normalized_logo_count: 0,
        project,
      });
    }

    const now = new Date().toISOString();
    const nextProject = await saveProject(user, {
      ...project,
      media: {
        ...media,
        productImages: nextProductImages,
        logo: nextLogo,
      },
      mediaNormalization: {
        version: 1,
        normalizedAt: now,
        productCount: nextProductImages.length,
        logoNormalized: Boolean(nextLogo?.normalized),
      },
      updatedAt: now,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      changed: true,
      normalized_product_count: normalizedProductCount,
      normalized_logo_count: normalizedLogoCount,
      project: nextProject,
    });
  } catch (error) {
    console.error("[ad-film/normalize-project-media]", error);
    const message = clean(error?.message || error, 1200);
    const status =
      message.includes("too_large") || message.includes("invalid_media_input_size") ? 413 :
      message.includes("invalid_") || message.includes("unsupported_") ? 400 :
      500;
    return sendJson(res, status, {
      ok: false,
      error: "project_media_normalization_failed",
      message,
      retryable: status >= 500,
    });
  }
}
