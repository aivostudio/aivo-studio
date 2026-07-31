// api/ad-film/avatar/pipeline/create-native.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
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
const MAX_USER_FIELD_CHARS = 1000;
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
function normalizeDuration(value) {
  const duration = Number.parseInt(value, 10);
  if (!Number.isFinite(duration)) return 15;
  return Math.max(4, Math.min(15, duration));
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
function clipText(value, max) {
  const source = clean(value, Math.max(max, 1));
  if (source.length <= max) return source;
  let clipped = source.slice(0, max).trim();
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf("; "),
    clipped.lastIndexOf(", ")
  );
  if (boundary >= Math.floor(max * 0.72)) clipped = clipped.slice(0, boundary + 1).trim();
  return clipped;
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
  if (Array.isArray(generationUrls) && generationUrls.length) return generationUrls.filter((url) => /^https:\/\//i.test(clean(url, 4000))).slice(0, 9);
  const items = Array.isArray(project?.media?.productImages) ? project.media.productImages : [];
  return items.map((item) => clean(item?.url, 4000)).filter((url) => /^https:\/\//i.test(url)).slice(0, 9);
}
function mediaPlan(project) {
  const urls = mediaUrls(project);
  const map = project?.generation?.input?.reference_map || project?.generation?.input?.referenceMap || null;
  let heroIndex = 0;
  let sceneIndex = urls.length > 3 ? urls.length - 1 : Math.max(0, urls.length - 1);
  let angleIndexes = urls.length > 1 ? [1,2,3].filter((index) => index < urls.length) : [];
  if (map && typeof map === "object") {
    if (Number(map.hero) > 0) heroIndex = Number(map.hero) - 1;
    if (Array.isArray(map.scenes) && Number(map.scenes[0]) > 0) sceneIndex = Number(map.scenes[0]) - 1;
    if (Array.isArray(map.angles)) angleIndexes = map.angles.map((index) => Number(index) - 1).filter((index) => index >= 0 && index < urls.length);
  }
  const heroUrl = urls[heroIndex] || urls[0] || "";
  const sceneUrl = urls[sceneIndex] || heroUrl;
  const angleUrls = angleIndexes.map((index) => urls[index]).filter(Boolean).filter((url) => url !== sceneUrl).slice(0, 3);
  return { urls, heroUrl, sceneUrl, angleUrls };
}
function buildPrompt(project, duration, plan) {
  const avatar = project?.avatar || {};
  const directorRaw = clean(avatar.directorNote, MAX_USER_FIELD_CHARS);
  const expression = avatar.expression === "energetic" ? "energetic and charismatic" : avatar.expression === "calm" ? "calm and composed" : avatar.expression === "confident" ? "confident and trustworthy" : "friendly and confident";
  const productName = clean(project?.brief?.productName, 120) || "the featured product";
  const prefix = `Create one photorealistic premium commercial shot lasting ${duration} seconds. @Element1 is the exact ${countryLabel(avatar.country)} adult presenter and @Element2 is the exact ${productName}. Preserve both identities, proportions, materials, face, clothing and product design. The presenter is ${expression} and performs naturally beside the product.`;
  const integration = "The presenter, product, floor and set must exist inside one coherent three-dimensional scene. Match perspective, scale, floor contact, cast shadows, reflections, color temperature, depth of field, occlusion and camera parallax. Camera movement and subject movement must share the same world coordinates. Never make the presenter slide, float, drift over the background, stand in front of a screen, look pasted on, or behave like a transparent overlay. Keep feet grounded and body weight physically believable.";
  const performance = "Use controlled professional gestures, natural body motion and clear face visibility for later lip sync. Let the presenter approach, indicate or carefully hold the real product only when physically plausible. Do not invent a different product, oversized duplicate product, extra person, text, subtitle, logo or watermark. No generated speech or audio.";
  const labelLength = " Director instructions: . ".length;
  const userBudget = Math.max(0, MAX_PROMPT_CHARS - prefix.length - integration.length - performance.length - labelLength - 8);
  const director = clipText(directorRaw, userBudget);
  const parts = [prefix, integration];
  if (director) parts.push(`Director instructions: ${director}.`);
  parts.push(performance);
  return parts.join(" ").slice(0, MAX_PROMPT_CHARS);
}
async function removeBackground(sourceUrl) {
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
      const error = new Error("background_removal_failed");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    const url = clean(data?.image?.url || data?.data?.image?.url || data?.result?.image?.url, 4000);
    if (!/^https:\/\//i.test(url)) throw new Error("background_removal_missing_output");
    return url;
  } finally {
    clearTimeout(timeout);
  }
}
async function prepareStageImage({ sceneUrl, avatarUrl, productUrl, quality, ratio, user, projectId }) {
  const { width, height } = dimensions(quality, ratio);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-avatar-native-stage-"));
  try {
    let background;
    if (sceneUrl) {
      background = await sharp(await downloadBuffer(sceneUrl))
        .rotate()
        .resize(width, height, { fit:"cover", position:"center" })
        .modulate({ brightness:0.96, saturation:0.96 })
        .toBuffer();
    } else {
      background = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1021"/><stop offset="0.55" stop-color="#17142c"/><stop offset="1" stop-color="#070914"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    }

    const portrait = ratio === "9:16" || ratio === "3:4";
    const avatarBox = portrait
      ? { width:Math.round(width * 0.72), height:Math.round(height * 0.62), left:Math.round(width * 0.14), top:Math.round(height * 0.34) }
      : { width:Math.round(width * 0.40), height:Math.round(height * 0.82), left:Math.round(width * 0.07), top:Math.round(height * 0.14) };
    const productBox = portrait
      ? { width:Math.round(width * 0.62), height:Math.round(height * 0.34), left:Math.round(width * 0.19), top:Math.round(height * 0.04) }
      : { width:Math.round(width * 0.46), height:Math.round(height * 0.54), left:Math.round(width * 0.50), top:Math.round(height * 0.32) };

    const composites = [];
    const avatarBuffer = await sharp(await downloadBuffer(avatarUrl))
      .rotate().ensureAlpha()
      .resize(avatarBox.width, avatarBox.height, { fit:"contain", position:"bottom", background:{ r:0,g:0,b:0,alpha:0 } })
      .png().toBuffer();
    const avatarShadow = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${avatarBox.left + Math.round(avatarBox.width * 0.50)}" cy="${Math.round(height * 0.95)}" rx="${Math.round(avatarBox.width * 0.30)}" ry="${Math.max(8,Math.round(height * 0.018))}" fill="rgba(0,0,0,0.40)" filter="blur(10px)"/></svg>`);
    composites.push({ input:avatarShadow, left:0, top:0 });

    if (productUrl) {
      try {
        const productBuffer = await sharp(await downloadBuffer(productUrl))
          .rotate().ensureAlpha()
          .resize(productBox.width, productBox.height, { fit:"contain", position:"center", background:{ r:0,g:0,b:0,alpha:0 } })
          .png().toBuffer();
        const productShadow = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${productBox.left + Math.round(productBox.width * 0.50)}" cy="${productBox.top + Math.round(productBox.height * 0.91)}" rx="${Math.round(productBox.width * 0.30)}" ry="${Math.max(7,Math.round(height * 0.015))}" fill="rgba(0,0,0,0.34)" filter="blur(9px)"/></svg>`);
        composites.push({ input:productShadow, left:0, top:0 });
        composites.push({ input:productBuffer, left:productBox.left, top:productBox.top });
      } catch (_) {}
    }
    composites.push({ input:avatarBuffer, left:avatarBox.left, top:avatarBox.top });

    const stage = await sharp(background)
      .resize(width, height, { fit:"cover" })
      .composite(composites)
      .jpeg({ quality:95, chromaSubsampling:"4:4:4" })
      .toBuffer();
    const key = `${mediaPrefix(user, projectId)}avatar/pipeline/native-stage-${quality}-${Date.now()}.jpg`;
    const url = await putObject({ key, body:stage, contentType:"image/jpeg", cacheControl:"public, max-age=31536000, immutable", contentDisposition:"inline" });
    return { url, width, height };
  } finally {
    try { fs.rmSync(tmpDir, { recursive:true, force:true }); } catch (_) {}
  }
}
async function prepareTimedNarration({ sourceUrl, duration, delayMs, user, projectId }) {
  if (!sourceUrl) return "";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-avatar-native-audio-"));
  const input = path.join(tmpDir, "voice-input");
  const output = path.join(tmpDir, "voice-timed.wav");
  try {
    fs.writeFileSync(input, await downloadBuffer(sourceUrl, 30 * 1024 * 1024));
    const filter = delayMs > 0 ? `adelay=${delayMs}|${delayMs},apad=pad_dur=60` : "apad=pad_dur=60";
    await runFfmpeg(["-y","-i",input,"-af",filter,"-t",String(duration),"-ar","48000","-ac","1","-c:a","pcm_s16le",output]);
    const key = `${mediaPrefix(user, projectId)}avatar/pipeline/native-narration-${Date.now()}.wav`;
    return await putObject({ key, body:fs.readFileSync(output), contentType:"audio/wav", cacheControl:"public, max-age=31536000, immutable", contentDisposition:"inline" });
  } finally {
    try { fs.rmSync(tmpDir, { recursive:true, force:true }); } catch (_) {}
  }
}
function introDelayMs(duration, hasMusic) {
  if (!hasMusic) return 0;
  if (duration >= 12) return 1400;
  if (duration >= 8) return 1000;
  return 650;
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

    const duration = normalizeDuration(req.body?.duration || project?.output?.duration || project?.generation?.input?.duration);
    const ratio = normalizeRatio(req.body?.aspect_ratio || project?.output?.aspectRatio || project?.generation?.input?.aspectRatio);
    const quality = normalizeQuality(req.body?.quality || project?.generation?.input?.resolution || project?.output?.quality);
    const hasMusic = (project?.music?.mode || "auto") !== "off";
    const delayMs = introDelayMs(duration, hasMusic && project?.narration?.enabled !== false);
    const plan = mediaPlan(project);

    const transparentAvatarUrl = await removeBackground(avatar.image.url);
    let transparentProductUrl = "";
    if (plan.heroUrl) {
      try { transparentProductUrl = await removeBackground(plan.heroUrl); } catch (_) { transparentProductUrl = plan.heroUrl; }
    }
    const stage = await prepareStageImage({
      sceneUrl:plan.sceneUrl,
      avatarUrl:transparentAvatarUrl,
      productUrl:transparentProductUrl,
      quality,
      ratio,
      user,
      projectId,
    });
    const lipsyncAudioUrl = narration?.url ? await prepareTimedNarration({ sourceUrl:narration.url, duration, delayMs, user, projectId }) : "";
    const prompt = buildPrompt(project,duration,plan);
    const elements = [
      { frontal_image_url:avatar.image.url, reference_image_urls:[transparentAvatarUrl] },
    ];
    if (plan.heroUrl) elements.push({ frontal_image_url:plan.heroUrl, reference_image_urls:plan.angleUrls });
    const motionInput = {
      start_image_url:stage.url,
      prompt,
      duration:String(duration),
      generate_audio:false,
      elements,
      shot_type:"customize",
      cfg_scale:KLING_CFG_SCALE,
      negative_prompt:"floating person, sliding subject, pasted cutout, green screen look, presenter in front of a screen, mismatched lighting, missing contact shadow, wrong perspective, identity drift, deformed face, extra people, duplicate limbs, warped hands, fake product, different product, text, subtitles, logo, watermark, abrupt camera shake, low quality",
    };
    const motionJob = await submitQueue(KLING_PRO_I2V,motionInput);
    const now = new Date().toISOString();
    const pipeline = {
      version:5,
      compositeMode:"native-scene",
      status:"motion_queued",
      stage:"motion",
      startedAt:now,
      updatedAt:now,
      duration,
      aspectRatio:ratio,
      quality,
      targetWidth:stage.width,
      targetHeight:stage.height,
      introDelayMs:delayMs,
      sourceAvatarImageUrl:avatar.image.url,
      transparentAvatarImageUrl:transparentAvatarUrl,
      sourceProductImageUrl:plan.heroUrl || null,
      sourceSceneImageUrl:plan.sceneUrl || null,
      productReferenceUrls:plan.angleUrls,
      stageImageUrl:stage.url,
      stageBackground:"project-scene",
      lipsyncAudioUrl,
      prompt,
      promptLength:prompt.length,
      cfgScale:KLING_CFG_SCALE,
      generateAudio:false,
      directorNoteOnly:true,
      motion:{ ...motionJob, provider:"fal", inputMode:"native-scene-image-to-video", fallbackLevel:0, videoUrl:null, error:null },
      error:null,
    };
    const nextProject = await saveProject(user,{...project,avatar:{...avatar,pipeline,videoUrl:null}});
    return sendJson(res,202,{ok:true,projectId,status:"IN_QUEUE",pipeline,project:nextProject});
  } catch(error) {
    console.error("[ad-film/avatar/pipeline/create-native]",error,error?.data||"");
    return sendJson(res,Number(error?.status)||500,{ok:false,error:clean(error?.message||error,1200),detail:error?.data||null});
  }
}
