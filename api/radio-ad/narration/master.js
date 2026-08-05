// api/radio-ad/narration/master.js
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

const MASTERING_VERSION = 1;
const DOWNLOAD_LIMIT = 40 * 1024 * 1024;

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
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
    }, 120000);

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

    const audio = project.narration?.audio;
    const sourceUrl = clean(audio?.sourceUrl || audio?.url, 4000);
    if (!sourceUrl) return sendJson(res, 409, { ok: false, error: "narration_audio_missing" });
    if (!project.narrationGeneration || project.narrationGeneration.status !== "completed") {
      return sendJson(res, 409, { ok: false, error: "narration_generation_not_completed" });
    }
    if (audio?.fingerprint && project.narrationGeneration?.fingerprint && audio.fingerprint !== project.narrationGeneration.fingerprint) {
      return sendJson(res, 409, { ok: false, error: "stale_narration_audio" });
    }
    if (audio?.mastered === true && audio?.masteringVersion === MASTERING_VERSION && audio?.url) {
      return sendJson(res, 200, { ok: true, skipped: "already_mastered", audio, project });
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-radio-narration-"));
    const inputPath = path.join(tmpDir, "source-audio");
    const wavPath = path.join(tmpDir, "mastered.wav");
    const mp3Path = path.join(tmpDir, "preview.mp3");
    cleanup.push(mp3Path, wavPath, inputPath, tmpDir);
    await download(sourceUrl, inputPath);

    const filter = [
      "highpass=f=70",
      "lowpass=f=19000",
      "equalizer=f=180:t=q:w=0.9:g=-1.0",
      "equalizer=f=420:t=q:w=1.0:g=-1.5",
      "equalizer=f=2800:t=q:w=1.1:g=0.9",
      "equalizer=f=8500:t=q:w=1.0:g=1.1",
      "acompressor=threshold=-18dB:ratio=2.4:attack=12:release=160:makeup=1.6:knee=3",
      "deesser=i=0.18:m=0.45:f=0.52:s=o",
      "loudnorm=I=-16:TP=-1.0:LRA=5",
      "alimiter=limit=0.96:attack=5:release=70",
      "aresample=48000"
    ].join(",");

    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vn",
      "-af", filter,
      "-ac", "2",
      "-ar", "48000",
      "-c:a", "pcm_s24le",
      "-map_metadata", "-1",
      wavPath,
    ]);

    await runFfmpeg([
      "-y",
      "-i", wavPath,
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "320k",
      "-ar", "48000",
      "-ac", "2",
      "-map_metadata", "-1",
      mp3Path,
    ]);

    const now = new Date().toISOString();
    const base = `${mediaPrefix(user, projectId)}narration/`;
    const wavKey = `${base}mastered-v${MASTERING_VERSION}-${Date.now()}.wav`;
    const mp3Key = `${base}preview-v${MASTERING_VERSION}-${Date.now()}.mp3`;

    const [wavUrl, mp3Url] = await Promise.all([
      putObject({
        key: wavKey,
        body: fs.readFileSync(wavPath),
        contentType: "audio/wav",
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      }),
      putObject({
        key: mp3Key,
        body: fs.readFileSync(mp3Path),
        contentType: "audio/mpeg",
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      }),
    ]);

    const masteredAudio = {
      ...(audio || {}),
      sourceUrl,
      url: mp3Url,
      previewUrl: mp3Url,
      masteredWavUrl: wavUrl,
      contentType: "audio/mpeg",
      mastered: true,
      masteringVersion: MASTERING_VERSION,
      masteredAt: now,
      approved: false,
      approvedAt: null,
    };

    const saved = await saveRadioProject(user, {
      ...project,
      status: "draft",
      narration: {
        ...(project.narration || {}),
        audio: masteredAudio,
      },
      final: null,
      finalGeneration: null,
    });

    return sendJson(res, 200, {
      ok: true,
      audio: saved.narration.audio,
      project: saved,
    });
  } catch (error) {
    console.error("[radio-ad/narration/master]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "narration_master_failed",
      message: String(error?.message || error).slice(0, 1200),
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
