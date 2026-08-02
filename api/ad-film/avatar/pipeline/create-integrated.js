// api/ad-film/avatar/pipeline/create-integrated.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { copyUrlToR2 } from "../../../_lib/copy-to-r2.js";
import { buildDirectorPlan } from "../../../_lib/ad-film-director.js";
import { buildAdFilmTimeline } from "../../../_lib/ad-film-timeline.js";
import { putObject } from "../../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const NATIVE_STAGE_MODEL = "fal-ai/flux-2-pro/edit";
const KLING_PRO_I2V = "fal-ai/kling-video/v3/pro/image-to-video";
const KLING_CFG_SCALE = 0.62;
const ACTIVE = [
  "motion_queued",
  "motion_processing",
  "lipsync_queued",
  "lipsync_processing",
  "rendering",
];

function clean(value, max = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}
function parseJson(text) {
  try { return text ? JSON.parse(text) : {}; }
  catch (_) { return { raw: text || "" }; }
}
function even(value) {
  const number = Math.max(2, Math.round(Number(value) || 2));
  return number % 2 === 0 ? number : number - 1;
}
function dimensions(quality, ratio) {
  const height = quality === "4k" ? 2160 : 1080;
  if (ratio === "9:16") return { width: even(height * 9 / 16), height };
  if (ratio === "3:4") return { width: even(height * 3 / 4), height };
  if (ratio === "4:3") return { width: even(height * 4 / 3), height };
  if (ratio === "1:1") return { width: height, height };
  if (ratio === "21:9") return { width: even(height * 21 / 9), height };
  return { width: even(height * 16 / 9), height };
}
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-20000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg_failed:${code}`)));
  });
}
async function downloadBuffer(url, maxBytes = 40 * 1024 * 1024) {
  const response = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`download_failed:${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length || body.length > maxBytes) throw new Error("invalid_download_size");
  return body;
}
function mediaPlan(project) {
  const urls = (project?.generation?.input?.image_urls || project?.generation?.input?.imageUrls || [])
    .filter((url) => /^https:\/\//i.test(clean(url)));
  const map = project?.generation?.input?.reference_map || project?.generation?.input?.referenceMap || {};
  const hero = urls[Math.max(0, Number(map.hero || 1) - 1)] || urls[0] || "";
  const scene = urls[Math.max(0, Number(map.scenes?.[0] || 0) - 1)] || "";
  const angles = (map.angles || []).map((index) => urls[Number(index) - 1]).filter(Boolean).slice(0, 3);
  return { hero, scene, angles, map };
}
function activePipeline(project) {
  const pipeline = project?.avatar?.pipeline;
  if (!pipeline || !ACTIVE.includes(String(pipeline.status))) return false;
  const startedAt = Date.parse(pipeline.startedAt || "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < 55 * 60 * 1000;
}
function filterDirectorNote(value, category) {
  const blocked = {
    fragrance: ["kulaklık", "earbud", "earphone", "airpods", "şarj kutusu", "charging case", "headphone"],
    earbuds: ["parfüm", "perfume", "fragrance bottle", "atomizer"],
    smartphone: ["parfüm", "perfume", "charging case"],
  }[category] || [];
  return clean(
    String(value || "")
      .split(/(?<=[.!?])\s+|\n+/)
      .filter((sentence) => {
        const lower = sentence.toLocaleLowerCase("tr-TR");
        return !blocked.some((term) => lower.includes(term));
      })
      .join(" "),
    700,
  );
}
function buildShots(base, duration) {
  if (duration !== 15 || !Array.isArray(base) || base.length < 4) return base;
  return [
    { ...base[0], id: "shot_1", order: 1, start: 0, end: 2, duration: 2, source: "seedance", role: "hook" },
    { ...base[1], id: "shot_2", order: 2, start: 2, end: 7, duration: 5, source: "avatar", role: "desire" },
    { ...base[2], id: "shot_3", order: 3, start: 7, end: 12, duration: 5, source: "seedance", role: "proof" },
    { ...base[1], id: "shot_4", order: 4, start: 12, end: 14, duration: 2, source: "avatar", role: "closing_line" },
    { ...base[3], id: "shot_5", order: 5, start: 14, end: 15, duration: 1, source: "seedance", role: "memory_lock" },
  ];
}
function countryLabel(value) {
  const labels = {
    tr: "Turkish", us: "American", de: "German", fr: "French", es: "Spanish",
    it: "Italian", br: "Brazilian", arab: "Middle Eastern", ru: "Russian",
    nl: "Dutch", pl: "Polish", ua: "Ukrainian", in: "Indian", id: "Indonesian",
    my: "Malaysian", jp: "Japanese", kr: "Korean", cn: "Chinese", vn: "Vietnamese", th: "Thai",
  };
  return labels[clean(value, 20)] || "international";
}
function framingLabel(value) {
  return {
    shoulders: "shoulders-up",
    chest: "chest-up",
    waist: "waist-up",
    full: "head-to-toe full-body",
  }[clean(value, 20)] || "chest-up";
}
function imageOutputUrl(payload) {
  return clean(
    payload?.images?.[0]?.url ||
    payload?.data?.images?.[0]?.url ||
    payload?.image?.url ||
    payload?.data?.image?.url,
    4000,
  );
}
function nativeStagePrompt({ project, avatar, plan, media }) {
  const profile = plan?.productProfile || {};
  const parts = [
    "Create one single photorealistic final advertising frame, not a collage and not separate layers.",
    "Image 1 is the exact advertising environment. Preserve its architecture, depth, camera perspective, lighting direction, atmosphere and color world.",
    `Image 2 is the exact fictional adult presenter. Preserve the same face identity, ${countryLabel(avatar.country)} appearance, age, skin, hair, body proportions, outfit design and outfit color.`,
    `Place the presenter naturally inside Image 1 in a ${framingLabel(avatar.framing)} commercial composition with the face and lips clearly visible.`,
    "Match the environment's light, color spill, depth of field, perspective, contact shadow and reflections on the presenter so the person looks physically photographed in that location, never pasted, cut out or green-screened.",
    "Image 3 is the exact hero product. Include exactly one product, preserve its silhouette, materials, cap, label position, colors and proportions.",
    profile.scaleInstruction || "Keep the product at realistic handheld scale.",
    "The presenter may hold the product naturally near chest level without covering the face or label, or the product may rest on a nearby surface at realistic scale.",
    media.angles.length ? "Images 4 and later are additional views of the same product and are identity references only, never extra products." : "",
    "Use anatomically correct hands and fingers, natural posture, natural eye contact, relaxed closed lips and a premium commercial expression.",
    clean(avatar.directorNote || avatar.sceneDescription, 700),
    clean(plan?.avatarDirection, 900),
    "Do not add text, subtitles, logos, watermarks, frames, posters, screens or picture-in-picture.",
    "Do not duplicate the presenter or product. Do not change clothing color. Do not enlarge the product. Do not create a second face. Do not crop away requested body parts.",
  ];
  return clean(parts.filter(Boolean).join(" "), 3600);
}
async function generateNativeStage({ project, avatar, plan, media, quality, ratio, user, projectId }) {
  if (!media.scene) throw new Error("scene_reference_required_for_native_avatar");
  const renderQuality = quality === "4k" ? "4k" : "1080p";
  const { width, height } = dimensions(renderQuality, ratio);
  const imageUrls = [media.scene, avatar.image.url, media.hero, ...media.angles].filter(Boolean);
  const prompt = nativeStagePrompt({ project, avatar, plan, media });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 165000);
  let response;
  try {
    response = await fetch(`https://fal.run/${NATIVE_STAGE_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_urls: imageUrls,
        image_size: { width, height },
        output_format: "jpeg",
        safety_tolerance: "2",
        enable_safety_checker: true,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const data = parseJson(await response.text().catch(() => ""));
  if (!response.ok) {
    const error = new Error("native_stage_generation_failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const sourceUrl = imageOutputUrl(data);
  if (!/^https:\/\//i.test(sourceUrl)) {
    const error = new Error("native_stage_output_missing");
    error.data = data;
    throw error;
  }
  const objectKey = `${mediaPrefix(user, projectId)}avatar/pipeline/native-integrated-stage-v12-${Date.now()}.jpg`;
  const url = await copyUrlToR2({ url: sourceUrl, key: objectKey });
  return {
    url,
    width,
    height,
    renderQuality,
    prompt,
    model: NATIVE_STAGE_MODEL,
    referenceCount: imageUrls.length,
  };
}
async function prepareAudioClip(url, segments, user, projectId) {
  if (!url || !segments.length) return "";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-avatar-audio-"));
  const input = path.join(tempDir, "input");
  const output = path.join(tempDir, "output.wav");
  try {
    fs.writeFileSync(input, await downloadBuffer(url, 30 * 1024 * 1024));
    const filters = [];
    const labels = [];
    segments.forEach((segment, index) => {
      filters.push(`[0:a]atrim=start=${segment.start}:duration=${segment.duration},asetpts=PTS-STARTPTS,aresample=48000[a${index}]`);
      labels.push(`[a${index}]`);
    });
    filters.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[aout]`);
    const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
    await runFfmpeg([
      "-y", "-i", input,
      "-filter_complex", filters.join(";"),
      "-map", "[aout]",
      "-t", String(total),
      "-ar", "48000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      output,
    ]);
    const objectKey = `${mediaPrefix(user, projectId)}avatar/pipeline/native-lipsync-v12-${Date.now()}.wav`;
    return await putObject({
      key: objectKey,
      body: fs.readFileSync(output),
      contentType: "audio/wav",
      cacheControl: "public, max-age=31536000, immutable",
    });
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}
async function submitQueue(model, input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    if (!response.ok) {
      const error = new Error("fal_submit_failed");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    if (!requestId) throw new Error("fal_missing_request_id");
    return {
      model,
      requestId,
      statusUrl: clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1600) || `https://queue.fal.run/${model}/requests/${requestId}/status`,
      responseUrl: clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1600) || `https://queue.fal.run/${model}/requests/${requestId}`,
      submittedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
function klingPrompt({ avatar, plan, seconds }) {
  const profile = plan?.productProfile || {};
  return clean([
    `Animate the exact native advertising frame for one continuous ${seconds}-second premium presenter shot.`,
    "@Element1 is the exact presenter identity already visible in the start frame. Preserve the same face, hair, skin, body, outfit and outfit color in every frame.",
    "@Element2 is the exact hero product already visible in the start frame. Preserve its exact design and keep it naturally palm-sized.",
    "The presenter and product must remain physically integrated in the existing environment with matching light, perspective, shadows, reflections and depth of field.",
    "Use a subtle cinematic camera push and natural breathing, blinking, hand and shoulder movement. Keep the presenter continuously visible with no cutaway and no new person.",
    "Keep the face mostly front-facing, eyes open and stable, lips relaxed and mostly closed. Do not simulate speech; a dedicated Turkish lip-sync pass will be applied afterward.",
    "During the first portion, make one restrained product-facing gesture. During the final two seconds, settle into a confident clean hero pose while keeping the product visible.",
    profile.integrityInstruction || "Preserve the exact product identity.",
    profile.forbiddenTransformations || "Do not transform or open the product.",
    clean(avatar.directorNote || avatar.sceneDescription, 500),
  ].filter(Boolean).join(" "), 2450);
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
    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const avatar = project.avatar || {};
    const narration = project?.narration?.audio;
    if (avatar.enabled !== true) return sendJson(res, 200, { ok: true, skipped: true, status: "DISABLED", project });
    if (!avatar.image?.url) return sendJson(res, 409, { ok: false, error: "avatar_image_required" });
    if (project?.narration?.enabled !== false && !(narration?.approved && narration?.url)) {
      return sendJson(res, 409, { ok: false, error: "narration_audio_approval_required" });
    }
    if (activePipeline(project)) return sendJson(res, 200, { ok: true, status: "IN_PROGRESS", pipeline: avatar.pipeline, project });
    if (!falKey()) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const requestedProductionId = clean(req.body?.production_id, 160);
    const acceptedProductionId = clean(
      project?.generation?.productionId || project?.generation?.input?.productionId || project?.productionPlan?.productionId,
      160,
    );
    if (!requestedProductionId || !acceptedProductionId || requestedProductionId !== acceptedProductionId) {
      return sendJson(res, 409, {
        ok: false,
        error: "production_lock_mismatch",
        accepted_production_id: acceptedProductionId || null,
      });
    }

    const durationValue = Number(req.body?.duration || project?.output?.duration);
    const duration = [5, 10, 15].includes(durationValue) ? durationValue : 10;
    const ratioRaw = clean(req.body?.aspect_ratio || project?.output?.aspectRatio, 20) || "16:9";
    const ratio = ratioRaw === "4:5" ? "3:4" : ratioRaw;
    const quality = clean(req.body?.quality || project?.generation?.input?.resolution || project?.output?.quality, 20).toLowerCase() || "1080p";
    const media = mediaPlan(project);
    if (!media.hero) return sendJson(res, 409, { ok: false, error: "product_reference_required" });
    if (!media.scene) return sendJson(res, 409, { ok: false, error: "scene_reference_required_for_native_avatar" });

    const preliminaryPlan = buildDirectorPlan(project, {
      duration,
      aspectRatio: ratio,
      quality,
      avatarEnabled: true,
      productName: project?.brief?.productName,
      brandName: project?.brief?.brandName,
      description: project?.brief?.description,
      creativeDirection: "",
      scenes: project?.creativePlan?.scenes || [],
    });
    const note = filterDirectorNote(
      avatar.directorNote || avatar.sceneDescription || "",
      preliminaryPlan?.productProfile?.category,
    );
    const basePlan = buildDirectorPlan(project, {
      duration,
      aspectRatio: ratio,
      quality,
      avatarEnabled: true,
      productName: project?.brief?.productName,
      brandName: project?.brief?.brandName,
      description: project?.brief?.description,
      creativeDirection: note,
      scenes: project?.creativePlan?.scenes || [],
    });
    const shots = buildShots(basePlan.shots, duration);
    const timeline = buildAdFilmTimeline({ duration, avatarEnabled: true, shots });
    if (!timeline?.avatar || !Array.isArray(timeline.avatarSegments) || !timeline.avatarSegments.length) {
      return sendJson(res, 409, { ok: false, error: "avatar_timeline_missing" });
    }
    const plan = {
      ...basePlan,
      duration,
      aspectRatio: ratio,
      quality,
      productionId: requestedProductionId,
      shots,
      scenes: shots.map((shot) => shot.prompt),
      timeline,
    };

    const stage = await generateNativeStage({
      project,
      avatar: { ...avatar, directorNote: note },
      plan,
      media,
      quality,
      ratio,
      user,
      projectId,
    });

    const segments = timeline.avatarSegments.map((segment) => ({
      start: segment.start,
      duration: segment.duration,
      role: segment.role,
    }));
    const seconds = timeline.avatar.duration;
    const avatarAudioUrl = narration?.url
      ? await prepareAudioClip(narration.url, segments, user, projectId)
      : "";
    const prompt = klingPrompt({ avatar: { ...avatar, directorNote: note }, plan, seconds });
    const elements = [
      { frontal_image_url: avatar.image.url, reference_image_urls: [] },
      { frontal_image_url: media.hero, reference_image_urls: media.angles },
    ];
    const motion = await submitQueue(KLING_PRO_I2V, {
      start_image_url: stage.url,
      prompt,
      duration: String(seconds),
      generate_audio: false,
      elements,
      shot_type: "customize",
      cfg_scale: KLING_CFG_SCALE,
      negative_prompt: [
        "collage, separate layers, pasted cutout, green screen look, floating person, sliding subject, mismatched lighting, missing contact shadow, wrong perspective",
        "identity drift, different face, second face, extra people, duplicate person, deformed eyes, closed eyes, exaggerated mouth, random speech, warped hands, extra fingers, duplicate limbs",
        "oversized product, giant product, duplicate product, wrong product, altered label, changed bottle shape, opening or splitting product body",
        "presenter leaving frame, presenter disappearing, face occlusion, face too small, abrupt cutaway, internal scene cut, frozen frame, static photograph",
        "text, subtitles, generated logo, watermark, poster, screen, picture-in-picture, low quality, blur, abrupt camera shake",
      ].join(", "),
    });

    const now = new Date().toISOString();
    const pipeline = {
      version: 12,
      productionId: requestedProductionId,
      compositeMode: "hybrid-timeline",
      status: "motion_queued",
      stage: "motion",
      startedAt: now,
      productionStartedAt: project?.generation?.startedAt || now,
      updatedAt: now,
      duration,
      clipDuration: seconds,
      timelineStart: timeline.avatar.start,
      timelineEnd: timeline.avatar.end,
      speechWindow: timeline.speech,
      speechWindows: timeline.speechSegments,
      timeline,
      aspectRatio: ratio,
      quality,
      stageRenderQuality: stage.renderQuality,
      targetWidth: stage.width,
      targetHeight: stage.height,
      sourceAvatarImageUrl: avatar.image.url,
      transparentAvatarImageUrl: null,
      sourceProductImageUrl: media.hero,
      transparentProductImageUrl: null,
      sourceSceneImageUrl: media.scene,
      productReferenceUrls: media.angles,
      referenceMap: media.map,
      stageImageUrl: stage.url,
      stageImageMode: "native-generated-scene",
      stageLayout: null,
      stageProductMode: "native-single-product",
      stageIntegration: "generative-native-scene",
      stageGeneration: {
        provider: "fal",
        model: stage.model,
        prompt: stage.prompt,
        referenceCount: stage.referenceCount,
        completedAt: now,
      },
      backgroundRemovalUsed: false,
      identityLocked: true,
      clothingColorLocked: true,
      productGenerationDisabled: false,
      directTalkingAvatar: false,
      directAvatarAudioUrl: null,
      lipsyncAudioUrl: avatarAudioUrl || null,
      lipsyncMode: avatarAudioUrl ? "video-to-video-after-kling" : "disabled",
      lipsyncSegments: segments,
      narrationSourceUrl: narration?.url || null,
      directorPlanVersion: plan.version,
      productProfile: plan.productProfile,
      filteredDirectorNote: Boolean((avatar.directorNote || avatar.sceneDescription) && note !== clean(avatar.directorNote || avatar.sceneDescription, 700)),
      generateAudio: false,
      prompt,
      cfgScale: KLING_CFG_SCALE,
      motionElements: elements,
      motion: {
        ...motion,
        provider: "fal",
        inputMode: "native-integrated-scene-kling-pro",
        fallbackLevel: 0,
        videoUrl: null,
        error: null,
      },
      error: null,
    };
    const jobs = {
      ...(project.productionJobs || {}),
      avatar: {
        provider: "fal",
        model: KLING_PRO_I2V,
        requestId: motion.requestId,
        productionId: requestedProductionId,
        status: "queued",
        appearances: segments.length,
        stageModel: NATIVE_STAGE_MODEL,
        updatedAt: now,
      },
    };
    const nextProject = await saveProject(user, {
      ...project,
      status: "processing",
      productionPlan: plan,
      productionJobs: jobs,
      generation: {
        ...(project.generation || {}),
        status: "processing",
        avatarWaiting: true,
        awaitingFinalComposite: true,
        finalizing: false,
        sourceOnly: true,
        updatedAt: now,
        error: null,
      },
      avatar: { ...avatar, pipeline, videoUrl: null },
    });

    return sendJson(res, 202, {
      ok: true,
      projectId,
      status: "IN_QUEUE",
      director_plan: plan,
      timeline,
      pipeline,
      project: nextProject,
    });
  } catch (error) {
    console.error("[ad-film/avatar/pipeline/create-integrated]", error, error?.data || "");
    return sendJson(res, Number(error?.status) || 500, {
      ok: false,
      error: clean(error?.message || error, 1200),
      detail: error?.data || null,
    });
  }
}
