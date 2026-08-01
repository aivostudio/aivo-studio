// api/ad-film/avatar/pipeline/create-native.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { buildDirectorPlan, composeAvatarPrompt } from "../../../_lib/ad-film-director.js";
import { buildAdFilmTimeline } from "../../../_lib/ad-film-timeline.js";
import { putObject } from "../../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const IMAGE_REMBG = "fal-ai/imageutils/rembg";
const KLING_PRO_I2V = "fal-ai/kling-video/v3/pro/image-to-video";
const MAX_PROMPT_CHARS = 2480;
const KLING_CFG_SCALE = 0.68;
const ACTIVE_PIPELINE = [
  "motion_queued",
  "motion_processing",
  "lipsync_queued",
  "lipsync_processing",
  "rendering",
];

function clean(value, max = 4000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function parseJson(text) { try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw:text || "" }; } }
function even(value) {
  const number = Math.max(2, Math.round(Number(value) || 2));
  return number % 2 === 0 ? number : number - 1;
}
function normalizeProjectDuration(value) {
  const duration = Number.parseInt(value, 10);
  if (!Number.isFinite(duration)) return 15;
  return duration === 15 ? 15 : 10;
}
function normalizeRatio(value) {
  const ratio = clean(value, 20);
  return ["21:9","16:9","4:3","1:1","3:4","9:16"].includes(ratio) ? ratio : "16:9";
}
function normalizeQuality(value) {
  const quality = clean(value, 20).toLowerCase();
  return ["480p","720p","1080p","4k"].includes(quality) ? quality : "1080p";
}
function dimensions(quality, ratio) {
  const height = quality === "4k" ? 2160 : quality === "1080p" ? 1080 : quality === "720p" ? 720 : 480;
  if (ratio === "21:9") return { width:even(height * 21 / 9), height };
  if (ratio === "9:16") return { width:even(height * 9 / 16), height };
  if (ratio === "3:4") return { width:even(height * 3 / 4), height };
  if (ratio === "4:3") return { width:even(height * 4 / 3), height };
  if (ratio === "1:1") return { width:height, height };
  return { width:even(height * 16 / 9), height };
}
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio:["ignore","ignore","pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg_failed:${code}`)));
  });
}
async function downloadBuffer(url, maxBytes = 35 * 1024 * 1024) {
  const response = await fetch(url, { method:"GET", cache:"no-store", redirect:"follow" });
  if (!response.ok) throw new Error(`download_failed:${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length || body.length > maxBytes) throw new Error("invalid_download_size");
  return body;
}
function activePipeline(project) {
  const pipeline = project?.avatar?.pipeline;
  if (!pipeline || !ACTIVE_PIPELINE.includes(String(pipeline.status))) return false;
  const started = Date.parse(pipeline.startedAt || "");
  return Number.isFinite(started) && Date.now() - started < 45 * 60 * 1000;
}
function countryLabel(value) {
  const map = { tr:"Turkish", us:"American", de:"German", fr:"French", es:"Spanish", it:"Italian", br:"Brazilian", arab:"Middle Eastern", ru:"Russian", nl:"Dutch", pl:"Polish", ua:"Ukrainian", in:"Indian", id:"Indonesian", my:"Malaysian", jp:"Japanese", kr:"Korean", cn:"Chinese", vn:"Vietnamese", th:"Thai" };
  return map[value] || "international";
}
function mediaUrls(project) {
  const generationUrls = project?.generation?.input?.image_urls || project?.generation?.input?.imageUrls;
  if (Array.isArray(generationUrls) && generationUrls.length) {
    return generationUrls.filter((url) => /^https:\/\//i.test(clean(url, 4000))).slice(0, 9);
  }
  const items = Array.isArray(project?.media?.productImages) ? project.media.productImages : [];
  return items.map((item) => clean(item?.url, 4000)).filter((url) => /^https:\/\//i.test(url)).slice(0, 9);
}
function mediaPlan(project) {
  const urls = mediaUrls(project);
  const map = project?.generation?.input?.reference_map || project?.generation?.input?.referenceMap || project?.generation?.referenceMap || null;
  let heroIndex = 0;
  let sceneIndex = -1;
  let angleIndexes = urls.length > 1 ? [1,2,3].filter((index) => index < urls.length) : [];
  if (map && typeof map === "object") {
    if (Number(map.hero) > 0) heroIndex = Number(map.hero) - 1;
    if (Array.isArray(map.scenes) && Number(map.scenes[0]) > 0) sceneIndex = Number(map.scenes[0]) - 1;
    if (Array.isArray(map.angles)) {
      angleIndexes = map.angles.map((index) => Number(index) - 1).filter((index) => index >= 0 && index < urls.length);
    }
  }
  const heroUrl = urls[heroIndex] || urls[0] || "";
  const sceneUrl = sceneIndex >= 0 ? (urls[sceneIndex] || "") : "";
  const angleUrls = angleIndexes.map((index) => urls[index]).filter(Boolean).filter((url) => url !== heroUrl && url !== sceneUrl).slice(0, 3);
  return { urls, heroUrl, sceneUrl, angleUrls, referenceMap:map };
}
function expressionLabel(avatar) {
  if (avatar.expression === "energetic") return "energetic and charismatic";
  if (avatar.expression === "calm") return "calm and composed";
  if (avatar.expression === "confident") return "confident and trustworthy";
  return "friendly and confident";
}
async function removeBackground(sourceUrl, kind) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`https://fal.run/${IMAGE_REMBG}`, {
      method:"POST",
      headers:{ Authorization:`Key ${falKey()}`, "Content-Type":"application/json", Accept:"application/json" },
      body:JSON.stringify({ image_url:sourceUrl, sync_mode:false, crop_to_bbox:false }),
      signal:controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    if (!response.ok) {
      const error = new Error(`${kind || "image"}_background_removal_failed`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    const url = clean(data?.image?.url || data?.data?.image?.url || data?.result?.image?.url, 4000);
    if (!/^https:\/\//i.test(url)) throw new Error(`${kind || "image"}_background_removal_missing_output`);
    return url;
  } finally { clearTimeout(timeout); }
}
function layoutForProfile(profile, ratio, width, height) {
  const portrait = ratio === "9:16" || ratio === "3:4";
  const scaleClass = clean(profile?.scaleClass, 80);
  if (scaleClass === "full_size_vehicle") {
    return portrait
      ? { avatar:{ width:Math.round(width*.43),height:Math.round(height*.48),left:Math.round(width*.03),top:Math.round(height*.47) }, product:{ width:Math.round(width*.86),height:Math.round(height*.48),left:Math.round(width*.10),top:Math.round(height*.17) } }
      : { avatar:{ width:Math.round(width*.29),height:Math.round(height*.72),left:Math.round(width*.03),top:Math.round(height*.22) }, product:{ width:Math.round(width*.72),height:Math.round(height*.62),left:Math.round(width*.25),top:Math.round(height*.30) } };
  }
  if (["floor_standing","human_environment"].includes(scaleClass)) {
    return portrait
      ? { avatar:{ width:Math.round(width*.48),height:Math.round(height*.55),left:Math.round(width*.02),top:Math.round(height*.41) }, product:{ width:Math.round(width*.72),height:Math.round(height*.65),left:Math.round(width*.28),top:Math.round(height*.25) } }
      : { avatar:{ width:Math.round(width*.34),height:Math.round(height*.80),left:Math.round(width*.04),top:Math.round(height*.16) }, product:{ width:Math.round(width*.60),height:Math.round(height*.72),left:Math.round(width*.38),top:Math.round(height*.18) } };
  }
  if (["small_handheld","body_worn_small"].includes(scaleClass)) {
    return portrait
      ? { avatar:{ width:Math.round(width*.78),height:Math.round(height*.72),left:Math.round(width*.11),top:Math.round(height*.25) }, product:{ width:Math.round(width*.23),height:Math.round(height*.18),left:Math.round(width*.57),top:Math.round(height*.58) } }
      : { avatar:{ width:Math.round(width*.46),height:Math.round(height*.86),left:Math.round(width*.05),top:Math.round(height*.11) }, product:{ width:Math.round(width*.20),height:Math.round(height*.22),left:Math.round(width*.60),top:Math.round(height*.56) } };
  }
  if (scaleClass === "body_worn") {
    return portrait
      ? { avatar:{ width:Math.round(width*.72),height:Math.round(height*.70),left:Math.round(width*.14),top:Math.round(height*.27) }, product:{ width:Math.round(width*.34),height:Math.round(height*.24),left:Math.round(width*.49),top:Math.round(height*.68) } }
      : { avatar:{ width:Math.round(width*.43),height:Math.round(height*.84),left:Math.round(width*.06),top:Math.round(height*.13) }, product:{ width:Math.round(width*.30),height:Math.round(height*.28),left:Math.round(width*.59),top:Math.round(height*.62) } };
  }
  return portrait
    ? { avatar:{ width:Math.round(width*.74),height:Math.round(height*.68),left:Math.round(width*.13),top:Math.round(height*.30) }, product:{ width:Math.round(width*.46),height:Math.round(height*.31),left:Math.round(width*.32),top:Math.round(height*.49) } }
    : { avatar:{ width:Math.round(width*.42),height:Math.round(height*.84),left:Math.round(width*.06),top:Math.round(height*.13) }, product:{ width:Math.round(width*.36),height:Math.round(height*.38),left:Math.round(width*.57),top:Math.round(height*.47) } };
}
async function prepareStageImage({ sceneUrl, avatarUrl, productUrl, profile, quality, ratio, user, projectId }) {
  const { width, height } = dimensions(quality, ratio);
  let background;
  if (sceneUrl) {
    background = await sharp(await downloadBuffer(sceneUrl)).rotate().resize(width, height, { fit:"cover", position:"center" }).modulate({ brightness:0.96, saturation:0.96 }).toBuffer();
  } else {
    background = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="r" cx="72%" cy="54%" r="62%"><stop offset="0" stop-color="#20284a"/><stop offset="0.45" stop-color="#12162d"/><stop offset="1" stop-color="#070914"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#r)"/></svg>`);
  }
  const layout = layoutForProfile(profile, ratio, width, height);
  const avatarBox = layout.avatar;
  const productBox = layout.product;
  const avatarBuffer = await sharp(await downloadBuffer(avatarUrl)).rotate().ensureAlpha().resize(avatarBox.width, avatarBox.height, { fit:"contain", position:"bottom", background:{ r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
  const productBuffer = await sharp(await downloadBuffer(productUrl)).rotate().ensureAlpha().resize(productBox.width, productBox.height, { fit:"contain", position:"center", background:{ r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
  const avatarShadow = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${avatarBox.left + Math.round(avatarBox.width*.50)}" cy="${Math.round(height*.95)}" rx="${Math.round(avatarBox.width*.30)}" ry="${Math.max(8,Math.round(height*.018))}" fill="rgba(0,0,0,0.42)" filter="blur(10px)"/></svg>`);
  const productShadow = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${productBox.left + Math.round(productBox.width*.50)}" cy="${productBox.top + Math.round(productBox.height*.90)}" rx="${Math.round(productBox.width*.28)}" ry="${Math.max(7,Math.round(height*.014))}" fill="rgba(0,0,0,0.36)" filter="blur(9px)"/></svg>`);
  const stage = await sharp(background).resize(width, height, { fit:"cover" }).composite([
    { input:avatarShadow, left:0, top:0 },
    { input:productShadow, left:0, top:0 },
    { input:productBuffer, left:productBox.left, top:productBox.top },
    { input:avatarBuffer, left:avatarBox.left, top:avatarBox.top },
  ]).jpeg({ quality:95, chromaSubsampling:"4:4:4" }).toBuffer();
  const key = `${mediaPrefix(user, projectId)}avatar/pipeline/native-stage-${quality}-${Date.now()}.jpg`;
  const url = await putObject({ key, body:stage, contentType:"image/jpeg", cacheControl:"public, max-age=31536000, immutable", contentDisposition:"inline" });
  return { url, width, height, layout };
}
async function prepareTimedNarration({ sourceUrl, duration, leadMs, user, projectId }) {
  if (!sourceUrl) return "";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-avatar-native-audio-"));
  const input = path.join(tmpDir, "voice-input");
  const output = path.join(tmpDir, "voice-timed.wav");
  try {
    fs.writeFileSync(input, await downloadBuffer(sourceUrl, 30 * 1024 * 1024));
    const delay = Math.max(0, Number.parseInt(leadMs, 10) || 0);
    const filter = `aresample=48000,adelay=${delay}|${delay},apad=pad_dur=${duration+1},atrim=0:${duration}`;
    await runFfmpeg(["-y","-i",input,"-af",filter,"-t",String(duration),"-ar","48000","-ac","1","-c:a","pcm_s16le",output]);
    const key = `${mediaPrefix(user, projectId)}avatar/pipeline/native-narration-${Date.now()}.wav`;
    return await putObject({ key, body:fs.readFileSync(output), contentType:"audio/wav", cacheControl:"public, max-age=31536000, immutable", contentDisposition:"inline" });
  } finally {
    try { fs.rmSync(tmpDir, { recursive:true, force:true }); } catch (_) {}
  }
}
async function submitQueue(model, input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method:"POST",
      headers:{ Authorization:`Key ${falKey()}`, "Content-Type":"application/json", Accept:"application/json" },
      body:JSON.stringify(input),
      signal:controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    if (!response.ok) { const error = new Error("fal_submit_failed"); error.status=response.status; error.data=data; throw error; }
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    if (!requestId) throw new Error("fal_missing_request_id");
    return {
      model,
      requestId,
      statusUrl:clean(data?.status_url || data?.statusUrl || data?.urls?.status,1600) || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/status`,
      responseUrl:clean(data?.response_url || data?.responseUrl || data?.urls?.response,1600) || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}`,
      submittedAt:new Date().toISOString(),
    };
  } finally { clearTimeout(timeout); }
}

export default async function handler(req,res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow","POST"); return sendJson(res,405,{ok:false,error:"method_not_allowed"}); }
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res,401,{ok:false,error:"unauthorized"});
    const projectId = clean(req.body?.projectId,120);
    if (!projectId) return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project = await getOwnedProject(user,projectId);
    if (!project) return sendJson(res,404,{ok:false,error:"project_not_found"});
    const avatar = project.avatar || {};
    if (avatar.enabled !== true) return sendJson(res,200,{ok:true,skipped:true,status:"DISABLED",project});
    if (!avatar.image?.url) return sendJson(res,409,{ok:false,error:"avatar_image_required"});
    const narration = project?.narration?.audio;
    if (project?.narration?.enabled !== false && !(narration?.approved === true && /^https:\/\//i.test(clean(narration.url)))) {
      return sendJson(res,409,{ok:false,error:"narration_audio_approval_required"});
    }
    if (activePipeline(project)) return sendJson(res,200,{ok:true,projectId,status:"IN_PROGRESS",pipeline:avatar.pipeline,project});
    if (!falKey()) return sendJson(res,500,{ok:false,error:"missing_fal_key"});

    const duration = normalizeProjectDuration(req.body?.duration || project?.output?.duration || project?.generation?.input?.duration);
    const ratio = normalizeRatio(req.body?.aspect_ratio || project?.output?.aspectRatio || project?.generation?.input?.aspectRatio);
    const quality = normalizeQuality(req.body?.quality || project?.generation?.input?.resolution || project?.output?.quality);
    const media = mediaPlan(project);
    if (!media.heroUrl) return sendJson(res,409,{ok:false,error:"product_reference_required"});

    const basePlan = project?.productionPlan?.version >= 2 ? project.productionPlan : buildDirectorPlan(project, {
      duration,
      aspectRatio:ratio,
      quality,
      avatarEnabled:true,
      productName:project?.brief?.productName,
      brandName:project?.brief?.brandName,
      description:project?.brief?.description,
      creativeDirection:avatar.directorNote || avatar.sceneDescription || "",
      scenes:project?.productionPlan?.scenes || [],
    });
    const timeline = buildAdFilmTimeline({ duration, avatarEnabled:true, shots:basePlan.shots });
    if (!timeline.avatar) return sendJson(res,409,{ok:false,error:"avatar_timeline_missing"});
    const directorPlan = { ...basePlan, duration, aspectRatio:ratio, quality, timeline };
    const avatarDuration = timeline.avatar.duration;
    const speechLeadMs = Math.max(0, Math.round((timeline.speech?.clipStart || 0) * 1000));
    const clipPlan = { ...directorPlan, duration:avatarDuration };

    const transparentAvatarUrl = await removeBackground(avatar.image.url, "avatar");
    const transparentProductUrl = await removeBackground(media.heroUrl, "product");
    const stage = await prepareStageImage({ sceneUrl:media.sceneUrl, avatarUrl:transparentAvatarUrl, productUrl:transparentProductUrl, profile:directorPlan.productProfile, quality, ratio, user, projectId });
    const lipsyncAudioUrl = narration?.url ? await prepareTimedNarration({ sourceUrl:narration.url, duration:avatarDuration, leadMs:speechLeadMs, user, projectId }) : "";
    const prompt = composeAvatarPrompt({ project, plan:clipPlan, countryLabel:countryLabel(avatar.country), expression:expressionLabel(avatar), maxChars:MAX_PROMPT_CHARS });
    const elements = [
      { frontal_image_url:avatar.image.url, reference_image_urls:[transparentAvatarUrl] },
      { frontal_image_url:media.heroUrl, reference_image_urls:media.angleUrls },
    ];
    const motionInput = {
      start_image_url:stage.url,
      prompt,
      duration:String(avatarDuration),
      generate_audio:false,
      elements,
      shot_type:"customize",
      cfg_scale:KLING_CFG_SCALE,
      negative_prompt:"flat product photo, product picture on screen, billboard, poster, floating rectangle, picture-in-picture, video wall, display panel, oversized product, toy-sized product, wrong real-world scale, floating person, sliding subject, pasted cutout, green screen look, mismatched lighting, missing contact shadow, wrong perspective, identity drift, deformed face, extra people, duplicate limbs, warped hands, fake product, different product, text, subtitles, logo, watermark, abrupt camera shake, low quality",
    };
    const motionJob = await submitQueue(KLING_PRO_I2V,motionInput);
    const now = new Date().toISOString();
    const pipeline = {
      version:7,
      compositeMode:"hybrid-timeline",
      status:"motion_queued",
      stage:"motion",
      startedAt:now,
      updatedAt:now,
      duration,
      clipDuration:avatarDuration,
      timelineStart:timeline.avatar.start,
      timelineEnd:timeline.avatar.end,
      speechWindow:timeline.speech,
      timeline,
      aspectRatio:ratio,
      quality,
      targetWidth:stage.width,
      targetHeight:stage.height,
      sourceAvatarImageUrl:avatar.image.url,
      transparentAvatarImageUrl:transparentAvatarUrl,
      sourceProductImageUrl:media.heroUrl,
      transparentProductImageUrl:transparentProductUrl,
      sourceSceneImageUrl:media.sceneUrl || null,
      productReferenceUrls:media.angleUrls,
      referenceMap:media.referenceMap,
      stageImageUrl:stage.url,
      stageLayout:stage.layout,
      stageBackground:media.sceneUrl ? "project-scene" : "generated-neutral-stage",
      stageProductMode:"transparent-physical-object",
      lipsyncAudioUrl,
      prompt,
      promptLength:prompt.length,
      directorPlanVersion:directorPlan.version,
      productProfile:directorPlan.productProfile,
      cfgScale:KLING_CFG_SCALE,
      generateAudio:false,
      directorNoteOnly:false,
      motion:{ ...motionJob, provider:"fal", inputMode:"native-scene-image-to-video", fallbackLevel:0, videoUrl:null, error:null },
      error:null,
    };
    const productionJobs = {
      ...(project.productionJobs || {}),
      avatar:{ provider:"fal", model:KLING_PRO_I2V, requestId:motionJob.requestId, status:"queued", timelineStart:timeline.avatar.start, timelineEnd:timeline.avatar.end, updatedAt:now },
    };
    const nextProject = await saveProject(user,{ ...project, productionPlan:directorPlan, productionJobs, avatar:{...avatar,pipeline,videoUrl:null} });
    return sendJson(res,202,{ok:true,projectId,status:"IN_QUEUE",director_plan:directorPlan,timeline,pipeline,project:nextProject});
  } catch(error) {
    console.error("[ad-film/avatar/pipeline/create-native]",error,error?.data||"");
    return sendJson(res,Number(error?.status)||500,{ok:false,error:clean(error?.message||error,1200),detail:error?.data||null});
  }
}
