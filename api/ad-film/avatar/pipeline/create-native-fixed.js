// api/ad-film/avatar/pipeline/create-native-fixed.js
// Normalizes product/scene references before the native avatar pipeline runs.
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import nativeHandler from "./create-native.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function isHttpUrl(value) {
  return /^https:\/\//i.test(clean(value, 4000));
}

function stableMediaUrl(value) {
  const source = clean(value, 4000);
  if (!isHttpUrl(source)) return "";
  try {
    const url = new URL(source);
    if (/\.r2\.cloudflarestorage\.com$/i.test(url.hostname)) {
      let pathname = url.pathname.replace(/^\/+/, "");
      pathname = pathname.replace(/^aivo-archive\//i, "");
      if (pathname.startsWith("uploads/")) {
        return `https://media.aivo.tr/${pathname}`;
      }
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (_) {
    return source;
  }
}

function uniqueUrls(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const url = stableMediaUrl(value?.url || value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
    if (result.length >= 9) break;
  }
  return result;
}

function referenceUrls(project) {
  const generation = project?.generation || {};
  const candidates = [
    generation?.input?.image_urls,
    generation?.input?.imageUrls,
    generation?.retryInput?.image_urls,
    generation?.retryInput?.imageUrls,
    project?.media?.productImages,
  ];
  for (const candidate of candidates) {
    const urls = uniqueUrls(candidate);
    if (urls.length) return urls;
  }
  return [];
}

function normalizeIndex(value, count) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 1 && number <= count ? number : null;
}

function normalizeIndexList(values, count, excluded = new Set()) {
  const result = [];
  const seen = new Set(excluded);
  for (const value of Array.isArray(values) ? values : []) {
    const index = normalizeIndex(value, count);
    if (!index || seen.has(index)) continue;
    seen.add(index);
    result.push(index);
  }
  return result;
}

function referenceMap(project, count) {
  const generation = project?.generation || {};
  const source =
    generation?.input?.reference_map ||
    generation?.input?.referenceMap ||
    generation?.referenceMap ||
    generation?.reference_map ||
    generation?.retryInput?.referenceMap ||
    generation?.retryInput?.reference_map ||
    {};

  const hero = normalizeIndex(source?.hero, count) || 1;
  const used = new Set([hero]);
  let angles = normalizeIndexList(source?.angles, count, used).slice(0, 3);
  angles.forEach((index) => used.add(index));
  let scenes = normalizeIndexList(source?.scenes, count, used).slice(0, 5);

  if (!angles.length) {
    angles = Array.from({ length:Math.min(2, Math.max(0, count - 1)) }, (_, offset) => offset + 2)
      .filter((index) => index <= count && index !== hero);
    angles.forEach((index) => used.add(index));
  }
  if (!scenes.length) {
    scenes = Array.from({ length:count }, (_, offset) => offset + 1)
      .filter((index) => !used.has(index))
      .slice(0, 5);
  }

  return { hero, angles, scenes };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok:false, error:"method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok:false, error:"unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok:false, error:"missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok:false, error:"project_not_found" });

    const imageUrls = referenceUrls(project);
    if (!imageUrls.length) {
      return sendJson(res, 409, {
        ok:false,
        error:"product_reference_required",
        message:"Ana ürün referansı bulunamadı. Ürün görsellerini yeniden seçmeden üretim başlatılamaz.",
      });
    }

    const map = referenceMap(project, imageUrls.length);
    const generation = project.generation || {};
    const normalizedProject = await saveProject(user, {
      ...project,
      generation: {
        ...generation,
        input: {
          ...(generation.input || {}),
          image_urls:imageUrls,
          imageUrls,
          reference_map:map,
          referenceMap:map,
        },
        reference_map:map,
        referenceMap:map,
      },
    });

    req.body = {
      ...(req.body || {}),
      projectId:normalizedProject.id,
    };
    return nativeHandler(req, res);
  } catch (error) {
    console.error("[ad-film/avatar/pipeline/create-native-fixed]", error);
    return sendJson(res, Number(error?.status) || 500, {
      ok:false,
      error:clean(error?.message || error, 1200) || "native_reference_normalization_failed",
    });
  }
}
