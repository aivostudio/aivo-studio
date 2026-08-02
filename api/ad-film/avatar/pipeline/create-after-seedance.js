// api/ad-film/avatar/pipeline/create-after-seedance.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import integratedHandler from "./create-integrated.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const KLING_V3_QUEUE = /^https:\/\/queue\.fal\.run\/fal-ai\/kling-video\/v3\/(?:pro|standard)\/image-to-video(?:$|[/?])/i;
const KLING_GUARD_KEY = Symbol.for("aivo.adfilm.kling-v3-input-guard.v2");

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeKlingElement(element) {
  if (!element || typeof element !== "object") return null;

  const videoUrl = clean(element.video_url, 4000);
  if (/^https:\/\//i.test(videoUrl)) {
    return { video_url: videoUrl };
  }

  const frontalImageUrl = clean(element.frontal_image_url, 4000);
  if (!/^https:\/\//i.test(frontalImageUrl)) return null;

  const references = Array.isArray(element.reference_image_urls)
    ? element.reference_image_urls
        .map((value) => clean(value, 4000))
        .filter((value, index, list) => /^https:\/\//i.test(value) && list.indexOf(value) === index)
        .slice(0, 4)
    : [];

  // Kling v3 image elements require a real reference set. Never duplicate the
  // frontal image into reference_image_urls: transparent full-body cutouts can
  // be narrower than Kling's 0.4 minimum aspect ratio and fail the whole job.
  // The presenter identity is already baked into start_image_url, so an empty
  // presenter element is safer to remove than to manufacture an invalid ref.
  if (!references.length) return null;

  return {
    frontal_image_url: frontalImageUrl,
    reference_image_urls: references,
  };
}

function sanitizeKlingPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  const original = Array.isArray(payload.elements) ? payload.elements : [];
  const retained = [];

  original.forEach((element, index) => {
    const sanitized = sanitizeKlingElement(element);
    if (sanitized) retained.push({ originalIndex: index, value: sanitized });
  });

  if (retained.length) next.elements = retained.map((item) => item.value);
  else delete next.elements;

  let prompt = clean(next.prompt, 5000);
  const presenterRemoved = original.length > 0 && !retained.some((item) => item.originalIndex === 0);
  const productRetained = retained.findIndex((item) => item.originalIndex === 1);

  if (presenterRemoved) {
    prompt = prompt.replace(/@Element1\b/g, "the exact presenter already visible in the start frame");
    if (productRetained >= 0) {
      prompt = prompt.replace(/@Element2\b/g, `@Element${productRetained + 1}`);
    } else {
      prompt = prompt.replace(/@Element2\b/g, "the exact hero product already visible in the start frame");
    }
  } else if (!retained.length) {
    prompt = prompt
      .replace(/@Element1\b/g, "the exact presenter already visible in the start frame")
      .replace(/@Element2\b/g, "the exact hero product already visible in the start frame");
  }

  next.prompt = prompt;
  return next;
}

function installKlingInputGuard() {
  if (globalThis[KLING_GUARD_KEY]) return;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async function guardedFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = clean(init?.method || "GET", 16).toUpperCase();

    if (method === "POST" && KLING_V3_QUEUE.test(url) && typeof init?.body === "string") {
      try {
        const parsed = JSON.parse(init.body);
        const sanitized = sanitizeKlingPayload(parsed);
        init = {
          ...(init || {}),
          headers: {
            ...(init?.headers || {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sanitized),
        };
      } catch (error) {
        console.warn("[ad-film/kling-v3-input-guard] payload_not_json", error);
      }
    }

    return nativeFetch(input, init);
  };

  globalThis[KLING_GUARD_KEY] = true;
}

installKlingInputGuard();

function matchingFinalOutput(project) {
  const generation = project?.generation || {};
  const ids = new Set(
    [project?.activeOutputId, generation.outputId, generation.requestId]
      .map((value) => clean(value, 240))
      .filter(Boolean),
  );
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];
  return outputs.find((item) => {
    const id = clean(item?.id, 240);
    if (!id || !ids.has(id) || !clean(item?.videoUrl, 4000)) return false;
    return Boolean(
      item?.hybridTimeline === true ||
      item?.avatarApplied === true ||
      item?.avatarIntegrated === true ||
      clean(item?.avatarCompositeMode, 80) ||
      Number(item?.mixVersion || 0) >= 12
    );
  }) || null;
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

    const requestedProductionId = clean(req.body?.production_id, 160);
    const acceptedProductionId = clean(
      project?.generation?.productionId ||
      project?.generation?.input?.productionId ||
      project?.productionPlan?.productionId,
      160,
    );

    if (!requestedProductionId || !acceptedProductionId || requestedProductionId !== acceptedProductionId) {
      return sendJson(res, 409, {
        ok: false,
        error: "production_lock_mismatch",
        accepted_production_id: acceptedProductionId || null,
      });
    }

    const finalizedOutput = matchingFinalOutput(project);
    if (finalizedOutput && clean(project?.generation?.status, 80).toLowerCase() === "completed") {
      return sendJson(res, 409, {
        ok: false,
        error: "production_already_completed",
        output_id: finalizedOutput.id,
        video_url: finalizedOutput.videoUrl,
      });
    }

    const seedanceVideoUrl = clean(
      project?.generation?.sourceVideoUrl || project?.generation?.videoUrl,
      4000,
    );
    if (!/^https:\/\//i.test(seedanceVideoUrl)) {
      return sendJson(res, 425, {
        ok: false,
        error: "seedance_generation_not_ready",
        status: project?.generation?.status || "processing",
      });
    }

    return integratedHandler(req, res);
  } catch (error) {
    console.error("[ad-film/avatar/pipeline/create-after-seedance]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: clean(error?.message || error, 1200),
    });
  }
}
