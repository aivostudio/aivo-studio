// api/radio-ad/final/create.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import crypto from "crypto";
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

const PIPELINE_VERSION = "radio-final-v4";
const DOWNLOAD_LIMIT = 100 * 1024 * 1024;
const MAX_FINAL_HISTORY = 24;
const MUSIC_VOLUME = 0.5;
const DUCKING_THRESHOLD = 0.16;
const DUCKING_RATIO = 2.4;
const DUCKING_ATTACK_MS = 10;
const DUCKING_RELEASE_MS = 150;

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function stderrTail(value, max = 5000) {
  const text = String(value || "");
  return text.length > max ? text.slice(-max) : text;
}

function finalId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
}

function finalHistory(project, newest) {
  const existing = Array.isArray(project?.finalHistory) ? project.finalHistory : [];
  const list = newest ? [newest, ...existing] : existing.slice();
  const seen = new Set();
  return list
    .filter((item) => item && typeof item === "object" && item.url)
    .filter((item) => {
      const key = clean(item.id || item.url, 5000);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_FINAL_HISTORY);
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
      const error = new Error("ffmpeg_timeout");
      error.ffmpegStderr = stderrTail(stderr);
      reject(error);
    }, 150000);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 60000) stderr = stderr.slice(-60000);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error.ffmpegStderr = stderrTail(stderr);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) return resolve();
      const error = new Error(`ffmpeg_failed:${code}`);
      error.ffmpegStderr = stderrTail(stderr);
      reject(error);
    });
  });
}

async function download(url, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`download_failed:${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > DOWNLOAD_LIMIT) throw new Error("invalid_audio_size");
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length || body.length > DOWNLOAD_LIMIT) throw new Error("invalid_audio_size");
    fs.writeFileSync(destination, body);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("download_timeout");
    throw error;
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
  let user = null;
  let project = null;
  let working = null;

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    project = await getOwnedRadioProject(user, projectId);
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
      return sendJson(res, 200, {
        ok: true,
        status: "COMPLETED",
        reused: true,
        final: project.final,
        finalHistory: finalHistory(project),
        project,
      });
    }

    const startedAt = new Date().toISOString();
    working = await saveRadioProject(user, {
      ...project,
      status: "processing",
      final: null,
      finalGeneration: {
        status: "processing",
        stage: "mixing",
        startedAt,
        updatedAt: startedAt,
        pipelineVersion: PIPELINE_VERSION,
        error: null,
      },
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-radio-final-"));
    const voicePath = path.join(tmpDir, "voice-input");
    const musicPath = path.join(tmpDir, "music-input");
    const outputPath = path.join(tmpDir, `final.${format}`);
    cleanup.push(outputPath, musicPath, voicePath, tmpDir);

    await download(narration.url, voicePath);
    if (musicUrl) await download(musicUrl, musicPath);

    const args = ["-y", "-i", voicePath];
    if (musicUrl) args.push("-stream_loop", "-1", "-i", musicPath);

    if (musicUrl) {
      const fadeOutStart = Math.max(0, duration - 0.55);
      const filter = [
        `[0:a]atrim=0:${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=1.0[voicebase]`,
        `[voicebase]asplit=2[voice_sc][voice_mix]`,
        `[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${MUSIC_VOLUME},afade=t=in:st=0:d=0.35,afade=t=out:st=${fadeOutStart}:d=0.55[music]`,
        `[music][voice_sc]sidechaincompress=threshold=${DUCKING_THRESHOLD}:ratio=${DUCKING_RATIO}:attack=${DUCKING_ATTACK_MS}:release=${DUCKING_RELEASE_MS}[ducked]`,
        `[voice_mix][ducked]amix=inputs=2:duration=longest:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.0:LRA=5,alimiter=limit=0.96,atrim=0:${duration}[out]`,
      ].join(";");

      args.push("-filter_complex", filter, "-map", "[out]");
    } else {
      args.push(
        "-af",
        `apad=pad_dur=${duration},atrim=0:${duration},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,loudnorm=I=-16:TP=-1.0:LRA=5,alimiter=limit=0.96`
      );
    }

    args.push("-vn", "-ar", "48000", "-ac", "2", "-map_metadata", "-1");
    if (format === "wav") args.push("-c:a", "pcm_s24le");
    else args.push("-c:a", "libmp3lame", "-b:a", "320k");
    args.push(outputPath);

    await runFfmpeg(args);

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 0) {
      throw new Error("final_output_missing");
    }

    const now = new Date().toISOString();
    const key = `${mediaPrefix(user, projectId)}final/final-v4-${Date.now()}.${format}`;
    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    const url = await putObject({
      key,
      body: fs.readFileSync(outputPath),
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });

    const final = {
      id: finalId(),
      key,
      url,
      contentType,
      format,
      duration,
      bitrate: format === "mp3" ? "320k" : null,
      pipelineVersion: PIPELINE_VERSION,
      createdAt: now,
      musicMode: project.music?.mode || "off",
      title: clean(project.title || "Radyo Reklamı", 100) || "Radyo Reklamı",
    };
    const archive = finalHistory(working, final);

    working = await saveRadioProject(user, {
      ...working,
      status: "completed",
      final,
      finalHistory: archive,
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

    return sendJson(res, 200, {
      ok: true,
      status: "COMPLETED",
      final,
      finalHistory: archive,
      project: working,
    });
  } catch (error) {
    const diagnostic = clean(error?.ffmpegStderr || error?.message || error, 5000);
    console.error("[radio-ad/final/create]", diagnostic);

    if (user && working?.id) {
      try {
        working = await saveRadioProject(user, {
          ...working,
          status: "draft",
          final: null,
          finalGeneration: {
            ...(working.finalGeneration || {}),
            status: "failed",
            stage: "failed",
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            error: diagnostic,
            pipelineVersion: PIPELINE_VERSION,
          },
        });
      } catch (saveError) {
        console.error("[radio-ad/final/create] failed state save", saveError);
      }
    }

    return sendJson(res, 500, {
      ok: false,
      error: "final_mix_failed",
      message: diagnostic,
      project: working || project || null,
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
