import crypto from "crypto";
import sharp from "sharp";
import { putObject } from "./r2.js";
import { mediaPrefix } from "./ad-film-projects.js";
import { downloadImageBuffer, normalizeMediaBuffer } from "./ad-film-image-normalizer.js";

const FINALIZER_LOGO_VERSION = 2;
const MAX_INPUT_PIXELS = 80_000_000;

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function safeName(value, fallback = "logo") {
  const next = clean(value, 160)
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function finalDisplayWidth(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 300;
  if (value === "1080p") return 178;
  if (value === "720p") return 128;
  return 90;
}

function finalMargin(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 72;
  if (value === "1080p") return 40;
  if (value === "720p") return 28;
  return 20;
}

function preset({ resolution, aspectRatio, sourceWidth, sourceHeight, targetWidth, targetHeight }) {
  return [
    `v${FINALIZER_LOGO_VERSION}`,
    "original-source",
    clean(resolution, 20).toLowerCase(),
    clean(aspectRatio, 20),
    `${sourceWidth}x${sourceHeight}`,
    `${targetWidth}x${targetHeight}`,
  ].join(":");
}

export async function prepareFinalizerLogoAsset({
  user,
  projectId,
  item,
  resolution,
  aspectRatio,
  nativeMode = false,
}) {
  if (!user || !projectId || !item) throw new Error("missing_finalizer_logo_context");

  const sourceUrl = clean(
    item.sourceUrl || item.renderSourceUrl || item.normalizedSourceUrl || item.url || item.readUrl || item.publicUrl,
    8000,
  );
  if (!sourceUrl) throw new Error("missing_finalizer_logo_source");

  const sourceBuffer = await downloadImageBuffer(sourceUrl);
  const normalized = await normalizeMediaBuffer(sourceBuffer, "logo");
  const sourceWidth = Math.max(1, Number(normalized.metadata?.width) || 1);
  const sourceHeight = Math.max(1, Number(normalized.metadata?.height) || 1);

  // Always start from the uploaded logo (trimmed to transparent PNG), never
  // from a previously generated low-resolution finalizer asset. The only
  // resize happens once, at the final on-video display size, with Lanczos.
  const targetWidth = finalDisplayWidth(resolution);
  const targetHeight = Math.max(2, Math.round(sourceHeight * (targetWidth / sourceWidth)));
  const nextPreset = preset({
    resolution,
    aspectRatio,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  });

  if (
    item.finalizerLogoPreset === nextPreset &&
    item.finalizerLogoVersion === FINALIZER_LOGO_VERSION &&
    clean(item.url, 8000)
  ) {
    return item;
  }

  const rendered = await sharp(normalized.buffer, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const key = `${mediaPrefix(user, projectId)}normalized/logo-render/${Date.now()}-${id}-${safeName(item.name || "logo")}.png`;
  const url = await putObject({
    key,
    body: rendered,
    contentLength: rendered.length,
    contentType: "image/png",
    cacheControl: "public, max-age=31536000, immutable",
    contentDisposition: "inline",
  });

  return {
    ...item,
    key,
    url,
    publicUrl: url,
    readUrl: url,
    contentType: "image/png",
    size: rendered.length,
    normalized: true,
    renderSourceKey: item.renderSourceKey || item.sourceKey || item.key || null,
    renderSourceUrl: sourceUrl,
    finalizerLogoVersion: FINALIZER_LOGO_VERSION,
    finalizerLogoPreset: nextPreset,
    finalizerLogoPreparedAt: new Date().toISOString(),
    finalizerLogo: {
      sourceWidth,
      sourceHeight,
      visibleWidth: targetWidth,
      visibleHeight: targetHeight,
      canvasWidth: targetWidth,
      canvasHeight: targetHeight,
      leftPadding: 0,
      fixedMargin: finalMargin(resolution),
      aspectRatio: clean(aspectRatio, 20),
      resolution: clean(resolution, 20).toLowerCase(),
      nativeMode: Boolean(nativeMode),
      placement: "bottom-right",
      preserveAspectRatio: true,
      sourceQualityPreserved: true,
      resizePasses: 1,
      resizeKernel: "lanczos3",
    },
  };
}
