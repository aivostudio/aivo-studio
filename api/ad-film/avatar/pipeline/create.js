// api/ad-film/avatar/pipeline/create.js
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

const KLING_PRO_I2V = "fal-ai/kling-video/v3/pro/image-to-video";
const KLING_MOTION = "fal-ai/kling-video/v3/pro/motion-control";

function clean(value, max = 4000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function parseJson(text) { try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text || "" }; } }
function safePart(value, fallback = "avatar") {
  const next = clean(value, 180).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return next || fallback;
}
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg_failed:${code}`)));
  });
}
async function downloadBuffer(url, maxBytes = 25 * 1024 * 1024) {
  const response = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`download_failed:${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length || body.length > maxBytes) throw new Error("invalid_download_size");
  return body;
}
function normalizeDuration(value) {
  const duration = Number.parseInt(value, 10);
  if (!Number.isFinite(duration)) return 15;
  return Math.max(4, Math.min(15, duration));
}
function normalizeRatio(value) {
  const ratio = clean(value, 20);
  return ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"].includes(ratio) ? ratio : "16:9";
}
function dimensions(ratio) {
  if (ratio === "21:9") return { width: 1344, height: 576 };
  if (ratio === "9:16") return { width: 720, height: 1280 };
  if (ratio === "3:4") return { width: 768, height: 1024 };
  if (ratio === "4:3") return { width: 1024, height: 768 };
  if (ratio === "1:1") return { width: 1024, height: 1024 };
  return { width: 1280, height: 720 };
}
function introDelayMs(duration, hasMusic) {
  if (!hasMusic) return 0;
  if (duration >= 12) return 1400;
  if (duration >= 8) return 1000;
  return 650;
}
function activePipeline(project) {
  const pipeline = project?.avatar?.pipeline;
  if (!pipeline || !["motion_queued", "motion_processing", "lipsync_queued", "lipsync_processing"].includes(String(pipeline.status))) return false;
  const started = Date.parse(pipeline.startedAt || "");
  return Number.isFinite(started) && Date.now() - started < 45 * 60 * 1000;
}
function countryLabel(value) {
  const map = { tr:"Turkish", us:"American", de:"German", fr:"French", es:"Spanish", it:"Italian", br:"Brazilian", arab:"Middle Eastern", ru:"Russian", nl:"Dutch", pl:"Polish", ua:"Ukrainian", in:"Indian", id:"Indonesian", my:"Malaysian", jp:"Japanese", kr:"Korean", cn:"Chinese", vn:"Vietnamese", th:"Thai" };
  return map[value] || "international";
}
function buildPrompt(project, duration) {
  const avatar = project?.avatar || {};
  const framing = avatar.framing === "full" ? "full-body" : avatar.framing === "waist" ? "waist-up" : avatar.framing === "shoulders" ? "shoulders-up" : "chest-up";
  const expression = avatar.expression === "energetic" ? "energetic and charismatic" : avatar.expression === "calm" ? "calm and composed" : avatar.expression === "confident" ? "confident and trustworthy" : "friendly and confident";
  const creative = clean(project?.plan?.creativeDirection || project?.creativeDirection || project?.brief?.description || "", 900);
  const product = clean(project?.brief?.productName || project?.product?.name || "the advertised product", 180);
  return [
    `Create a ${duration}-second premium cinematic commercial performance featuring exactly the same ${countryLabel(avatar.country)} adult person from the reference image.`,
    `Preserve facial identity, body proportions, hairstyle, clothing, skin tone and all distinctive details consistently. Use a ${framing} composition while keeping the face large and unobstructed enough for professional lip sync.`,
    `The performer is ${expression}, looks naturally toward camera, breathes, blinks and uses controlled realistic body language. Begin with a strong fashion-commercial entrance, take one or two deliberate steps toward camera, then settle into a confident presenter stance with subtle hand gestures.`,
    `Use sophisticated Matrix-inspired advertising cinematography without copying any protected character: elegant low-angle tracking, slow push-in, restrained orbit, premium contrast, realistic fabric and hair motion, polished studio lighting, shallow depth of field and smooth continuous movement.`,
    `No speech, no generated audio, no text, no subtitles, no logos, no extra people, no face distortion, no duplicate limbs, no exaggerated dance and no abrupt camera shake. Leave visual room for ${product}.`,
    creative ? `Director context: ${creative}.` : "",
  ].filter(Boolean).join(" ").slice(0, 2400);
}
async function prepareStageImage({ sourceUrl, ratio, user, projectId }) {
  const source = await downloadBuffer(sourceUrl, 25 * 1024 * 1024);
  const { width, height } = dimensions(ratio);
  const background = await sharp(source)
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" })
    .blur(28)
    .modulate({ brightness: 0.48, saturation: 0.82 })
    .jpeg({ quality: 88 })
    .toBuffer();
  const foreground = await sharp(source)
    .rotate()
    .resize(Math.round(width * 0.78), Math.round(height * 0.94), {
      fit: "contain",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const stage = await sharp(background)
    .composite([
      { input: Buffer.from(`<svg width="${width}" height="${height}"><defs><radialGradient id="g"><stop offset="0" stop-color="#34205d" stop-opacity="0.45"/><stop offset="1" stop-color="#050817" stop-opacity="0.06"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`) },
      { input: foreground, gravity: "center" },
    ])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const key = `${mediaPrefix(user, projectId)}avatar/pipeline/stage-${Date.now()}.jpg`;
  return putObject({ key, body: stage, contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable", contentDisposition: "inline" });
}
async function prepareTimedNarration({ sourceUrl, duration, delayMs, user, projectId }) {
  if (!sourceUrl) return "";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-avatar-audio-"));
  const input = path.join(tmpDir, "voice-input");
  const output = path.join(tmpDir, "voice-timed.wav");
  try {
    fs.writeFileSync(input, await downloadBuffer(sourceUrl, 30 * 1024 * 1024));
    const filter = delayMs > 0 ? `adelay=${delayMs}|${delayMs},apad=pad_dur=60` : "apad=pad_dur=60";
    await runFfmpeg(["-y", "-i", input, "-af", filter, "-t", String(duration), "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output]);
    const key = `${mediaPrefix(user, projectId)}avatar/pipeline/narration-${Date.now()}.wav`;
    return await putObject({ key, body: fs.readFileSync(output), contentType: "audio/wav", cacheControl: "public, max-age=31536000, immutable", contentDisposition: "inline" });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
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
    if (!response.ok) { const error = new Error("fal_submit_failed"); error.status = response.status; error.data = data; throw error; }
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    if (!requestId) throw new Error("fal_missing_request_id");
    return {
      model,
      requestId,
      statusUrl: clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1600) || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/status`,
      responseUrl: clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1600) || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}`,
      submittedAt: new Date().toISOString(),
    };
  } finally { clearTimeout(timeout); }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return sendJson(res, 405, { ok:false, error:"method_not_allowed" }); }
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok:false, error:"unauthorized" });
    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok:false, error:"missing_project_id" });
    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok:false, error:"project_not_found" });
    const avatar = project.avatar || {};
    if (avatar.enabled !== true) return sendJson(res, 200, { ok:true, skipped:true, status:"DISABLED", project });
    if (!avatar.image?.url) return sendJson(res, 409, { ok:false, error:"avatar_image_required" });
    const narration = project?.narration?.audio;
    if (project?.narration?.enabled !== false && !(narration?.approved === true && /^https:\/\//i.test(clean(narration.url)))) {
      return sendJson(res, 409, { ok:false, error:"narration_audio_approval_required" });
    }
    if (activePipeline(project)) return sendJson(res, 200, { ok:true, projectId, status:"IN_PROGRESS", pipeline:avatar.pipeline, project });
    const key = falKey();
    if (!key) return sendJson(res, 500, { ok:false, error:"missing_fal_key" });

    const duration = normalizeDuration(req.body?.duration || project?.output?.duration || project?.generation?.input?.duration);
    const ratio = normalizeRatio(req.body?.aspect_ratio || project?.output?.aspectRatio || project?.generation?.input?.aspectRatio);
    const hasMusic = (project?.music?.mode || "auto") !== "off";
    const delayMs = introDelayMs(duration, hasMusic && project?.narration?.enabled !== false);
    const stageImageUrl = await prepareStageImage({ sourceUrl:avatar.image.url, ratio, user, projectId });
    const lipsyncAudioUrl = narration?.url ? await prepareTimedNarration({ sourceUrl:narration.url, duration, delayMs, user, projectId }) : "";
    const prompt = buildPrompt(project, duration);
    const driverVideoUrl = clean(avatar.motionTemplateUrl || process.env.AIVO_AVATAR_MOTION_TEMPLATE_URL, 4000);
    const motionInput = driverVideoUrl
      ? { image_url:stageImageUrl, video_url:driverVideoUrl, character_orientation:"video", keep_original_sound:false, prompt }
      : { start_image_url:stageImageUrl, prompt, duration:String(duration), generate_audio:false, negative_prompt:"identity drift, deformed face, extra people, duplicate limbs, warped hands, text, logo, watermark, abrupt motion, low quality" };
    const motionJob = await submitQueue(driverVideoUrl ? KLING_MOTION : KLING_PRO_I2V, motionInput);
    const now = new Date().toISOString();
    const pipeline = {
      version:1,
      status:"motion_queued",
      stage:"motion",
      startedAt:now,
      updatedAt:now,
      duration,
      aspectRatio:ratio,
      introDelayMs:delayMs,
      stageImageUrl,
      lipsyncAudioUrl,
      prompt,
      driverVideoUrl:driverVideoUrl || null,
      motion:{ ...motionJob, provider:"fal", inputMode:driverVideoUrl ? "motion-control" : "image-to-video", fallbackLevel:0, videoUrl:null, error:null },
      lipsync:null,
      videoUrl:null,
      error:null,
    };
    const nextProject = await saveProject(user, { ...project, avatar:{ ...avatar, pipeline, videoUrl:null } });
    return sendJson(res, 202, { ok:true, projectId, status:"IN_QUEUE", pipeline, project:nextProject });
  } catch (error) {
    console.error("[ad-film/avatar/pipeline/create]", error);
    return sendJson(res, Number(error?.status) || 500, { ok:false, error:clean(error?.message || error, 300), fal_response:error?.data || null });
  }
}
