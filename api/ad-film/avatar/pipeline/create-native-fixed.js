// api/ad-film/avatar/pipeline/create-native-fixed.js
// Compatibility wrapper: keeps the native route stable and aligns lipsync audio
// with the avatar's real position in the final advertising timeline.
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import nativeHandler from "./create-native.js";
import { buildAdFilmTimeline } from "../../../_lib/ad-film-timeline.js";
import { putObject } from "../../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function parseJson(value) {
  try { return value ? JSON.parse(value) : {}; }
  catch (_) { return {}; }
}

function isHttpUrl(value) {
  return /^https:\/\//i.test(clean(value, 4000));
}

function normalizeAvatarDuration(value) {
  return String(value ?? "").trim() === "15" ? "15" : "10";
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio:["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve()
      : reject(new Error(stderr || `ffmpeg_failed:${code}`)));
  });
}

async function downloadBuffer(url, maxBytes = 35 * 1024 * 1024) {
  const response = await fetch(url, {
    method:"GET",
    cache:"no-store",
    redirect:"follow",
  });
  if (!response.ok) throw new Error(`audio_download_failed:${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length || body.length > maxBytes) throw new Error("invalid_audio_size");
  return body;
}

async function createTimelineNarrationClip(project, user, projectId, duration) {
  const narration = project?.narration || {};
  const audio = narration.audio;
  if (narration.enabled === false || audio?.approved !== true || !isHttpUrl(audio?.url)) {
    return null;
  }

  const timeline = buildAdFilmTimeline({
    duration:Number(duration),
    avatarEnabled:true,
    shots:project?.productionPlan?.shots,
  });
  const avatar = timeline.avatar;
  if (!avatar) return null;

  const speech = timeline.speech || {
    start:avatar.start,
    end:avatar.end,
    clipStart:0,
  };
  const sourceStart = Math.max(0, Number(speech.start) || 0);
  const sourceEnd = Math.max(sourceStart + 0.5, Number(speech.end) || avatar.end);
  const localLead = Math.max(0, Number(speech.clipStart) || 0);
  const clipDuration = Math.max(0.5, Number(avatar.duration) || sourceEnd - sourceStart);
  const delayMs = Math.round(localLead * 1000);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-lipsync-window-"));
  const input = path.join(tmpDir, "input-audio");
  const output = path.join(tmpDir, "timeline.wav");
  try {
    fs.writeFileSync(input, await downloadBuffer(audio.url, 30 * 1024 * 1024));
    const filter = [
      `atrim=start=${sourceStart}:end=${sourceEnd}`,
      "asetpts=PTS-STARTPTS",
      "aresample=48000",
      `adelay=${delayMs}|${delayMs}`,
      `apad=pad_dur=${clipDuration + 1}`,
      `atrim=0:${clipDuration}`,
    ].join(",");
    await runFfmpeg([
      "-y", "-i", input,
      "-af", filter,
      "-t", String(clipDuration),
      "-ar", "48000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      output,
    ]);
    const key = `${mediaPrefix(user, projectId)}avatar/pipeline/lipsync-window-${Date.now()}.wav`;
    const url = await putObject({
      key,
      body:fs.readFileSync(output),
      contentType:"audio/wav",
      cacheControl:"public, max-age=31536000, immutable",
      contentDisposition:"inline",
    });
    return {
      url,
      timeline,
      sourceStart,
      sourceEnd,
      localLead,
      clipDuration,
      originalAudio:audio,
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive:true, force:true }); }
    catch (_) {}
  }
}

function createCaptureResponse() {
  const state = { statusCode:200, headers:{}, body:"" };
  return {
    get statusCode() { return state.statusCode; },
    set statusCode(value) { state.statusCode = Number(value) || 200; },
    setHeader(name, value) { state.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return state.headers[String(name).toLowerCase()]; },
    end(chunk) {
      state.body = chunk == null
        ? ""
        : Buffer.isBuffer(chunk)
          ? chunk.toString("utf8")
          : String(chunk);
    },
    _state:state,
  };
}

async function restoreNarration(user, projectId, originalAudio) {
  if (!originalAudio) return getOwnedProject(user, projectId);
  const latest = await getOwnedProject(user, projectId);
  if (!latest) return null;
  return saveProject(user, {
    ...latest,
    narration:{
      ...(latest.narration || {}),
      audio:originalAudio,
    },
  });
}

export default async function handler(req, res) {
  let user = null;
  let projectId = "";
  let originalAudio = null;
  let temporaryAudioSaved = false;
  let restoredProject = null;

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok:false, error:"method_not_allowed" });
    }

    user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok:false, error:"unauthorized" });

    projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok:false, error:"missing_project_id" });

    let project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok:false, error:"project_not_found" });

    const duration = normalizeAvatarDuration(
      req.body?.duration ||
      project?.output?.duration ||
      project?.generation?.input?.duration
    );
    originalAudio = project?.narration?.audio || null;
    const clip = await createTimelineNarrationClip(project, user, projectId, duration);

    if (clip) {
      project = await saveProject(user, {
        ...project,
        narration:{
          ...(project.narration || {}),
          audio:{
            ...originalAudio,
            url:clip.url,
            timelineWindow:{
              globalStart:clip.sourceStart,
              globalEnd:clip.sourceEnd,
              localLead:clip.localLead,
              clipDuration:clip.clipDuration,
            },
          },
        },
      });
      temporaryAudioSaved = true;
    }

    req.body = {
      ...(req.body || {}),
      projectId:project.id,
      duration,
    };

    const captured = createCaptureResponse();
    let nativeError = null;
    try {
      await nativeHandler(req, captured);
    } catch (error) {
      nativeError = error;
    } finally {
      if (temporaryAudioSaved) {
        restoredProject = await restoreNarration(user, projectId, originalAudio).catch((error) => {
          console.error("[ad-film/avatar/pipeline/create-native-fixed:restore]", error);
          return null;
        });
      }
    }

    if (nativeError) throw nativeError;

    const payload = parseJson(captured._state.body);
    if (restoredProject && payload && typeof payload === "object" && payload.project) {
      payload.project = restoredProject;
    }
    return sendJson(res, captured._state.statusCode || 200, payload);
  } catch (error) {
    if (temporaryAudioSaved && user && projectId && !restoredProject) {
      restoredProject = await restoreNarration(user, projectId, originalAudio).catch(() => null);
    }
    console.error("[ad-film/avatar/pipeline/create-native-fixed]", error);
    return sendJson(res, Number(error?.status) || 500, {
      ok:false,
      error:clean(error?.message || error, 1200) || "native_lipsync_timeline_failed",
    });
  }
}
