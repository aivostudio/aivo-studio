import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { putObject } from "./r2.js";
import { mediaPrefix } from "./ad-film-projects.js";

const PREVIEW_TIMEOUT_MS = 60000;
const UPLOAD_TIMEOUT_MS = 65000;

function clean(value, max = 1600) {
  return String(value ?? "").trim().slice(0, max);
}

function safePart(value, fallback = "video") {
  const next = clean(value, 180)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
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
      "-ar",
      "48000",
      "-ac",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-threads",
      "2",
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

export async function createAdFilmFinalizePreview({
  inputPath,
  user,
  projectId,
  outputId,
  version,
}) {
  if (!inputPath || !user || !projectId || !outputId) {
    throw new Error("preview_input_missing");
  }

  const previewPath = path.join(
    path.dirname(inputPath),
    `preview-${safePart(outputId)}.mp4`,
  );

  try {
    await runPreviewFfmpeg(inputPath, previewPath);

    if (!fs.existsSync(previewPath)) {
      throw new Error("preview_output_missing");
    }

    const stat = fs.statSync(previewPath);
    if (!stat.size) throw new Error("preview_output_empty");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      return await putObject({
        key: `${mediaPrefix(user, projectId)}outputs/seedance/${safePart(outputId)}-v${Number(version) || 1}-preview-finalize-${Date.now()}.mp4`,
        body: fs.createReadStream(previewPath),
        contentLength: stat.size,
        abortSignal: controller.signal,
        contentType: "video/mp4",
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("preview_upload_timeout");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    try {
      if (fs.existsSync(previewPath)) fs.unlinkSync(previewPath);
    } catch (_) {}
  }
}
