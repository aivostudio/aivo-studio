// api/ad-film/narration/master.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { putObject } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 1800) {
  return String(value ?? "").trim().slice(0, max);
}
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); if (stderr.length > 18000) stderr = stderr.slice(-18000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg_failed:${code}`)));
  });
}
async function download(url, destination) {
  const response = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`download_failed:${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length || body.length > 30 * 1024 * 1024) throw new Error("invalid_audio_size");
  fs.writeFileSync(destination, body);
}

export default async function handler(req, res) {
  const cleanup = [];
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return sendJson(res, 405, { ok: false, error: "method_not_allowed" }); }
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });
    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
    const audio = project.narration?.audio;
    const sourceUrl = clean(audio?.sourceUrl || audio?.url, 4000);
    if (!sourceUrl) return sendJson(res, 409, { ok: false, error: "narration_audio_missing" });
    if (audio?.mastered === true && audio?.masteringVersion === 2 && audio?.url) return sendJson(res, 200, { ok: true, skipped: "already_mastered", audio, project });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-narration-master-"));
    const inputPath = path.join(tmpDir, "input-audio");
    const outputPath = path.join(tmpDir, "mastered.mp3");
    cleanup.push(outputPath, inputPath, tmpDir);
    await download(sourceUrl, inputPath);

    const filter = [
      "highpass=f=75",
      "lowpass=f=18000",
      "equalizer=f=180:t=q:w=0.9:g=-1.2",
      "equalizer=f=420:t=q:w=1.0:g=-1.8",
      "equalizer=f=2800:t=q:w=1.1:g=0.7",
      "equalizer=f=8500:t=q:w=1.0:g=1.2",
      "acompressor=threshold=-18dB:ratio=2.2:attack=15:release=170:makeup=1.4:knee=3",
      "deesser=i=0.18:m=0.45:f=0.52:s=o",
      "loudnorm=I=-14.5:TP=-1.2:LRA=6",
      "alimiter=limit=0.96:attack=5:release=70",
      "aresample=48000"
    ].join(",");

    await runFfmpeg(["-y", "-i", inputPath, "-vn", "-af", filter, "-ac", "2", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", "-map_metadata", "-1", outputPath]);

    const now = new Date().toISOString();
    const key = `${mediaPrefix(user, projectId)}narration/mastered-v2-${Date.now()}.mp3`;
    const masteredUrl = await putObject({ key, body: fs.readFileSync(outputPath), contentType: "audio/mpeg", cacheControl: "public, max-age=31536000, immutable", contentDisposition: "inline" });
    const masteredAudio = { ...(audio || {}), sourceUrl, url: masteredUrl, contentType: "audio/mpeg", mastered: true, masteringVersion: 2, masteredAt: now, approved: false, approvedAt: null };
    const saved = await saveProject(user, { ...project, narration: { ...(project.narration || {}), audio: masteredAudio } });
    return sendJson(res, 200, { ok: true, audio: saved.narration.audio, project: saved });
  } catch (error) {
    console.error("[ad-film/narration/master]", error);
    return sendJson(res, 500, { ok: false, error: "narration_master_failed", message: String(error?.message || error).slice(0, 1200) });
  } finally {
    for (const entry of cleanup.reverse()) {
      try { if (!entry || !fs.existsSync(entry)) continue; if (fs.statSync(entry).isDirectory()) fs.rmSync(entry, { recursive: true, force: true }); else fs.unlinkSync(entry); } catch (_) {}
    }
  }
}
