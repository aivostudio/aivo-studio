// api/ad-film/seedance/finalize.js
export const config = { runtime: "nodejs" };
export const maxDuration = 60;

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

function clean(value, max = 1600) {
  return String(value ?? "").trim().slice(0, max);
}

function safePart(value, fallback = "output") {
  const next = clean(value, 180)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr || `ffmpeg_failed:${code}`));
    });
  });
}

async function download(url, destination) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`download_failed:${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
}

function outputsOf(project) {
  const outputs = Array.isArray(project?.outputs)
    ? project.outputs.filter((item) => item && item.videoUrl)
    : [];
  if (!outputs.length && project?.generation?.videoUrl) {
    outputs.push({
      id: project.generation.outputId || project.generation.requestId,
      requestId: project.generation.requestId || null,
      version: project.generation.version || 1,
      videoUrl: project.generation.videoUrl,
      logoUrl: project.generation.logoUrl || project?.media?.logo?.url || null,
      completedAt: project.generation.completedAt || project.updatedAt,
      duration: project.generation.input?.duration || project?.output?.duration || "15",
      aspectRatio: project.generation.input?.aspectRatio || project?.output?.aspectRatio || "9:16",
      resolution: project.generation.input?.resolution || project?.output?.quality || "1080p",
      generateAudio: project.generation.input?.generateAudio !== false,
    });
  }
  return outputs.slice(0, 30);
}

function logoWidth(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 320;
  if (value === "720p") return 135;
  if (value === "480p") return 96;
  return 190;
}

function logoMargin(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 64;
  if (value === "720p") return 26;
  if (value === "480p") return 18;
  return 36;
}

export default async function handler(req, res) {
  const cleanup = [];
  let sourceVideoUrl = "";

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    const requestedOutputId = clean(req.body?.outputId, 240);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const outputs = outputsOf(project);
    const target = outputs.find((item) => clean(item.id) === requestedOutputId)
      || outputs.find((item) => clean(item.id) === clean(project.activeOutputId))
      || outputs[0]
      || null;

    sourceVideoUrl = clean(
      target?.sourceVideoUrl ||
      target?.videoUrl ||
      project?.generation?.sourceVideoUrl ||
      project?.generation?.videoUrl,
      4000
    );
    const logoUrl = clean(
      project?.media?.logo?.url ||
      target?.logoUrl ||
      project?.generation?.logoUrl,
      4000
    );

    if (!sourceVideoUrl) {
      return sendJson(res, 200, {
        ok: false,
        fallback: true,
        error: "missing_source_video",
        video_url: null,
        logo_applied: false,
      });
    }

    if (target?.logoApplied && target?.videoUrl) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        outputId: target.id,
        video_url: target.videoUrl,
        logo_applied: true,
        project,
      });
    }

    if (!logoUrl) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        outputId: target?.id || project?.generation?.outputId || null,
        video_url: sourceVideoUrl,
        logo_applied: false,
        skipped: "missing_logo",
        project,
      });
    }

    const resolution = target?.resolution || project?.generation?.input?.resolution || project?.output?.quality || "1080p";
    const width = logoWidth(resolution);
    const margin = logoMargin(resolution);
    const outputId = clean(target?.id || project?.generation?.outputId || project?.generation?.requestId, 240);
    const version = Number.parseInt(target?.version || project?.generation?.version, 10) || 1;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-adfilm-logo-"));
    const inputVideo = path.join(tmpDir, "source.mp4");
    const inputLogo = path.join(tmpDir, "logo.png");
    const outputVideo = path.join(tmpDir, "final.mp4");
    cleanup.push(outputVideo, inputLogo, inputVideo, tmpDir);

    await download(sourceVideoUrl, inputVideo);
    await download(logoUrl, inputLogo);

    const filter = [
      `[1:v]scale=${width}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=0.92[logo]`,
      `[0:v][logo]overlay=W-w-${margin}:H-h-${margin}:format=auto:shortest=1[video]`,
    ].join(";");

    await runFfmpeg([
      "-y",
      "-i", inputVideo,
      "-loop", "1",
      "-i", inputLogo,
      "-filter_complex", filter,
      "-map", "[video]",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      "-movflags", "+faststart",
      outputVideo,
    ]);

    const key = `${mediaPrefix(user, projectId)}outputs/seedance/${safePart(outputId, "video")}-v${version}-logo.mp4`;
    const finalUrl = await putObject({
      key,
      body: fs.readFileSync(outputVideo),
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });

    const now = new Date().toISOString();
    const finalOutput = {
      ...(target || {}),
      id: outputId || target?.id || project?.generation?.requestId,
      version,
      sourceVideoUrl,
      videoUrl: finalUrl,
      logoUrl,
      logoApplied: true,
      logoPosition: "bottom-right",
      logoOpacity: 0.92,
      finalizedAt: now,
    };
    const nextOutputs = [
      finalOutput,
      ...outputs.filter((item) => clean(item.id) !== clean(finalOutput.id)),
    ].slice(0, 30);

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
        logoUrl,
        logoApplied: true,
        finalizedAt: now,
        completedAt: project?.generation?.completedAt || now,
        error: null,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      outputId: finalOutput.id,
      video_url: finalUrl,
      source_video_url: sourceVideoUrl,
      logo_url: logoUrl,
      logo_applied: true,
      project: nextProject,
      outputs: nextProject.outputs || [],
      activeOutputId: nextProject.activeOutputId || finalOutput.id,
    });
  } catch (error) {
    console.error("[ad-film/seedance/finalize]", error);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: "logo_finalize_failed",
      message: String(error?.message || error).slice(0, 1200),
      video_url: sourceVideoUrl || null,
      logo_applied: false,
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
