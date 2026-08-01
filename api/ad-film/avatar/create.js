// api/ad-film/avatar/create.js
export const config = { runtime: "nodejs" };
export const maxDuration = 60;

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "fal-ai/flux-2-pro";
const ACTIVE_JOB_MS = 25 * 60 * 1000;
const COUNTRIES = {
  tr: "Turkish",
  us: "American",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  br: "Brazilian",
  arab: "Arab",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  ua: "Ukrainian",
  in: "Indian",
  id: "Indonesian",
  my: "Malaysian",
  jp: "Japanese",
  kr: "Korean",
  cn: "Chinese",
  vn: "Vietnamese",
  th: "Thai",
};
const ENUMS = {
  gender: new Set(["female", "male"]),
  age: new Set(["18-25", "26-35", "36-50", "50+"]),
  hairColor: new Set(["black", "brown", "blonde", "red", "gray"]),
  hairStyle: new Set(["short", "medium", "long", "straight", "wavy", "curly"]),
  framing: new Set(["shoulders", "chest", "waist", "full"]),
  expression: new Set(["friendly", "confident", "calm", "energetic"]),
  outfit: new Set(["casual", "business", "premium", "sport", "elegant"]),
  maleAppearance: new Set(["handsome", "charismatic", "attractive", "natural"]),
  femaleAppearance: new Set(["beautiful", "fashion_model", "attractive", "elegant_natural"]),
  outfitColor: new Set([
    "scene_harmony", "product_tone", "contrast", "mixed",
    "black", "white", "red", "blue", "navy", "gray", "beige", "brown", "pink", "green",
    "black_white", "black_red", "black_gold", "white_gold", "navy_white",
  ]),
  faceAccessory: new Set(["none", "round_glasses", "square_glasses", "aviator_glasses", "sunglasses"]),
};

function clean(value, max = 160) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
function cleanPrompt(value, max = 1000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}
function parseJson(value) {
  try { return value ? JSON.parse(value) : {}; }
  catch (_) { return {}; }
}
function pick(value, allowed, fallback) {
  const normalized = clean(value, 40).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}
function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}
function activeGeneration(avatar) {
  const generation = avatar?.imageGeneration;
  if (!generation || !["queued", "running", "saving"].includes(generation.status)) return false;
  const startedAt = Date.parse(generation.startedAt || "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < ACTIVE_JOB_MS;
}

function appearanceFor(settings) {
  if (settings.gender === "male") {
    return {
      handsome: "exceptionally handsome commercial-model appearance with balanced masculine facial features",
      charismatic: "charismatic premium spokesperson appearance with strong presence and trustworthy masculine features",
      attractive: "attractive contemporary advertising-presenter appearance",
      natural: "natural understated appearance with realistic everyday attractiveness",
    }[settings.maleAppearance];
  }
  return {
    beautiful: "exceptionally beautiful commercial-presenter appearance with balanced feminine facial features",
    fashion_model: "high-fashion model appearance with refined editorial facial structure and premium presence",
    attractive: "attractive contemporary advertising-presenter appearance",
    elegant_natural: "elegant natural appearance with realistic beauty and warm sophistication",
  }[settings.femaleAppearance];
}
function outfitColorFor(settings) {
  return {
    scene_harmony: "clothing colors selected to harmonize with a premium neutral studio and remain adaptable to the final advertising environment",
    product_tone: "clothing palette coordinated with the featured product's dominant color family without copying logos or graphics",
    contrast: "a tasteful contrasting clothing palette that separates the presenter clearly from the product and background",
    mixed: "a refined two-tone mixed clothing palette with controlled premium color blocking",
    black: "black clothing",
    white: "white clothing",
    red: "red clothing",
    blue: "blue clothing",
    navy: "navy clothing",
    gray: "gray clothing",
    beige: "beige clothing",
    brown: "brown clothing",
    pink: "pink clothing",
    green: "green clothing",
    black_white: "black and white clothing palette",
    black_red: "black and red clothing palette",
    black_gold: "black and restrained gold clothing palette",
    white_gold: "white and restrained gold clothing palette",
    navy_white: "navy and white clothing palette",
  }[settings.outfitColor];
}
function accessoryFor(settings) {
  return {
    none: "no glasses and no face accessory",
    round_glasses: "clean round optical glasses with clear lenses; eyes remain fully visible",
    square_glasses: "clean square optical glasses with clear lenses; eyes remain fully visible",
    aviator_glasses: "refined aviator-style optical glasses with clear lenses; eyes remain fully visible",
    sunglasses: "premium sunglasses worn naturally; face remains recognizable and unobstructed",
  }[settings.faceAccessory];
}
function promptFor(settings) {
  const framing = {
    shoulders: "shoulders-up portrait",
    chest: "chest-up portrait",
    waist: "waist-up portrait",
    full: "head-to-toe full-body portrait, camera pulled back far enough to show the entire person from the top of the hair to the soles of both shoes",
  }[settings.framing];
  const outfit = {
    casual: "modern casual clothing",
    business: "clean professional business clothing",
    premium: "premium luxury clothing",
    sport: "refined modern sportswear",
    elegant: "elegant contemporary clothing",
  }[settings.outfit];
  const expression = {
    friendly: "friendly and approachable expression",
    confident: "confident trustworthy expression",
    calm: "calm reassuring expression",
    energetic: "energetic positive expression",
  }[settings.expression];
  const fullBodyRule = settings.framing === "full"
    ? "Mandatory full-body composition: both arms and both legs are fully visible, both feet and both shoes are completely inside the image, with comfortable empty margin above the head and below the shoes. Do not crop the head, hands, knees, ankles, feet or shoes. Do not use a close-up, medium shot, three-quarter crop or seated pose."
    : "";

  return [
    `Photorealistic ${COUNTRIES[settings.country]} ${settings.gender} advertising presenter, age ${settings.age}.`,
    `${appearanceFor(settings)}.`,
    `${settings.hairColor} ${settings.hairStyle} hair, ${outfit}, ${outfitColorFor(settings)}, ${expression}.`,
    `${accessoryFor(settings)}.`,
    `${framing}, facing directly toward the camera, natural eye contact, mouth fully visible, lips unobstructed.`,
    fullBodyRule,
    "Single adult person only, centered composition, clean studio lighting, realistic skin texture, sharp facial details, natural human proportions.",
    "Neutral premium studio background, no text, no logos, no watermark, no microphone, no hands covering the face, no mask, no extreme side profile.",
    "Optimized source portrait for a professional talking-avatar and lip-sync advertising video.",
  ].filter(Boolean).join(" ");
}

async function submitQueue(input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    if (!response.ok) {
      const error = new Error("avatar_queue_submit_failed");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    if (!requestId) throw new Error("avatar_queue_missing_request_id");
    return {
      model: MODEL,
      requestId,
      statusUrl: clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1800) || `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(requestId)}/status`,
      responseUrl: clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1800) || `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(requestId)}`,
      submittedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
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

    const previousAvatar = project.avatar && typeof project.avatar === "object" ? project.avatar : {};
    if (activeGeneration(previousAvatar)) {
      return sendJson(res, 202, {
        ok: true,
        projectId,
        status: "IN_PROGRESS",
        generation: previousAvatar.imageGeneration,
        avatar: previousAvatar,
        project,
      });
    }

    const country = clean(req.body?.country, 20).toLowerCase();
    if (!COUNTRIES[country]) return sendJson(res, 400, { ok: false, error: "unsupported_avatar_country" });
    const settings = {
      country,
      gender: pick(req.body?.gender, ENUMS.gender, "female"),
      age: pick(req.body?.age, ENUMS.age, "26-35"),
      hairColor: pick(req.body?.hairColor, ENUMS.hairColor, "brown"),
      hairStyle: pick(req.body?.hairStyle, ENUMS.hairStyle, "medium"),
      framing: pick(req.body?.framing, ENUMS.framing, "chest"),
      expression: pick(req.body?.expression, ENUMS.expression, "friendly"),
      outfit: pick(req.body?.outfit, ENUMS.outfit, "business"),
      maleAppearance: pick(req.body?.maleAppearance, ENUMS.maleAppearance, "charismatic"),
      femaleAppearance: pick(req.body?.femaleAppearance, ENUMS.femaleAppearance, "beautiful"),
      outfitColor: pick(req.body?.outfitColor, ENUMS.outfitColor, "scene_harmony"),
      faceAccessory: pick(req.body?.faceAccessory, ENUMS.faceAccessory, "none"),
    };

    if (!falKey()) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const prompt = promptFor(settings);
    const imageSize = settings.framing === "full" ? "portrait_4_3" : "portrait_16_9";
    const job = await submitQueue({
      prompt,
      image_size: imageSize,
      num_images: 1,
      output_format: "jpeg",
      safety_tolerance: "2",
    });
    const now = new Date().toISOString();
    const imageGeneration = {
      version: 1,
      status: "queued",
      stage: "queued",
      startedAt: now,
      updatedAt: now,
      prompt: cleanPrompt(prompt, 3000),
      imageSize,
      settings,
      job,
      error: null,
    };
    const avatar = {
      ...previousAvatar,
      enabled: true,
      mode: "suggest",
      ...settings,
      directorNote: cleanPrompt(previousAvatar.directorNote, 1000),
      sceneDescription: cleanPrompt(previousAvatar.sceneDescription, 1000),
      imageGeneration,
      pipeline: null,
      videoUrl: null,
    };
    const saved = await saveProject(user, { ...project, avatar });

    return sendJson(res, 202, {
      ok: true,
      projectId,
      status: "IN_QUEUE",
      generation: saved.avatar.imageGeneration,
      avatar: saved.avatar,
      project: saved,
    });
  } catch (error) {
    console.error("[ad-film/avatar/create]", error);
    const timeout = error?.name === "AbortError";
    return sendJson(res, Number(error?.status) || (timeout ? 504 : 500), {
      ok: false,
      error: timeout ? "avatar_queue_submit_timeout" : clean(error?.message || error, 300) || "server_error",
    });
  }
}
