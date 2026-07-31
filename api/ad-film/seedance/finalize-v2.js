// api/ad-film/seedance/finalize-v2.js
export const config = { runtime: "nodejs" };
export const maxDuration = 300;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { putObject } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MIX_VERSION = 10;
const DOWNLOAD_TIMEOUT_MS = 70000;
const FFMPEG_TIMEOUT_MS = 215000;
const UPLOAD_TIMEOUT_MS = 65000;
const PROCESSING_TTL_MS = 5 * 60 * 1000;

function clean(value, max = 1600) {
  return String(value ?? "").trim().slice(0, max);
}

function safePart(value, fallback = "output") {
  const next = clean(value, 180)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function even(value) {
  const number = Math.max(2, Math.round(Number(value) || 2));
  return number % 2 === 0 ? number : number - 1;
}

function dimensions(resolution, ratio) {
  const value = clean(resolution, 20).toLowerCase();
  const height = value === "4k" ? 2160 : value === "1080p" ? 1080 : value === "720p" ? 720 : 480;
  const aspect = clean(ratio, 20) || "16:9";
  if (aspect === "9:16") return { width: even(height * 9 / 16), height };
  if (aspect === "1:1") return { width: height, height };
  if (aspect === "4:5") return { width: even(height * 4 / 5), height };
  if (aspect === "3:4") return { width: even(height * 3 / 4), height };
  return { width: even(height * 16 / 9), height };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("ffmpeg_timeout"));
    }, FFMPEG_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 24000) stderr = stderr.slice(-24000);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg_failed:${code}`));
    });
  });
}

async function download(url, destination, maxBytes = 180 * 1024 * 1024) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`download_failed:${response.status}`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > maxBytes) throw new Error("invalid_download_size");

    let received = 0;
    const meter = new TransformStream({
      transform(chunk, writer) {
        received += chunk.byteLength || chunk.length || 0;
        if (received > maxBytes) throw new Error("invalid_download_size");
        writer.enqueue(chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body.pipeThrough(meter)),
      fs.createWriteStream(destination),
    );
    if (received <= 0) throw new Error("invalid_download_size");
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("download_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function outputsOf(project) {
  return Array.isArray(project?.outputs)
    ? project.outputs.filter((item) => item && item.videoUrl).slice(0, 30)
    : [];
}

function generationTarget(project) {
  const generation = project?.generation || {};
  const id = clean(generation.outputId || generation.requestId, 240);
  const source = clean(generation.sourceVideoUrl || generation.videoUrl, 4000);
  if (!id || !source) return null;
  return {
    id,
    requestId: generation.requestId || null,
    version: Number.parseInt(generation.version, 10) || 1,
    sourceVideoUrl: source,
    videoUrl: source,
    createdAt: generation.startedAt || project.updatedAt,
    completedAt: generation.completedAt || project.updatedAt,
    seed: generation.seed ?? null,
    duration: generation.input?.duration || project?.output?.duration || "15",
    aspectRatio: generation.input?.aspectRatio || project?.output?.aspectRatio || "16:9",
    resolution: generation.input?.resolution || project?.output?.quality || "480p",
  };
}

function targetOf(project, requestedOutputId) {
  const outputs = outputsOf(project);
  const generated = generationTarget(project);
  if (generated && clean(generated.id) === clean(requestedOutputId)) return { target: generated, outputs };
  const target =
    outputs.find((item) => clean(item.id) === clean(requestedOutputId)) ||
    outputs.find((item) => clean(item.id) === clean(project?.activeOutputId)) ||
    generated ||
    outputs[0] ||
    null;
  return { target, outputs };
}

function logoWidth(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 300;
  if (value === "1080p") return 178;
  if (value === "720p") return 128;
  return 90;
}

function logoMargin(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 72;
  if (value === "1080p") return 40;
  if (value === "720p") return 28;
  return 20;
}

function isNearBlack(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 42 && max - min <= 20;
}

async function prepareTransparentLogo(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * channels;
    if (!isNearBlack(data[offset], data[offset + 1], data[offset + 2])) return;
    visited[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
  for (let index = 0; index < visited.length; index += 1) {
    if (visited[index]) data[index * channels + 3] = 0;
  }
  await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

function durationSeconds(target, project) {
  const value = Number.parseFloat(
    target?.duration || project?.generation?.input?.duration || project?.output?.duration || 15,
  );
  return Number.isFinite(value) ? Math.max(4, Math.min(20, value)) : 15;
}

function introDelayMs(duration) {
  if (duration >= 12) return 1400;
  if (duration >= 8) return 1000;
  return 650;
}

function avatarWindows(duration) {
  if (duration <= 6) return [[Math.min(0.7, duration * 0.15), Math.max(1.8, duration - 1.0)]];
  if (duration <= 10) return [[1.0, Math.min(4.2, duration * 0.48)], [Math.min(6.0, duration * 0.64), Math.max(6.8, duration - 1.0)]];
  return [[1.2, Math.min(5.2, duration * 0.38)], [Math.min(8.4, duration * 0.62), Math.min(duration - 1.2, 12.7)]];
}

function avatarEnableExpression(duration) {
  return avatarWindows(duration)
    .filter((pair) => pair[1] > pair[0])
    .map((pair) => `between(t,${pair[0].toFixed(2)},${pair[1].toFixed(2)})`)
    .join("+") || "0";
}

function musicUrlOf(project) {
  const mode = project?.music?.mode || "auto";
  if (mode === "off") return "";
  if (mode === "upload") return clean(project?.media?.musicTrack?.url, 4000);
  return clean(project?.music?.audio?.url, 4000);
}

function finalizationOf(project) {
  return project?.generation?.finalization || null;
}

function isRecentProcessing(finalization, outputId) {
  if (!finalization || finalization.status !== "processing") return false;
  if (clean(finalization.outputId) !== clean(outputId)) return false;
  const started = Date.parse(finalization.startedAt || "");
  return Number.isFinite(started) && Date.now() - started < PROCESSING_TTL_MS;
}

export default async function handler(req, res) {
  const cleanup = [];
  let sourceVideoUrl = "";
  let user = null;
  let project = null;
  let projectId = "";
  let outputId = "";

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    projectId = clean(req.body?.projectId, 120);
    const requestedOutputId = clean(req.body?.outputId, 240);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const picked = targetOf(project, requestedOutputId);
    const target = picked.target;
    const outputs = picked.outputs;
    outputId = clean(target?.id || project?.generation?.outputId || project?.generation?.requestId, 240);
    sourceVideoUrl = clean(target?.sourceVideoUrl || target?.videoUrl || project?.generation?.sourceVideoUrl || project?.generation?.videoUrl, 4000);
    if (!sourceVideoUrl || !outputId) return sendJson(res, 409, { ok: false, error: "missing_source_video" });

    if (isRecentProcessing(finalizationOf(project), outputId)) {
      return sendJson(res, 202, { ok: false, error: "finalization_processing", projectId, outputId });
    }

    const logoUrl = clean(project?.media?.logo?.url || target?.logoUrl || project?.generation?.logoUrl, 4000);
    const narrationEnabled = project?.narration?.enabled !== false;
    const narrationAudio = project?.narration?.audio;
    const narrationUrl = narrationEnabled && narrationAudio?.approved === true ? clean(narrationAudio.url, 4000) : "";
    const musicUrl = musicUrlOf(project);
    const musicRequired = (project?.music?.mode || "auto") !== "off";

    const avatarEnabled = project?.avatar?.enabled === true;
    const avatarPipeline = project?.avatar?.pipeline || null;
    const avatarRequested = avatarEnabled && Boolean(avatarPipeline);
    const avatarUrl = avatarRequested
      ? clean(avatarPipeline?.transparentVideoUrl || (Number(avatarPipeline?.version || 0) >= 4 ? avatarPipeline?.videoUrl : ""), 4000)
      : "";

    if (narrationEnabled && !narrationUrl) return sendJson(res, 409, { ok: false, error: "narration_audio_approval_required" });
    if (musicRequired && !musicUrl) return sendJson(res, 409, { ok: false, error: "music_audio_required" });
    if (avatarRequested && (!avatarUrl || avatarPipeline?.status !== "completed")) {
      return sendJson(res, 425, { ok: false, error: "avatar_video_processing", avatar_status: avatarPipeline?.status || "processing" });
    }

    const logoSatisfied = !logoUrl || target?.logoApplied === true;
    const narrationSatisfied = !narrationEnabled || target?.narrationApplied === true;
    const musicSatisfied = !musicRequired || target?.musicApplied === true;
    const avatarSatisfied = !avatarRequested || (target?.avatarApplied === true && target?.avatarTransparent === true);
    const mixSatisfied = Number(target?.mixVersion || 0) >= MIX_VERSION;
    if (target?.videoUrl && logoSatisfied && narrationSatisfied && musicSatisfied && avatarSatisfied && mixSatisfied) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        outputId: target.id,
        video_url: target.videoUrl,
        logo_applied: Boolean(logoUrl),
        narration_applied: Boolean(narrationUrl),
        music_applied: Boolean(musicUrl),
        avatar_applied: Boolean(avatarUrl),
        avatar_transparent: Boolean(avatarUrl),
        mix_version: target.mixVersion,
        project,
      });
    }

    const startedAt = new Date().toISOString();
    project = await saveProject(user, {
      ...project,
      status: "processing",
      generation: {
        ...(project.generation || {}),
        status: "finalizing",
        sourceVideoUrl,
        finalization: { status: "processing", outputId, startedAt, error: null },
      },
    });

    const resolution = target?.resolution || project?.generation?.input?.resolution || project?.output?.quality || "480p";
    const ratio = target?.aspectRatio || project?.generation?.input?.aspectRatio || project?.output?.aspectRatio || "16:9";
    const size = dimensions(resolution, ratio);
    const width = logoWidth(resolution);
    const margin = logoMargin(resolution);
    const version = Number.parseInt(target?.version || project?.generation?.version, 10) || 1;
    const duration = durationSeconds(target, project);
    const voiceDelay = narrationUrl && musicUrl ? introDelayMs(duration) : 0;
    const fadeOutStart = Math.max(0.5, duration - 0.8).toFixed(2);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-adfilm-final-v2-"));
    const inputVideo = path.join(tmpDir, "source.mp4");
    const avatarVideo = path.join(tmpDir, "avatar.webm");
    const originalLogo = path.join(tmpDir, "logo-original");
    const transparentLogo = path.join(tmpDir, "logo-transparent.png");
    const narrationFile = path.join(tmpDir, "narration-audio");
    const musicFile = path.join(tmpDir, "music-audio");
    const outputVideo = path.join(tmpDir, "final.mp4");
    cleanup.push(outputVideo, musicFile, narrationFile, transparentLogo, originalLogo, avatarVideo, inputVideo, tmpDir);

    const jobs = [download(sourceVideoUrl, inputVideo)];
    if (avatarUrl) jobs.push(download(avatarUrl, avatarVideo));
    if (logoUrl) jobs.push(download(logoUrl, originalLogo, 20 * 1024 * 1024));
    if (narrationUrl) jobs.push(download(narrationUrl, narrationFile, 30 * 1024 * 1024));
    if (musicUrl) jobs.push(download(musicUrl, musicFile, 80 * 1024 * 1024));
    await Promise.all(jobs);
    if (logoUrl) await prepareTransparentLogo(originalLogo, transparentLogo);

    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", inputVideo];
    let nextIndex = 1;
    let avatarIndex = -1;
    let logoIndex = -1;
    let narrationIndex = -1;
    let musicIndex = -1;

    if (avatarUrl) {
      avatarIndex = nextIndex++;
      args.push("-i", avatarVideo);
    }
    if (logoUrl) {
      logoIndex = nextIndex++;
      args.push("-loop", "1", "-framerate", "30", "-i", transparentLogo);
    }
    if (narrationUrl) {
      narrationIndex = nextIndex++;
      args.push("-i", narrationFile);
    }
    if (musicUrl) {
      musicIndex = nextIndex++;
      args.push("-stream_loop", "-1", "-i", musicFile);
    }

    const filters = [];
    filters.push(`[0:v]scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,setpts=PTS-STARTPTS[base]`);
    let videoLabel = "base";

    if (avatarUrl) {
      filters.push(`[${avatarIndex}:v]format=rgba,scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba,setsar=1,fps=30,setpts=PTS-STARTPTS[avatar]`);
      filters.push(`[base][avatar]overlay=0:0:format=auto:enable='${avatarEnableExpression(duration)}':eof_action=pass:shortest=0[hybrid]`);
      videoLabel = "hybrid";
    }

    if (logoUrl) {
      filters.push(`[${logoIndex}:v]scale=${width}:-1:flags=fast_bilinear,format=rgba,colorchannelmixer=aa=0.96[logo]`);
      filters.push(`[${videoLabel}][logo]overlay=W-w-${margin}:H-h-${margin}:format=auto:eof_action=pass:shortest=0[vout]`);
      videoLabel = "vout";
    }

    if (narrationUrl && musicUrl) {
      filters.push(`[${narrationIndex}:a]aresample=48000,volume=1.05,adelay=${voiceDelay}|${voiceDelay},apad=pad_dur=${duration + 1}[voice]`);
      filters.push(`[${musicIndex}:a]aresample=48000,volume=0.34,afade=t=in:st=0:d=0.18,afade=t=out:st=${fadeOutStart}:d=0.8,apad=pad_dur=${duration + 1}[music]`);
      filters.push("[music][voice]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.985[aout]");
    } else if (narrationUrl) {
      filters.push(`[${narrationIndex}:a]aresample=48000,volume=1.05,apad=pad_dur=${duration + 1},alimiter=limit=0.985[aout]`);
    } else if (musicUrl) {
      filters.push(`[${musicIndex}:a]aresample=48000,volume=0.72,afade=t=in:st=0:d=0.18,afade=t=out:st=${fadeOutStart}:d=0.8,apad=pad_dur=${duration + 1},alimiter=limit=0.985[aout]`);
    }

    args.push("-filter_complex", filters.join(";"));
    args.push("-map", `[${videoLabel}]`);
    if (narrationUrl || musicUrl) args.push("-map", "[aout]");
    else args.push("-map", "0:a:0?");
    args.push(
      "-t", String(duration),
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", resolution === "4k" ? "24" : "21",
      "-pix_fmt", "yuv420p",
      "-threads", "2",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-ac", "2",
      "-max_muxing_queue_size", "2048",
      "-movflags", "+faststart",
      outputVideo,
    );
    await runFfmpeg(args);

    const key = `${mediaPrefix(user, projectId)}outputs/seedance/${safePart(outputId, "video")}-v${version}-final-v2-${Date.now()}.mp4`;
    const uploadController = new AbortController();
    const uploadTimer = setTimeout(() => uploadController.abort(), UPLOAD_TIMEOUT_MS);
    let finalUrl;
    try {
      const stat = fs.statSync(outputVideo);
      finalUrl = await putObject({
        key,
        body: fs.createReadStream(outputVideo),
        contentLength: stat.size,
        abortSignal: uploadController.signal,
        contentType: "video/mp4",
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("r2_upload_timeout");
      throw error;
    } finally {
      clearTimeout(uploadTimer);
    }

    const now = new Date().toISOString();
    const finalOutput = {
      ...(target || {}),
      id: outputId,
      version,
      sourceVideoUrl,
      videoUrl: finalUrl,
      logoUrl: logoUrl || null,
      logoApplied: Boolean(logoUrl),
      logoPosition: logoUrl ? "bottom-right" : null,
      logoOpacity: logoUrl ? 0.96 : null,
      narrationUrl: narrationUrl || null,
      narrationApplied: Boolean(narrationUrl),
      narrationMastered: narrationAudio?.mastered === true,
      narrationApprovedAt: narrationAudio?.approvedAt || null,
      narrationDelayMs: voiceDelay,
      musicUrl: musicUrl || null,
      musicApplied: Boolean(musicUrl),
      musicMode: project?.music?.mode || "auto",
      musicBedVolume: narrationUrl && musicUrl ? 0.34 : 0.72,
      avatarUrl: avatarUrl || null,
      avatarApplied: Boolean(avatarUrl),
      avatarTransparent: Boolean(avatarUrl),
      avatarMattingModel: avatarUrl ? clean(avatarPipeline?.matting?.model, 200) || null : null,
      avatarWindows: avatarUrl ? avatarWindows(duration) : [],
      avatarPipelineVersion: avatarUrl ? Number(avatarPipeline?.version || 1) : null,
      audioCodec: "aac",
      audioBitrate: "192k",
      mixVersion: MIX_VERSION,
      finalizedAt: now,
      completedAt: now,
    };

    const nextOutputs = [finalOutput, ...outputs.filter((item) => clean(item.id) !== clean(finalOutput.id))].slice(0, 30);
    const nextProject = await saveProject(user, {
      ...project,
      status: "completed",
      outputs: nextOutputs,
      activeOutputId: finalOutput.id,
      generation: {
        ...(project.generation || {}),
        status: "completed",
        outputId: finalOutput.id,
        sourceVideoUrl,
        videoUrl: finalUrl,
        logoUrl: logoUrl || null,
        logoApplied: Boolean(logoUrl),
        narrationUrl: narrationUrl || null,
        narrationApplied: Boolean(narrationUrl),
        narrationDelayMs: voiceDelay,
        musicUrl: musicUrl || null,
        musicApplied: Boolean(musicUrl),
        musicBedVolume: narrationUrl && musicUrl ? 0.34 : 0.72,
        avatarUrl: avatarUrl || null,
        avatarApplied: Boolean(avatarUrl),
        avatarTransparent: Boolean(avatarUrl),
        avatarMattingModel: avatarUrl ? clean(avatarPipeline?.matting?.model, 200) || null : null,
        avatarWindows: avatarUrl ? avatarWindows(duration) : [],
        audioCodec: "aac",
        audioBitrate: "192k",
        mixVersion: MIX_VERSION,
        finalizedAt: now,
        completedAt: now,
        error: null,
        finalization: { status: "completed", outputId, startedAt, completedAt: now, error: null },
      },
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      outputId: finalOutput.id,
      video_url: finalUrl,
      source_video_url: sourceVideoUrl,
      logo_url: logoUrl || null,
      logo_applied: Boolean(logoUrl),
      narration_url: narrationUrl || null,
      narration_applied: Boolean(narrationUrl),
      narration_delay_ms: voiceDelay,
      music_url: musicUrl || null,
      music_applied: Boolean(musicUrl),
      avatar_url: avatarUrl || null,
      avatar_applied: Boolean(avatarUrl),
      avatar_transparent: Boolean(avatarUrl),
      avatar_matting_model: avatarUrl ? clean(avatarPipeline?.matting?.model, 200) || null : null,
      avatar_windows: avatarUrl ? avatarWindows(duration) : [],
      audio_codec: "aac",
      audio_bitrate: "192k",
      mix_version: MIX_VERSION,
      project: nextProject,
      outputs: nextProject.outputs || [],
      activeOutputId: nextProject.activeOutputId || finalOutput.id,
    });
  } catch (error) {
    console.error("[ad-film/seedance/finalize-v2]", error);
    if (user && project && projectId) {
      try {
        const failedAt = new Date().toISOString();
        await saveProject(user, {
          ...project,
          status: "failed",
          generation: {
            ...(project.generation || {}),
            status: "finalize_failed",
            sourceVideoUrl: sourceVideoUrl || project?.generation?.sourceVideoUrl || project?.generation?.videoUrl || null,
            error: clean(error?.message || error, 1200),
            finalization: {
              status: "failed",
              outputId: outputId || project?.generation?.outputId || project?.generation?.requestId || null,
              startedAt: project?.generation?.finalization?.startedAt || null,
              failedAt,
              error: clean(error?.message || error, 1200),
            },
          },
        });
      } catch (saveError) {
        console.error("[ad-film/seedance/finalize-v2/save-failure]", saveError);
      }
    }
    const message = clean(error?.message || error, 1200);
    return sendJson(res, message === "ffmpeg_timeout" ? 504 : 500, {
      ok: false,
      error: "adfilm_finalize_failed",
      message,
      retryable: false,
      video_url: sourceVideoUrl || null,
    });
  } finally {
    for (const entry of cleanup.reverse()) {
      try {
        if (!entry || !fs.existsSync(entry)) continue;
        if (fs.statSync(entry).isDirectory()) fs.rmSync(entry, { recursive: true, force: true });
        else fs.unlinkSync(entry);
      } catch (_) {}
    }
  }
}
