import crypto from "crypto";
import sharp from "sharp";
import { putObject } from "./r2.js";
import { buildPublicUrl, mediaPrefix } from "./ad-film-projects.js";

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_INPUT_PIXELS = 80_000_000;
const PRODUCT_MAX_EDGE = 2048;
const LOGO_MAX_WIDTH = 2048;
const LOGO_MAX_HEIGHT = 1024;

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function safeName(value, fallback = "media") {
  const next = clean(value, 160)
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function colorDistance(a, b) {
  return Math.max(
    Math.abs(Number(a?.r || 0) - Number(b?.r || 0)),
    Math.abs(Number(a?.g || 0) - Number(b?.g || 0)),
    Math.abs(Number(a?.b || 0) - Number(b?.b || 0)),
  );
}

function averageColor(colors) {
  if (!colors.length) return null;
  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b,
      a: sum.a + color.a,
    }),
    { r: 0, g: 0, b: 0, a: 0 },
  );
  return {
    r: Math.round(total.r / colors.length),
    g: Math.round(total.g / colors.length),
    b: Math.round(total.b / colors.length),
    a: Math.round(total.a / colors.length),
  };
}

function cornerColor(data, info, x, y) {
  const offset = (y * info.width + x) * info.channels;
  return {
    r: data[offset] || 0,
    g: data[offset + 1] || 0,
    b: data[offset + 2] || 0,
    a: info.channels >= 4 ? data[offset + 3] : 255,
  };
}

function dominantEdgeBackground(data, info) {
  const points = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ];
  const colors = points.map(([x, y]) => cornerColor(data, info, x, y));
  const opaque = colors.filter((color) => color.a >= 245);
  if (opaque.length < 3) return null;

  for (const candidate of opaque) {
    const similar = opaque.filter((color) => colorDistance(color, candidate) <= 18);
    if (similar.length >= 3) return averageColor(similar);
  }
  return null;
}

function removeConnectedEdgeBackground(data, info, background) {
  if (!background || info.channels < 4) return false;
  const tolerance = 28;
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let removed = 0;

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * info.channels;
    const alpha = data[offset + 3];
    if (alpha < 8) {
      visited[index] = 1;
      return;
    }
    const pixel = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
    if (colorDistance(pixel, background) > tolerance) return;
    visited[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * info.channels;
    data[offset + 3] = 0;
    removed += 1;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  return removed >= Math.max(16, Math.floor(width * height * 0.002));
}

async function normalizeLogo(buffer) {
  const source = sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  }).rotate().ensureAlpha();

  const raw = await source.raw().toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data);
  const background = dominantEdgeBackground(data, raw.info);
  const backgroundRemoved = removeConnectedEdgeBackground(data, raw.info, background);

  let pipeline = sharp(data, { raw: raw.info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .resize({
      width: LOGO_MAX_WIDTH,
      height: LOGO_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true });

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  if (!output.info.width || !output.info.height) throw new Error("normalized_logo_empty");

  return {
    buffer: output.data,
    contentType: "image/png",
    extension: "png",
    metadata: {
      sourceWidth: raw.info.width,
      sourceHeight: raw.info.height,
      width: output.info.width,
      height: output.info.height,
      aspectRatio: Number((output.info.width / output.info.height).toFixed(5)),
      hasAlpha: true,
      edgeBackgroundRemoved: backgroundRemoved,
      transparentTrimmed: true,
      fit: "contain",
      preserveAspectRatio: true,
    },
  };
}

async function normalizeProductImage(buffer) {
  const input = sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  }).rotate();
  const sourceMeta = await input.metadata();
  if (!sourceMeta.width || !sourceMeta.height) throw new Error("invalid_product_image_dimensions");

  let pipeline = sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  }).rotate();

  if (sourceMeta.hasAlpha) {
    pipeline = pipeline.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 });
  }

  pipeline = pipeline.resize({
    width: PRODUCT_MAX_EDGE,
    height: PRODUCT_MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
    kernel: sharp.kernel.lanczos3,
  });

  const usePng = Boolean(sourceMeta.hasAlpha);
  pipeline = usePng
    ? pipeline.png({ compressionLevel: 8, adaptiveFiltering: true })
    : pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true });

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  if (!output.info.width || !output.info.height) throw new Error("normalized_product_image_empty");

  return {
    buffer: output.data,
    contentType: usePng ? "image/png" : "image/jpeg",
    extension: usePng ? "png" : "jpg",
    metadata: {
      sourceWidth: sourceMeta.width,
      sourceHeight: sourceMeta.height,
      width: output.info.width,
      height: output.info.height,
      aspectRatio: Number((output.info.width / output.info.height).toFixed(5)),
      hasAlpha: usePng,
      transparentTrimmed: usePng,
      fit: "inside",
      preserveAspectRatio: true,
      maxEdge: PRODUCT_MAX_EDGE,
    },
  };
}

export async function downloadImageBuffer(url, maxBytes = MAX_INPUT_BYTES) {
  const sourceUrl = clean(url, 8000);
  if (!/^https:\/\//i.test(sourceUrl)) throw new Error("invalid_media_url");

  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch(sourceUrl, {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`media_download_failed:${response.status}`);
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > maxBytes) throw new Error("media_input_too_large");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > maxBytes) throw new Error("invalid_media_input_size");
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
    }
  }
  throw lastError || new Error("media_download_failed");
}

export async function normalizeMediaBuffer(buffer, kind) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_INPUT_BYTES) {
    throw new Error("invalid_media_input_size");
  }
  if (kind === "logo") return normalizeLogo(buffer);
  if (kind === "product-image") return normalizeProductImage(buffer);
  throw new Error("unsupported_normalization_kind");
}

export async function normalizeStoredMedia({ user, projectId, item, kind }) {
  if (!user || !projectId || !item) throw new Error("missing_normalization_context");
  const sourceUrl = clean(item.readUrl || item.url || item.publicUrl || buildPublicUrl(item.key), 8000);
  const source = await downloadImageBuffer(sourceUrl);
  const normalized = await normalizeMediaBuffer(source, kind);
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const baseName = safeName(item.name || kind, kind);
  const key = `${mediaPrefix(user, projectId)}normalized/${kind}/${Date.now()}-${id}-${baseName}.${normalized.extension}`;
  const url = await putObject({
    key,
    body: normalized.buffer,
    contentLength: normalized.buffer.length,
    contentType: normalized.contentType,
    cacheControl: "public, max-age=31536000, immutable",
    contentDisposition: "inline",
  });

  return {
    ...item,
    key,
    url,
    publicUrl: url,
    readUrl: url,
    contentType: normalized.contentType,
    size: normalized.buffer.length,
    kind,
    normalized: true,
    normalizedAt: new Date().toISOString(),
    normalizationVersion: 1,
    normalization: normalized.metadata,
    sourceKey: item.sourceKey || item.key || null,
    sourceUrl: item.sourceUrl || sourceUrl,
  };
}

export function expectedMediaFolder(kind) {
  if (kind === "logo") return "logo";
  if (kind === "product-image") return "product-images";
  return "";
}

export function calculateLogoSafeBox(frameWidth, frameHeight, aspectRatio, logoMeta = {}) {
  const width = Math.max(2, Number(frameWidth) || 2);
  const height = Math.max(2, Number(frameHeight) || 2);
  const ratio = clean(aspectRatio, 20);
  const portrait = ["9:16", "4:5", "3:4"].includes(ratio) || width < height;
  const square = ratio === "1:1" || Math.abs(width / height - 1) < 0.08;
  const maxWidthRatio = portrait ? 0.18 : square ? 0.14 : 0.11;
  const maxHeightRatio = portrait ? 0.072 : square ? 0.09 : 0.10;
  const marginXRatio = portrait ? 0.035 : 0.024;
  const marginYRatio = portrait ? 0.024 : 0.032;
  const logoWidth = Math.max(1, Number(logoMeta.width) || 1);
  const logoHeight = Math.max(1, Number(logoMeta.height) || 1);
  const scale = Math.min(
    (width * maxWidthRatio) / logoWidth,
    (height * maxHeightRatio) / logoHeight,
  );
  const targetWidth = Math.max(2, Math.round(logoWidth * scale));
  const targetHeight = Math.max(2, Math.round(logoHeight * scale));
  return {
    targetWidth,
    targetHeight,
    marginX: Math.max(8, Math.round(width * marginXRatio)),
    marginY: Math.max(8, Math.round(height * marginYRatio)),
    maxWidth: Math.round(width * maxWidthRatio),
    maxHeight: Math.round(height * maxHeightRatio),
    placement: "bottom-right",
    fit: "contain",
    preserveAspectRatio: true,
  };
}
