// api/_lib/ad-film-avatar-cutout.js
import sharp from "sharp";
import { putObject } from "./r2.js";

const MODEL = "fal-ai/birefnet/v2";
const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 110000;

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

function parseJson(text) {
  try { return text ? JSON.parse(text) : {}; }
  catch (_) { return { raw: text || "" }; }
}

function resultUrl(payload) {
  return clean(
    payload?.image?.url ||
    payload?.data?.image?.url ||
    payload?.images?.[0]?.url ||
    payload?.data?.images?.[0]?.url,
    4000,
  );
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestCutout(sourceUrl) {
  const key = falKey();
  if (!key) throw new Error("missing_fal_key");

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://fal.run/${MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          image_url: sourceUrl,
          model: "Portrait",
          operating_resolution: "2048x2048",
          refine_foreground: true,
          output_mask: false,
          mask_only: false,
          sync_mode: false,
          output_format: "png",
        }),
        signal: controller.signal,
      });
      const data = parseJson(await response.text().catch(() => ""));
      if (!response.ok) {
        const error = new Error("avatar_background_removal_failed");
        error.status = response.status;
        error.data = data;
        throw error;
      }
      const url = resultUrl(data);
      if (!/^https:\/\//i.test(url)) {
        const error = new Error("avatar_cutout_output_missing");
        error.data = data;
        throw error;
      }
      return { url, response: data };
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? new Error("avatar_background_removal_timeout")
        : error;
      if (attempt < 2) await wait(1400);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("avatar_background_removal_failed");
}

async function downloadBuffer(url) {
  const response = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`avatar_cutout_download_failed:${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_DOWNLOAD_BYTES) throw new Error("avatar_cutout_invalid_size");
  return buffer;
}

async function normalizeTransparentPng(buffer) {
  const source = sharp(buffer, { failOn: "none", limitInputPixels: 100000000 }).ensureAlpha();
  const stats = await source.clone().stats();
  const alpha = stats.channels?.[3];
  if (!alpha || Number(alpha.min) >= 250) throw new Error("avatar_cutout_alpha_missing");

  const normalized = await source
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();

  let trimmed;
  try {
    trimmed = await sharp(normalized, { failOn: "none" })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer({ resolveWithObject: true });
  } catch (_) {
    trimmed = await sharp(normalized, { failOn: "none" })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer({ resolveWithObject: true });
  }

  const width = Math.max(1, Number(trimmed.info?.width) || 1);
  const height = Math.max(1, Number(trimmed.info?.height) || 1);
  const padding = Math.max(18, Math.min(96, Math.round(Math.max(width, height) * 0.035)));
  const output = await sharp(trimmed.data, { failOn: "none" })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    width: Number(output.info?.width) || width + padding * 2,
    height: Number(output.info?.height) || height + padding * 2,
    size: output.data.length,
    padding,
  };
}

export async function createAvatarCutout({ sourceUrl, objectKey }) {
  if (!/^https:\/\//i.test(clean(sourceUrl))) throw new Error("avatar_source_url_missing");
  if (!clean(objectKey)) throw new Error("avatar_cutout_key_missing");

  const generated = await requestCutout(sourceUrl);
  const downloaded = await downloadBuffer(generated.url);
  const processed = await normalizeTransparentPng(downloaded);
  const url = await putObject({
    key: objectKey,
    body: processed.buffer,
    contentLength: processed.size,
    contentType: "image/png",
    cacheControl: "public, max-age=31536000, immutable",
    contentDisposition: "inline",
  });

  return {
    url,
    key: objectKey,
    width: processed.width,
    height: processed.height,
    size: processed.size,
    padding: processed.padding,
    contentType: "image/png",
    provider: "fal",
    model: MODEL,
    profile: "Portrait",
    operatingResolution: "2048x2048",
    refineForeground: true,
  };
}
