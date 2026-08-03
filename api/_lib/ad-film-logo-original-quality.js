import crypto from "crypto";
import sharp from "sharp";
import { putObject } from "./r2.js";
import { mediaPrefix } from "./ad-film-projects.js";
import { downloadImageBuffer } from "./ad-film-image-normalizer.js";

const FINALIZER_LOGO_VERSION = 4;
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

function finalMargin(resolution) {
  const value = clean(resolution, 20).toLowerCase();
  if (value === "4k") return 72;
  return 40;
}

// finalize-v2 currently displays the logo at these exact widths. Preparing the
// asset once with Sharp/Lanczos means FFmpeg receives an already final-sized
// lossless PNG and its legacy scale filter performs no destructive resize.
function finalDisplayWidth(resolution) {
  return clean(resolution, 20).toLowerCase() === "4k" ? 300 : 178;
}

function isSvgBuffer(buffer, item) {
  if (/svg/i.test(clean(item?.contentType, 120))) return true;
  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf8");
  return /<svg[\s>]/i.test(head);
}

function preset({ resolution, aspectRatio, sourceWidth, sourceHeight, targetWidth, svg }) {
  return [
    `v${FINALIZER_LOGO_VERSION}`,
    "final-size-lanczos",
    clean(resolution, 20).toLowerCase(),
    clean(aspectRatio, 20),
    `${sourceWidth}x${sourceHeight}`,
    `${targetWidth}px`,
    svg ? "svg600" : "raster",
  ].join(":");
}

async function renderFinalLogo(buffer, item, resolution) {
  const svg = isSvgBuffer(buffer, item);
  const options = {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
    ...(svg ? { density: 600 } : {}),
  };

  const probe = sharp(buffer, options).rotate();
  const sourceMetadata = await probe.metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error("invalid_finalizer_logo_dimensions");
  }

  const targetWidth = finalDisplayWidth(resolution);
  const rendered = await sharp(buffer, options)
    .rotate()
    .ensureAlpha()
    // Trim only transparent outside space. Do not run color-based background
    // removal here because it can erase black/dark logo pixels and create glow.
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .resize({
      width: targetWidth,
      fit: "inside",
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    // finalize-v2's old black-edge cleanup examines RGB even when alpha is 0.
    // Transparent white guard pixels stop that flood-fill from entering a dark
    // logo. The guard is trimmed again by the finalizer and is never visible.
    .extend({
      top: 2,
      right: 2,
      bottom: 2,
      left: 2,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: rendered.data,
    sourceWidth: sourceMetadata.width,
    sourceHeight: sourceMetadata.height,
    canvasWidth: rendered.info.width,
    canvasHeight: rendered.info.height,
    visibleWidth: targetWidth,
    visibleHeight: Math.max(1, rendered.info.height - 4),
    targetWidth,
    svg,
    density: svg ? 600 : null,
  };
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

  // Always start from the originally uploaded source when it is available.
  // Never recursively prepare an already resized finalizer asset.
  const sourceUrl = clean(
    item.sourceUrl || item.originalUrl || item.uploadUrl || item.renderSourceUrl ||
      item.normalizedSourceUrl || item.url || item.readUrl || item.publicUrl,
    8000,
  );
  if (!sourceUrl) throw new Error("missing_finalizer_logo_source");

  const sourceBuffer = await downloadImageBuffer(sourceUrl);
  const output = await renderFinalLogo(sourceBuffer, item, resolution);
  const nextPreset = preset({
    resolution,
    aspectRatio,
    sourceWidth: output.sourceWidth,
    sourceHeight: output.sourceHeight,
    targetWidth: output.targetWidth,
    svg: output.svg,
  });

  if (
    item.finalizerLogoPreset === nextPreset &&
    item.finalizerLogoVersion === FINALIZER_LOGO_VERSION &&
    clean(item.url, 8000)
  ) {
    return item;
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const key = `${mediaPrefix(user, projectId)}normalized/logo-render/${Date.now()}-${id}-${safeName(item.name || "logo")}.png`;
  const url = await putObject({
    key,
    body: output.buffer,
    contentLength: output.buffer.length,
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
    size: output.buffer.length,
    normalized: true,
    renderSourceKey: item.renderSourceKey || item.sourceKey || item.key || null,
    renderSourceUrl: sourceUrl,
    finalizerLogoVersion: FINALIZER_LOGO_VERSION,
    finalizerLogoPreset: nextPreset,
    finalizerLogoPreparedAt: new Date().toISOString(),
    finalizerLogo: {
      sourceWidth: output.sourceWidth,
      sourceHeight: output.sourceHeight,
      visibleWidth: output.visibleWidth,
      visibleHeight: output.visibleHeight,
      canvasWidth: output.canvasWidth,
      canvasHeight: output.canvasHeight,
      leftPadding: 0,
      guardPadding: 2,
      fixedMargin: finalMargin(resolution),
      aspectRatio: clean(aspectRatio, 20),
      resolution: clean(resolution, 20).toLowerCase(),
      nativeMode: Boolean(nativeMode),
      placement: "bottom-right",
      preserveAspectRatio: true,
      sourceQualityPreserved: true,
      vectorRasterizedAtDensity: output.density,
      resizePasses: 1,
      finalResizeOwner: "sharp-prepared-final-size",
      finalResizeKernel: "lanczos3",
      colorBackgroundRemoval: false,
      fullOpacity: true,
    },
  };
}
