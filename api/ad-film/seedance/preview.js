// api/ad-film/seedance/preview.js
export const config = { runtime: "nodejs" };
export const maxDuration = 120;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpegPath from "ffmpeg-static";
import { putObject } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const DOWNLOAD_TIMEOUT_MS = 70000;
const PREVIEW_TIMEOUT_MS = 90000;
const UPLOAD_TIMEOUT_MS = 65000;
const MAX_SOURCE_BYTES = 180 * 1024 * 1024;

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function safePart(value, fallback = "video") {
  const next = clean(value, 180)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

async function download(url, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`preview_download_failed:${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_SOURCE_BYTES) {
      throw new Error("preview_source_too_large");
    }

    let received = 0;
    const meter = new TransformStream({
      transform(chunk, writer) {
        received += chunk.byteLength || chunk.length || 0;
        if (received > MAX_SOURCE_BYTES) {
          throw new Error("preview_source_too_large");
        }
        writer.enqueue(chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body.pipeThrough(meter)),
      fs.createWriteStream(destination),
    );

    if (received <= 0) throw new Error("preview_source_empty");
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("preview_download_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function runPreviewFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale='min(560,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "29",
      "-b:v",
      "1300k",
      "-maxrate",
      "1600k",
      "-bufsize",
      "3200k",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-ac",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath,
    ];

    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("preview_ffmpeg_timeout"));
    }, PREVIEW_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
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
      if (code === 0) resolve();
      else reject(new Error(stderr || `preview_ffmpeg_failed:${code}`));
    });
  });
}

function pickTarget(project, requestedOutputId) {
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];
  const requested = clean(requestedOutputId, 240);

  if (requested) {
    const matched = outputs.find((item) => clean(item?.id, 240) === requested);
    if (matched && clean(matched.videoUrl)) {
      return { target: matched, outputs };
    }
  }

  const activeOutputId = clean(project?.activeOutputId, 240);
  const active = outputs.find((item) => clean(item?.id, 240) === activeOutputId);
  if (active && clean(active.videoUrl)) {
    return { target: active, outputs };
  }

  const first = outputs.find((item) => clean(item?.videoUrl));
  if (first) return { target: first, outputs };

  const generation = project?.generation || {};
  const generationVideoUrl = clean(generation.videoUrl);
  const generationOutputId = clean(generation.outputId || generation.requestId, 240);

  if (generationVideoUrl && generationOutputId) {
    return {
      target: {
        id: generationOutputId,
        videoUrl: generationVideoUrl,
        previewUrl: clean(generation.previewUrl) || null,
      },
      outputs,
    };
  }

  return { target: null, outputs };
}

export default async function handler(req, res) {
  let tmpDir = "";

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    const requestedOutputId = clean(req.body?.outputId, 240);

    if (!projectId) {
      return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    }

    const project = await getOwnedProject(user, projectId);
    if (!project) {
      return sendJson(res, 404, { ok: false, error: "project_not_found" });
    }

    const picked = pickTarget(project, requestedOutputId);
    const target = picked.target;
    const outputs = picked.outputs;

    if (!target) {
      return sendJson(res, 409, { ok: false, error: "preview_source_missing" });
    }

    const outputId = clean(target.id, 240);
    const finalUrl = clean(target.videoUrl);
    const existingPreviewUrl = clean(target.previewUrl || target.preview_url);

    if (!outputId || !finalUrl) {
      return sendJson(res, 409, { ok: false, error: "preview_source_missing" });
    }

    if (existingPreviewUrl) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        outputId,
        video_url: finalUrl,
        preview_url: existingPreviewUrl,
        skipped: true,
        project,
      });
    }

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-adfilm-preview-"));
    const inputPath = path.join(tmpDir, "final.mp4");
    const previewPath = path.join(tmpDir, "preview.mp4");

    await download(finalUrl, inputPath);
    await runPreviewFfmpeg(inputPath, previewPath);

    const previewStat = fs.statSync(previewPath);
    if (!previewStat.size) throw new Error("preview_output_empty");

    const uploadController = new AbortController();
    const uploadTimer = setTimeout(() => uploadController.abort(), UPLOAD_TIMEOUT_MS);

    let previewUrl = "";
    try {
      previewUrl = await putObject({
        key: `${mediaPrefix(user, projectId)}outputs/seedance/${safePart(outputId)}-preview-${Date.now()}.mp4`,
        body: fs.createReadStream(previewPath),
        contentLength: previewStat.size,
        abortSignal: uploadController.signal,
        contentType: "video/mp4",
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("preview_upload_timeout");
      throw error;
    } finally {
      clearTimeout(uploadTimer);
    }

    if (!previewUrl) throw new Error("preview_upload_missing_url");

    const latestProject = await getOwnedProject(user, projectId);
    if (!latestProject) {
      return sendJson(res, 404, { ok: false, error: "project_not_found" });
    }

    const latestOutputs = Array.isArray(latestProject.outputs)
      ? latestProject.outputs
      : [];
    const latestGeneration = latestProject.generation || {};
    const latestGenerationOutputId = clean(
      latestGeneration.outputId || latestGeneration.requestId,
      240,
    );
    const latestOutput = latestOutputs.find(
      (item) => clean(item?.id, 240) === outputId,
    );
    const latestGenerationMatches = latestGenerationOutputId === outputId;

    if (!latestOutput && !latestGenerationMatches) {
      return sendJson(res, 409, {
        ok: false,
        error: "preview_target_stale",
        projectId,
        outputId,
      });
    }

    const concurrentPreviewUrl = clean(
      latestOutput?.previewUrl ||
      latestOutput?.preview_url ||
      (latestGenerationMatches ? latestGeneration.previewUrl : ""),
    );

    if (concurrentPreviewUrl) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        outputId,
        video_url: clean(latestOutput?.videoUrl || latestGeneration.videoUrl || finalUrl),
        preview_url: concurrentPreviewUrl,
        skipped: true,
        project: latestProject,
      });
    }

    const nextOutputs = latestOutput
      ? latestOutputs.map((item) =>
          clean(item?.id, 240) === outputId
            ? { ...item, previewUrl }
            : item,
        )
      : [{ ...target, previewUrl }, ...latestOutputs].slice(0, 30);

    const nextProject = await saveProject(user, {
      ...latestProject,
      outputs: nextOutputs,
      generation: latestGenerationMatches
        ? { ...latestGeneration, previewUrl }
        : latestGeneration,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      outputId,
      video_url: clean(latestOutput?.videoUrl || latestGeneration.videoUrl || finalUrl),
      preview_url: previewUrl,
      project: nextProject,
    });
  } catch (error) {
    console.error("[ad-film/seedance/preview]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "adfilm_preview_failed",
      message: clean(error?.message || error, 1200),
      retryable: true,
    });
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
}
