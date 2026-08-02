// api/ad-film/avatar/pipeline/create-integrated.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
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

const REMBG = "fal-ai/imageutils/rembg";
const TALKING_AVATAR = "fal-ai/sync-lipsync/v3/image-to-video";
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
  return Number.isFinite(startedAt) && Date.now() - startedAt < 45 * 60 * 1000;
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
async function removeBackground(url, label) {
  const response = await fetch(`https://fal.run/${REMBG}`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: url, sync_mode: false, crop_to_bbox: false }),
  });
  const data = parseJson(await response.text());
  if (!response.ok) throw new Error(`${label}_background_removal_failed`);
  const output = clean(data?.image?.url || data?.data?.image?.url || data?.result?.image?.url);
  if (!/^https:\/\//i.test(output)) throw new Error(`${label}_background_missing`);
  return output;
}
function layoutBoxes(ratio, width, height) {
  const portrait = ratio === "9:16" || ratio === "3:4";
  return {
    avatar: portrait
      ? { width: Math.round(width * 0.86), height: Math.round(height * 0.86), left: Math.round(width * 0.06), top: Math.round(height * 0.11) }
      : { width: Math.round(width * 0.46), height: Math.round(height * 0.88), left: Math.round(width * 0.07), top: Math.round(height * 0.08) },
    product: portrait
      ? { width: Math.round(width * 0.20), height: Math.round(height * 0.21), left: Math.round(width * 0.72), top: Math.round(height * 0.70) }
      : { width: Math.round(width * 0.12), height: Math.round(height * 0.24), left: Math.round(width * 0.80), top: Math.round(height * 0.68) },
  };
}
async function prepareStage({ sceneUrl, avatarPngUrl, productPngUrl, avatar, quality, ratio, user, projectId }) {
  const renderQuality = quality === "4k" ? "4k" : "1080p";
  const { width, height } = dimensions(renderQuality, ratio);
  const boxes = layoutBoxes(ratio, width, height);

  const background = sceneUrl
    ? await sharp(await downloadBuffer(sceneUrl))
        .rotate()
        .resize(width, height, { fit: "cover", position: "center" })
        .modulate({ brightness: 0.96, saturation: 0.97 })
        .blur(0.35)
        .toBuffer()
    : Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="70%" cy="45%" r="80%"><stop offset="0" stop-color="#25203c"/><stop offset="1" stop-color="#090815"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);

  const avatarSource = await sharp(await downloadBuffer(avatarPngUrl))
    .rotate()
    .ensureAlpha()
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });
  let avatarImage = sharp(avatarSource.data);
  if (["full", "waist"].includes(clean(avatar?.framing, 20))) {
    const visibleRatio = avatar.framing === "full" ? 0.62 : 0.80;
    avatarImage = avatarImage.extract({
      left: 0,
      top: 0,
      width: avatarSource.info.width,
      height: Math.max(2, Math.round(avatarSource.info.height * visibleRatio)),
    });
  }
  const avatarBuffer = await avatarImage
    .resize(boxes.avatar.width, boxes.avatar.height, {
      fit: "contain",
      position: "bottom",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const productBuffer = await sharp(await downloadBuffer(productPngUrl))
    .rotate()
    .ensureAlpha()
    .trim()
    .resize(boxes.product.width, boxes.product.height, {
      fit: "contain",
      position: "bottom",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const shadows = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="blur"><feGaussianBlur stdDeviation="18"/></filter></defs><ellipse cx="${boxes.avatar.left + boxes.avatar.width * 0.5}" cy="${height * 0.96}" rx="${boxes.avatar.width * 0.24}" ry="${height * 0.016}" fill="rgba(35,18,18,.30)" filter="url(#blur)"/><ellipse cx="${boxes.product.left + boxes.product.width * 0.5}" cy="${boxes.product.top + boxes.product.height}" rx="${boxes.product.width * 0.30}" ry="${height * 0.010}" fill="rgba(35,18,18,.32)" filter="url(#blur)"/></svg>`);

  const composed = await sharp(background)
    .composite([
      { input: shadows, left: 0, top: 0 },
      { input: avatarBuffer, left: boxes.avatar.left, top: boxes.avatar.top },
      { input: productBuffer, left: boxes.product.left, top: boxes.product.top },
    ])
    .modulate({ brightness: 0.985, saturation: 0.985 })
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4" })
    .toBuffer();

  const objectKey = `${mediaPrefix(user, projectId)}avatar/pipeline/identity-locked-stage-${renderQuality}-${Date.now()}.jpg`;
  const url = await putObject({
    key: objectKey,
    body: composed,
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000, immutable",
  });
  return { url, width, height, renderQuality, layout: boxes };
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
    const objectKey = `${mediaPrefix(user, projectId)}avatar/pipeline/identity-locked-audio-${Date.now()}.wav`;
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
async function prepareSilence(seconds, user, projectId) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-avatar-silence-"));
  const output = path.join(tempDir, "silence.wav");
  try {
    await runFfmpeg([
      "-y",
      "-f", "lavfi",
      "-i", "anullsrc=r=48000:cl=mono",
      "-t", String(seconds),
      "-c:a", "pcm_s16le",
      output,
    ]);
    const objectKey = `${mediaPrefix(user, projectId)}avatar/pipeline/silence-${Date.now()}.wav`;
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
  const response = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = parseJson(await response.text());
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
    statusUrl: clean(data?.status_url || data?.urls?.status) || `https://queue.fal.run/${model}/requests/${requestId}/status`,
    responseUrl: clean(data?.response_url || data?.urls?.response) || `https://queue.fal.run/${model}/requests/${requestId}`,
    submittedAt: new Date().toISOString(),
  };
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
    const ratio = clean(req.body?.aspect_ratio || project?.output?.aspectRatio, 20) || "16:9";
    const quality = clean(req.body?.quality || project?.generation?.input?.resolution || project?.output?.quality, 20).toLowerCase() || "1080p";
    const media = mediaPlan(project);
    if (!media.hero) return sendJson(res, 409, { ok: false, error: "product_reference_required" });

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

    const [avatarPngUrl, productPngUrl] = await Promise.all([
      removeBackground(avatar.image.url, "avatar"),
      removeBackground(media.hero, "product"),
    ]);
    const plate = await prepareStage({
      sceneUrl: media.scene,
      avatarPngUrl,
      productPngUrl,
      avatar,
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
      : await prepareSilence(seconds, user, projectId);

    const motion = await submitQueue(TALKING_AVATAR, {
      image_url: plate.url,
      audio_url: avatarAudioUrl,
    });

    const now = new Date().toISOString();
    const pipeline = {
      version: 11,
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
      stageRenderQuality: plate.renderQuality,
      targetWidth: plate.width,
      targetHeight: plate.height,
      sourceAvatarImageUrl: avatar.image.url,
      transparentAvatarImageUrl: avatarPngUrl,
      sourceProductImageUrl: media.hero,
      transparentProductImageUrl: productPngUrl,
      sourceSceneImageUrl: media.scene || null,
      productReferenceUrls: [],
      referenceMap: media.map,
      stageImageUrl: plate.url,
      stageLayout: plate.layout,
      stageProductMode: "single-locked-product-plate",
      stageIntegration: "identity-and-color-locked",
      identityLocked: true,
      clothingColorLocked: true,
      productGenerationDisabled: true,
      directTalkingAvatar: true,
      directAvatarAudioUrl: avatarAudioUrl,
      lipsyncAudioUrl: null,
      lipsyncMode: "direct-image-to-video",
      lipsyncSegments: segments,
      narrationSourceUrl: narration?.url || null,
      directorPlanVersion: plan.version,
      productProfile: plan.productProfile,
      filteredDirectorNote: Boolean((avatar.directorNote || avatar.sceneDescription) && note !== clean(avatar.directorNote || avatar.sceneDescription, 700)),
      generateAudio: false,
      motion: {
        ...motion,
        provider: "fal",
        inputMode: "single-image-audio-avatar",
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
        model: TALKING_AVATAR,
        requestId: motion.requestId,
        productionId: requestedProductionId,
        status: "queued",
        appearances: segments.length,
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
