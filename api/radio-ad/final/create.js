// api/radio-ad/final/create.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { putObject } from "../../_lib/r2.js";
import {
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

const PIPELINE_VERSION = "radio-final-v1";
const DOWNLOAD_LIMIT = 100 * 1024 * 1024;

function clean(value, max = 4000) { return String(value ?? "").trim().slice(0, max); }
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
    }, 150000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 30000) stderr = stderr.slice(-30000);
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
async function download(url, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal });
    if (!response.ok) throw new Error(`download_failed:${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > DOWNLOAD_LIMIT) throw new Error("invalid_audio_size");
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length || body.length > DOWNLOAD_LIMIT) throw new Error("invalid_audio_size");
    fs.writeFileSync(destination, body);
  } finally {
    clearTimeout(timer);
  }
}
function finalAudioUrl(project) {
  if (project.music?.mode === "off") return null;
  if (project.music?.mode === "upload") return clean(project.music?.upload?.url, 4000);
  return clean(project.music?.audio?.url, 4000);
}

export default async function handler(req, res) {
  const cleanup = [];
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }
    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const narration = project.narration?.audio;
    if (!narration?.url || narration.mastered !== true) {
      return sendJson(res, 409, { ok: false, error: "approved_narration_required" });
    }
    if (narration.approved !== true) {
      return sendJson(res, 409, { ok: false, error: "narration_approval_required" });
    }
    const musicUrl = finalAudioUrl(project);
    if (project.music?.mode !== "off" && !musicUrl) {
      return sendJson(res, 409, { ok: false, error: "music_audio_missing" });
    }

    const duration = Number(project.output?.duration || 10);
    if (![10, 15, 30, 45, 60].includes(duration)) {
      return sendJson(res, 400, { ok: false, error: "invalid_duration" });
    }
    const format = project.output?.format === "wav" ? "wav" : "mp3";
    if (
      project.final?.url &&
      project.final.pipelineVersion === PIPELINE_VERSION &&
      Number(project.final.duration) === duration &&
      project.final.format === format
    ) {
      return sendJson(res, 200, { ok: true, status: "COMPLETED", reused: true, final: project.final, project });
    }

    const startedAt = new Date().toISOString();
    let working = await saveRadioProject(user, {
      ...project,
      status: "processing",
      final: null,
      finalGeneration: {
        status: "processing",
        stage: "mixing",
        startedAt,
        updatedAt: startedAt,
        pipelineVersion: PIPELINE_VERSION,
      },
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-radio-final-"));
    const voicePath = path.join(tmpDir, "voice.mp3");
    const musicPath = path.join(tmpDir, "music-input");
    const outputPath = path.join(tmpDir, `final.${format}`);
    cleanup.push(outputPath, musicPath, voicePath, tmpDir);
    await download(narration.url, voicePath);
    if (musicUrl) await download(musicUrl, musicPath);

    const args = ["-y", "-i", voicePath];
    if (musicUrl) args.push("-stream_loop", "-1", "-i", musicPath);

    if (musicUrl) {
      args.push(
        "-filter_complex",
        `[0:a]atrim=0:${duration},asetpts=PTS-STARTPTS,volume=1.0[voice];` +
        `[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS,volume=0.24,afade=t=in:st=0:d=0.35,afade=t=out:st=${Math.max(0, duration - 0.55)}:d=0.55[music];` +
        `[music][voice]sidechaincompress=threshold=0.025:ratio=7:attack=18:release=260:makeup=1[ducked];` +
        `[voice][ducked]amix=inputs=2:duration=longest:weights='1 1':normalize=0,` +
        `loudnorm=I=-16:TP=-1.0:LRA=5,alimiter=limit=0.96,atrim=0:${duration}[out]`,
        "-map", "[out]"
      );
    } else {
      args.push(
        "-af",
        `apad=pad_dur=${duration},atrim=0:${duration},loudnorm=I=-16:TP=-1.0:LRA=5,alimiter=limit=0.96`
      );
    }

    args.push("-vn", "-ar", "48000", "-ac", "2", "-map_metadata", "-1");
    if (format === "wav") args.push("-c:a", "pcm_s24le");
    else args.push("-c:a", "libmp3lame", "-b:a", "320k");
    args.push(outputPath);
    await runFfmpeg(args);

    const now = new Date().toISOString();
    const key = `${mediaPrefix(user, projectId)}final/final-v1-${Date.now()}.${format}`;
    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    const url = await putObject({
      key,
      body: fs.readFileSync(outputPath),
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });
    const final = {
      url,
      contentType,
      format,
      duration,
      bitrate: format === "mp3" ? "320k" : null,
      pipelineVersion: PIPELINE_VERSION,
      createdAt: now,
      musicMode: project.music?.mode || "off",
    };
    working = await saveRadioProject(user, {
      ...working,
      status: "completed",
      final,
      finalGeneration: {
        ...(working.finalGeneration || {}),
        status: "completed",
        stage: "completed",
        updatedAt: now,
        completedAt: now,
        error: null,
        pipelineVersion: PIPELINE_VERSION,
      },
    });
    return sendJson(res, 200, { ok: true, status: "COMPLETED", final, project: working });
  } catch (error) {
    console.error("[radio-ad/final/create]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "final_mix_failed",
      message: clean(error?.message || error, 1200),
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
