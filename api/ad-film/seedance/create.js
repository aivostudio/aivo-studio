// api/ad-film/seedance/create.js
export const config = { runtime: "nodejs" };

import { buildDirectorPlan, composeSeedancePrompt } from "../../_lib/ad-film-director.js";
import {
  buildPublicUrl,
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "bytedance/seedance-2.0/reference-to-video";
const QUEUE_URL = `https://queue.fal.run/${MODEL}`;
const RESOLUTIONS = new Set(["480p", "720p", "1080p", "4k"]);
const ASPECT_RATIOS = new Set(["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
const BITRATES = new Set(["standard", "high"]);
const MAX_PROMPT_CHARS = 2480;

const CATEGORY_PRODUCT_NAMES = Object.freeze({
  earbuds: "Kablosuz Kulaklık",
  fragrance: "Parfüm",
  smartphone: "Akıllı Telefon",
  vehicle: "Otomobil",
  footwear: "Ayakkabı",
  furniture: "Mobilya",
  large_appliance: "Büyük Ev Aleti",
  countertop_appliance: "Küçük Ev Aleti",
  personal_computing: "Bilgisayar",
  wearable_luxury: "Aksesuar",
});

function clean(value, max = 12000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function parseJson(text) { try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text || "" }; } }
function ownedPublicPrefix(user, projectId) { return buildPublicUrl(mediaPrefix(user, projectId)); }
function isOwnedSignedUrl(url, ownedKeyPrefix) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const decodedPath = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    return decodedPath.includes(ownedKeyPrefix);
  } catch (_) { return false; }
}
function validateOwnedUrls(values, publicPrefix, ownedKeyPrefix, max) {
  if (!Array.isArray(values)) return [];
  const next = [];
  for (const value of values) {
    const url = clean(value, 4000);
    if (!url || !/^https:\/\//i.test(url)) throw new Error("invalid_media_url");
    if (!url.startsWith(publicPrefix) && !isOwnedSignedUrl(url, ownedKeyPrefix)) throw new Error("unowned_media_url");
    if (!next.includes(url)) next.push(url);
    if (next.length >= max) break;
  }
  return next;
}
function normalizeDuration(value) {
  const duration = Number.parseInt(value, 10);
  if (!Number.isFinite(duration) || duration < 4 || duration > 15) return null;
  return String(duration);
}
function activeGeneration(project) {
  const generation = project?.generation;
  if (!generation || !["queued", "processing"].includes(String(generation.status))) return false;
  const startedAt = Date.parse(generation.startedAt || "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < 30 * 60 * 1000;
}
function finalizedCurrentGeneration(project) {
  const generation = project?.generation || {};
  const currentIds = new Set(
    [generation.outputId, generation.requestId]
      .map((value) => clean(value, 240))
      .filter(Boolean),
  );
  if (!currentIds.size) return false;
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];
  return outputs.some((item) => {
    const id = clean(item?.id, 240);
    if (!id || !currentIds.has(id) || !clean(item?.videoUrl, 4000)) return false;
    return Boolean(
      item?.hybridTimeline === true ||
      item?.avatarApplied === true ||
      item?.avatarIntegrated === true ||
      clean(item?.avatarCompositeMode, 80) ||
      Number(item?.mixVersion || 0) >= 4 ||
      Number(generation.mixVersion || 0) >= 4
    );
  });
}
function nextVersion(project) {
  const versions = Array.isArray(project?.outputs)
    ? project.outputs.map((item) => Number.parseInt(item?.version, 10)).filter(Number.isFinite)
    : [];
  return Math.max(0, ...versions) + 1;
}
function approvedNarration(project) {
  const narration = project?.narration || {};
  if (narration.enabled === false) return { required: false, audio: null };
  const audio = narration.audio;
  return {
    required: true,
    audio: audio && audio.approved === true && /^https:\/\//i.test(String(audio.url || "")) ? audio : null,
  };
}
function resetActiveProductionState(project) {
  const jobs = { ...(project?.productionJobs || {}) };
  delete jobs.avatar;
  delete jobs.finalization;
  return {
    ...project,
    error: null,
    lastError: null,
    finalization: null,
    productionJobs: jobs,
    avatar: project?.avatar
      ? { ...project.avatar, pipeline: null, videoUrl: null }
      : project?.avatar,
  };
}

function categoryFromText(value) {
  const source = clean(value, 1000).toLocaleLowerCase("tr-TR");
  if (!source) return null;
  const groups = [
    ["earbuds", ["kulaklık", "earbud", "earphone", "airpods", "şarj kutusu", "charging case"]],
    ["fragrance", ["parfüm", "parfum", "perfume", "fragrance", "kolonya", "atomizer"]],
    ["smartphone", ["telefon", "smartphone", "iphone", "cep telefonu"]],
    ["vehicle", ["otomobil", "araba", "vehicle", "motorcycle", "motosiklet", "suv"]],
    ["footwear", ["ayakkabı", "sneaker", "shoe", "bot", "terlik"]],
    ["furniture", ["koltuk", "sofa", "sandalye", "chair", "mobilya", "furniture", "yatak"]],
    ["large_appliance", ["buzdolabı", "refrigerator", "çamaşır makinesi", "dishwasher", "bulaşık makinesi", "fırın"]],
    ["countertop_appliance", ["kahve makinesi", "coffee machine", "airfryer", "air fryer", "blender", "kettle"]],
    ["personal_computing", ["laptop", "notebook", "tablet", "ipad", "bilgisayar"]],
    ["wearable_luxury", ["saat", "watch", "bileklik", "bracelet", "yüzük", "ring", "mücevher"]],
  ];
  for (const [category, terms] of groups) {
    if (terms.some((term) => source.includes(term))) return category;
  }
  return null;
}

function canonicalProductName(project, category) {
  const brandName = clean(project?.brief?.brandName, 80);
  const categoryName = CATEGORY_PRODUCT_NAMES[category] || "Ürün";
  return [brandName, categoryName].filter(Boolean).join(" ") || categoryName;
}

function productIdentityCheck(project) {
  const evidence = {
    productName: categoryFromText(project?.brief?.productName),
    description: categoryFromText(project?.brief?.description),
    narration: categoryFromText(project?.narration?.audio?.approvedText || project?.narration?.text),
  };
  const categories = [...new Set(Object.values(evidence).filter(Boolean))];
  if (categories.length <= 1) {
    return {
      ok: true,
      category: categories[0] || null,
      evidence,
      autoResolved: false,
      resolvedProductName: clean(project?.brief?.productName, 120) || null,
    };
  }

  const descriptionNarrationConsensus =
    evidence.description &&
    evidence.description === evidence.narration &&
    evidence.productName &&
    evidence.productName !== evidence.description;

  if (descriptionNarrationConsensus) {
    const category = evidence.description;
    return {
      ok: true,
      category,
      evidence,
      categories,
      autoResolved: true,
      staleField: "productName",
      originalProductName: clean(project?.brief?.productName, 120) || null,
      resolvedProductName: canonicalProductName(project, category),
      warning: "stale_product_name_auto_resolved",
    };
  }

  return { ok: false, error: "product_identity_conflict", categories, evidence };
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
    if (activeGeneration(project) && !finalizedCurrentGeneration(project)) {
      return sendJson(res, 409, { ok: false, error: "generation_in_progress", generation: project.generation });
    }

    const identity = productIdentityCheck(project);
    if (!identity.ok) {
      return sendJson(res, 409, {
        ok: false,
        error: identity.error,
        message: "Product name, description and narration describe different product categories.",
        identity,
      });
    }

    const effectiveProject = identity.autoResolved
      ? {
          ...project,
          brief: {
            ...(project.brief || {}),
            productName: identity.resolvedProductName,
          },
        }
      : project;

    const narration = approvedNarration(effectiveProject);
    if (narration.required && !narration.audio) {
      return sendJson(res, 409, {
        ok: false,
        error: "narration_audio_approval_required",
        message: "Generate, preview and approve the narration before creating the advertising film.",
      });
    }
    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const ownedKeyPrefix = mediaPrefix(user, projectId);
    const publicPrefix = ownedPublicPrefix(user, projectId);
    let imageUrls;
    let logoUrl = "";
    try {
      imageUrls = validateOwnedUrls(req.body?.image_urls, publicPrefix, ownedKeyPrefix, 9);
      logoUrl = clean(req.body?.logo_url, 4000);
      if (logoUrl && !logoUrl.startsWith(publicPrefix) && !isOwnedSignedUrl(logoUrl, ownedKeyPrefix)) throw new Error("unowned_media_url");
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: String(error?.message || error) });
    }
    if (!imageUrls.length) return sendJson(res, 400, { ok: false, error: "missing_reference_image" });

    const duration = normalizeDuration(req.body?.duration);
    const resolution = clean(req.body?.resolution, 20).toLowerCase();
    const aspectRatio = clean(req.body?.aspect_ratio, 20).toLowerCase();
    const bitrateMode = clean(req.body?.bitrate_mode, 20).toLowerCase();
    const productionId = clean(req.body?.production_id, 160) || `adfilm-${Date.now()}`;
    if (!duration) return sendJson(res, 400, { ok: false, error: "invalid_duration" });
    if (!RESOLUTIONS.has(resolution)) return sendJson(res, 400, { ok: false, error: "invalid_resolution" });
    if (!ASPECT_RATIOS.has(aspectRatio)) return sendJson(res, 400, { ok: false, error: "invalid_aspect_ratio" });
    if (!BITRATES.has(bitrateMode)) return sendJson(res, 400, { ok: false, error: "invalid_bitrate_mode" });

    const referenceMap = req.body?.reference_map && typeof req.body.reference_map === "object" ? req.body.reference_map : null;
    const directorPlan = buildDirectorPlan(effectiveProject, {
      duration,
      aspectRatio,
      quality: resolution,
      avatarEnabled: effectiveProject?.avatar?.enabled === true,
      productName: effectiveProject?.brief?.productName,
      brandName: effectiveProject?.brief?.brandName,
      description: effectiveProject?.brief?.description,
      creativeDirection: effectiveProject?.creativePlan?.direction || effectiveProject?.avatar?.sceneDescription || "",
      scenes: Array.isArray(effectiveProject?.creativePlan?.scenes) ? effectiveProject.creativePlan.scenes : [],
    });
    const prompt = composeSeedancePrompt(req.body?.prompt, directorPlan, MAX_PROMPT_CHARS);
    if (prompt.length < 20) return sendJson(res, 400, { ok: false, error: "missing_prompt" });

    const input = {
      prompt,
      image_urls: imageUrls,
      resolution,
      duration,
      aspect_ratio: aspectRatio,
      generate_audio: false,
      bitrate_mode: bitrateMode,
      end_user_id: user.ownerHash,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;
    try {
      response = await fetch(QUEUE_URL, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch (error) {
      return sendJson(res, 504, { ok: false, error: "fal_timeout_or_network_error", message: String(error?.message || error) });
    } finally { clearTimeout(timeout); }

    const text = await response.text().catch(() => "");
    const fal = parseJson(text);
    if (!response.ok) return sendJson(res, response.status, { ok: false, error: "fal_error", fal_status: response.status, fal_response: fal });
    const requestId = clean(fal?.request_id || fal?.requestId || fal?.id, 240);
    const statusUrl = clean(fal?.status_url || fal?.statusUrl || fal?.urls?.status, 1200);
    const responseUrl = clean(fal?.response_url || fal?.responseUrl || fal?.urls?.response, 1200);
    if (!requestId) return sendJson(res, 502, { ok: false, error: "fal_missing_request_id", fal_response: fal });

    const now = new Date().toISOString();
    const version = nextVersion(effectiveProject);
    const retryInput = {
      prompt,
      imageUrls,
      audioUrls: [],
      resolution,
      duration,
      aspectRatio,
      bitrateMode,
      generateAudio: false,
      referenceMap,
      directorPlan,
      identityResolution: identity,
      productionId,
    };
    const productionProject = resetActiveProductionState(effectiveProject);
    const previousActiveOutputId = productionProject.activeOutputId || null;
    const nextProject = await saveProject(user, {
      ...productionProject,
      status: "processing",
      identityResolution: identity,
      productionPlan: { ...directorPlan, productionId, identityResolution: identity },
      outputs: Array.isArray(productionProject.outputs) ? productionProject.outputs.slice(0, 30) : [],
      activeOutputId: null,
      generation: {
        provider: "fal",
        model: MODEL,
        requestId,
        outputId: requestId,
        productionId,
        previousActiveOutputId,
        version,
        statusUrl: statusUrl || null,
        responseUrl: responseUrl || null,
        status: "queued",
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        videoUrl: null,
        sourceVideoUrl: null,
        seed: null,
        logoUrl: logoUrl || null,
        audioSafetyRetry: 1,
        retryInput,
        narrationAudioUrl: narration.audio?.url || null,
        narrationApprovedAt: narration.audio?.approvedAt || null,
        directorPlanVersion: directorPlan.version,
        identityResolution: identity,
        input: {
          productionId,
          duration,
          resolution,
          aspectRatio,
          bitrateMode,
          generateAudio: false,
          imageCount: imageUrls.length,
          audioCount: 0,
          approvedNarration: !!narration.audio,
          promptLength: prompt.length,
          image_urls: imageUrls,
          reference_map: referenceMap,
        },
        referenceMap,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      provider: "fal",
      model: MODEL,
      projectId,
      production_id: productionId,
      request_id: requestId,
      output_id: requestId,
      version,
      status_url: statusUrl || null,
      response_url: responseUrl || null,
      status: "IN_QUEUE",
      director_plan: directorPlan,
      identity_resolution: identity,
      generation: nextProject.generation,
      outputs: nextProject.outputs || [],
      activeOutputId: nextProject.activeOutputId || null,
    });
  } catch (error) {
    console.error("[ad-film/seedance/create]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
