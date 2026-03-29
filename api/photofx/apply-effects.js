// api/photofx/apply-effects.js
// CommonJS
// PhotoFX effects apply stage:
// input: provider/mux/logo_overlay/finalized video + meta.effects.effectConfig
// process: overlay + lut + color eq + optional stylized composite
// output: R2 effects_applied mp4 + DB meta/output patch

const { neon } = require("@neondatabase/serverless");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function isUuidLike(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

function pickUrl(o) {
  return String(
    o?.archive_url ||
      o?.url ||
      o?.video_url ||
      o?.meta?.archive_url ||
      o?.meta?.url ||
      o?.meta?.video_url ||
      ""
  ).trim();
}

function normVariant(o) {
  return String(o?.meta?.variant || "").toLowerCase().trim();
}

function isVideo(o) {
  return String(o?.type || "").toLowerCase().trim() === "video";
}

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(arr = []) {
  return [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
}

function ensureAbsoluteAssetPath(relPath) {
  const clean = String(relPath || "").trim().replace(/^\/+/, "");
  if (!clean) return "";
  return path.join(process.cwd(), clean);
}

function stripLeadingSlashes(v) {
  return String(v || "").trim().replace(/^\/+/, "");
}

function isHttpUrl(v) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

function getAssetPublicBase() {
  return String(
    process.env.R2_PUBLIC_BASE_URL ||
      process.env.R2_PUBLIC_BASE ||
      "https://media.aivo.tr"
  ).replace(/\/$/, "");
}

function buildAssetPublicUrl(assetPath) {
  const raw = String(assetPath || "").trim();
  if (!raw) return "";
  if (isHttpUrl(raw)) return raw;
  return `${getAssetPublicBase()}/${stripLeadingSlashes(raw)}`;
}

function isDirectoryLikeAssetPath(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  if (s.endsWith("/")) return true;
  return !path.extname(s);
}

async function statSafe(p) {
  try {
    return await fsp.stat(p);
  } catch {
    return null;
  }
}

async function streamToBuffer(body) {
  if (!body) return Buffer.from([]);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  if (typeof body.transformToByteArray === "function") {
    const arr = await body.transformToByteArray();
    return Buffer.from(arr);
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadPublicUrlToFile(url, outPath) {
  const r = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!r.ok) {
    throw new Error(`asset_public_download_failed:${r.status}:${url}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await fsp.writeFile(outPath, buf);
}

async function downloadR2KeyToFile(key, outPath) {
  if (!process.env.R2_BUCKET) {
    throw new Error("missing_env:R2_BUCKET");
  }

  const r2 = getR2Client();
  const obj = await r2.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    })
  );

  const buf = await streamToBuffer(obj.Body);
  await fsp.writeFile(outPath, buf);
}

async function listR2KeysForPrefix(prefix, exts = []) {
  if (!process.env.R2_BUCKET) return [];

  const cleanPrefix = stripLeadingSlashes(prefix);
  if (!cleanPrefix) return [];

  const r2 = getR2Client();
  const out = [];
  let token = undefined;

  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        Prefix: cleanPrefix,
        ContinuationToken: token,
      })
    );

    const items = Array.isArray(res?.Contents) ? res.Contents : [];
    for (const item of items) {
      const key = String(item?.Key || "").trim();
      if (!key) continue;
      if (key.endsWith("/")) continue;

      const ext = path.extname(key).toLowerCase();
      if (exts.length && !exts.includes(ext)) continue;

      out.push(key);
    }

    token = res?.IsTruncated ? res?.NextContinuationToken : undefined;
  } while (token);

  out.sort();
  return out;
}

function seededHash(input) {
  const s = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pickDeterministic(list = [], seed = "", count = 1) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (!arr.length || count <= 0) return [];

  const out = [];
  const used = new Set();
  let h = seededHash(seed);

  while (out.length < Math.min(count, arr.length)) {
    const idx = h % arr.length;
    const item = arr[idx];
    if (!used.has(item)) {
      used.add(item);
      out.push(item);
    }
    h = seededHash(`${seed}:${h}:${out.length}`);
  }

  return out;
}

async function collectFilesFromPaths(pathsInput = [], exts = [], maxFilesPerDir = 4) {
  const out = [];
  const seen = new Set();

  for (const raw of uniqStrings(pathsInput)) {
    const clean = String(raw || "").trim();
    if (!clean) continue;

    const abs = ensureAbsoluteAssetPath(clean);
    const localStat = await statSafe(abs);

    if (localStat?.isFile()) {
      const ext = path.extname(abs).toLowerCase();
      if (!exts.length || exts.includes(ext)) {
        if (!seen.has(abs)) {
          seen.add(abs);
          out.push(abs);
        }
      }
      continue;
    }

    if (localStat?.isDirectory()) {
      const names = await fsp.readdir(abs).catch(() => []);
      const pickedLocalNames = pickDeterministic(
        names,
        `local:${clean}:${exts.join(",")}`,
        maxFilesPerDir
      );

      for (const name of pickedLocalNames) {
        const file = path.join(abs, name);
        const fst = await statSafe(file);
        if (!fst || !fst.isFile()) continue;

        const ext = path.extname(file).toLowerCase();
        if (exts.length && !exts.includes(ext)) continue;
        if (seen.has(file)) continue;

        seen.add(file);
        out.push(file);
      }
      continue;
    }

    if (isHttpUrl(clean) && !isDirectoryLikeAssetPath(clean)) {
      const ext = path.extname(clean).toLowerCase();
      if (exts.length && !exts.includes(ext)) continue;

      const tmpFile = path.join(
        os.tmpdir(),
        `aivo-asset-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}${ext || ".bin"}`
      );

      await downloadPublicUrlToFile(clean, tmpFile);

      if (!seen.has(tmpFile)) {
        seen.add(tmpFile);
        out.push(tmpFile);
      }
      continue;
    }

    const keyOrPrefix = stripLeadingSlashes(clean);

    if (isDirectoryLikeAssetPath(clean)) {
      const keys = await listR2KeysForPrefix(keyOrPrefix, exts);
      const pickedKeys = pickDeterministic(
        keys,
        `collect:${clean}:${exts.join(",")}`,
        maxFilesPerDir
      );

      for (const key of pickedKeys) {
        if (seen.has(key)) continue;

        const tmpFile = path.join(
          os.tmpdir(),
          `aivo-asset-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}-${path.basename(key)}`
        );

        try {
          await downloadR2KeyToFile(key, tmpFile);
        } catch {
          await downloadPublicUrlToFile(buildAssetPublicUrl(key), tmpFile);
        }

        seen.add(key);
        out.push(tmpFile);
      }

      continue;
    }

    const ext = path.extname(keyOrPrefix).toLowerCase();
    if (exts.length && !exts.includes(ext)) continue;

    const tmpFile = path.join(
      os.tmpdir(),
      `aivo-asset-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}-${path.basename(keyOrPrefix)}`
    );

    try {
      await downloadR2KeyToFile(keyOrPrefix, tmpFile);
    } catch {
      await downloadPublicUrlToFile(buildAssetPublicUrl(keyOrPrefix), tmpFile);
    }

    if (!seen.has(keyOrPrefix)) {
      seen.add(keyOrPrefix);
      out.push(tmpFile);
    }
  }

  out.sort();
  return out;
}

function normalizeNumber(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const PHOTOFX_STYLE_ASSET_MAP = {
  "neon-pulse": {
    overlayPaths: [
      "assets/photofx/overlays/light-leaks/",
      "assets/photofx/overlays/prism-lens/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "shake-edit": {
    overlayPaths: ["assets/photofx/overlays/film-burns-flash/"],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "glitch-scan": {
    overlayPaths: [
      "assets/photofx/overlays/vhs-glitch/",
      "assets/photofx/overlays/glitch-noise/",
      "assets/photofx/overlays/hud-graphic-overlay/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "split-flash": {
    overlayPaths: [
      "assets/photofx/overlays/film-burns-flash/",
      "assets/photofx/overlays/light-leaks/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "cinematic-zoom": {
    overlayPaths: [
      "assets/photofx/overlays/dust-particles/",
      "assets/photofx/overlays/light-leaks/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "aura-glow": {
    overlayPaths: [
      "assets/photofx/overlays/prism-lens/",
      "assets/photofx/overlays/light-leaks/",
      "assets/photofx/overlays/dust-particles/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "fire-edge": {
    overlayPaths: [
      "assets/photofx/overlays/sparks-fire/",
      "assets/photofx/overlays/smoke-fog/",
      "assets/photofx/overlays/film-burns-flash/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "dark-trap-motion": {
    overlayPaths: [
      "assets/photofx/overlays/smoke-fog/",
      "assets/photofx/overlays/dust-particles/",
      "assets/photofx/overlays/glitch-noise/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
};

function resolveEffectMeta(meta = {}) {
  const effects = meta?.effects || {};
  const effectConfig = effects?.effectConfig || {};
  const doseProfile = effectConfig?.doseProfile || {};
  const runtime = effectConfig?.runtime || {};

  const preset = String(
    meta?.preset || effects?.preset || effectConfig?.preset || ""
  )
    .trim()
    .toLowerCase();

  const styles = uniqStrings(
    []
      .concat(toArray(meta?.styles))
      .concat(toArray(effects?.styles))
  ).map((x) => x.toLowerCase());

  const presetAssets =
    PHOTOFX_STYLE_ASSET_MAP[String(preset || "").toLowerCase()] || {};

  const mergedOverlayPaths = uniqStrings(
    (effectConfig?.overlayPaths && effectConfig.overlayPaths.length
      ? effectConfig.overlayPaths
      : presetAssets.overlayPaths || []
    ).filter(Boolean)
  );

  const mergedLutPaths = uniqStrings(
    (effectConfig?.lutPaths && effectConfig.lutPaths.length
      ? effectConfig.lutPaths
      : presetAssets.lutPaths || []
    ).filter(Boolean)
  );

  return {
    preset,
    styles,
    overlayPaths: mergedOverlayPaths,
    lutPaths: mergedLutPaths,
    doseProfile: {
      zoomAmount: normalizeNumber(doseProfile?.zoomAmount, 0.05, 0.0, 0.25),
      shakeAmount: normalizeNumber(doseProfile?.shakeAmount, 0.02, 0.0, 0.2),
      blurAmount: normalizeNumber(doseProfile?.blurAmount, 0.04, 0.0, 0.3),
      glowAmount: normalizeNumber(doseProfile?.glowAmount, 0.08, 0.0, 0.6),
      overlayOpacity: normalizeNumber(
        doseProfile?.overlayOpacity,
        0.18,
        0.0,
        0.7
      ),
      secondaryOpacity: normalizeNumber(
        doseProfile?.secondaryOpacity,
        0.08,
        0.0,
        0.35
      ),
      lutIntensity: normalizeNumber(doseProfile?.lutIntensity, 0.3, 0.0, 1.0),
      maxOverlayCount: normalizeNumber(
        doseProfile?.maxOverlayCount,
        2,
        1,
        4
      ),
      blendMode: String(doseProfile?.blendMode || "screen")
        .trim()
        .toLowerCase(),
    },
    runtime: {
      colorMood: String(runtime?.colorMood || meta?.color_mood || "original")
        .trim()
        .toLowerCase(),
      motionLevel: String(
        runtime?.motionLevel || meta?.motion_level || "balanced"
      )
        .trim()
        .toLowerCase(),
      effectStrength: String(
        runtime?.effectStrength || meta?.effect_strength || "medium"
      )
        .trim()
        .toLowerCase(),
      transitionSpeed: String(
        runtime?.transitionSpeed || meta?.transition_speed || "normal"
      )
        .trim()
        .toLowerCase(),
    },
  };
}

function buildColorEq(effectMeta = {}) {
  const mood = String(
    effectMeta?.runtime?.colorMood || "original"
  ).toLowerCase();
  const strength = String(
    effectMeta?.runtime?.effectStrength || "medium"
  ).toLowerCase();

  let saturation = 1.0;
  let contrast = 1.0;
  let brightness = 0.0;
  let gamma = 1.0;

  if (mood === "warm") {
    saturation += 0.08;
    contrast += 0.04;
    brightness += 0.01;
  } else if (mood === "cold") {
    saturation -= 0.04;
    contrast += 0.03;
    gamma += 0.02;
  } else if (mood === "dark") {
    saturation -= 0.08;
    contrast += 0.10;
    brightness -= 0.03;
    gamma -= 0.02;
  } else if (mood === "neon") {
    saturation += 0.10;
    contrast += 0.06;
    brightness += 0.01;
    gamma += 0.01;
  } else if (mood === "cinematic") {
    saturation -= 0.02;
    contrast += 0.05;
    gamma += 0.02;
  }

  if (strength === "low" || strength === "light") {
    saturation *= 1.03;
    contrast *= 1.02;
  } else if (strength === "high") {
    saturation *= 1.12;
    contrast *= 1.10;
    brightness += 0.01;
  }

  return `eq=saturation=${saturation.toFixed(
    3
  )}:contrast=${contrast.toFixed(3)}:brightness=${brightness.toFixed(
    3
  )}:gamma=${gamma.toFixed(3)}`;
}

function buildTargetScaleExpr(targetWidth = 0, targetHeight = 0) {
  const w = Math.max(2, Math.floor(Number(targetWidth || 0) / 2) * 2);
  const h = Math.max(2, Math.floor(Number(targetHeight || 0) / 2) * 2);

  if (!w || !h) {
    return "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  }

  return `scale=${w}:${h}`;
}

function buildBaseVisualFilter(effectMeta = {}, targetWidth = 0, targetHeight = 0) {
  const parts = [];
  const preset = String(effectMeta?.preset || "").toLowerCase();
  const styles = Array.isArray(effectMeta?.styles) ? effectMeta.styles : [];
  const has = (name) => preset === name || styles.includes(name);
  const targetScale = buildTargetScaleExpr(targetWidth, targetHeight);

  parts.push(targetScale);
  parts.push(buildColorEq(effectMeta));

  if (has("shake-edit") || has("split-flash") || has("dark-trap-motion")) {
    parts.push(
      "crop=iw*0.965:ih*0.965:(iw-iw*0.965)/2+sin(t*12)*18:(ih-ih*0.965)/2+cos(t*15)*10"
    );
    parts.push(targetScale);
  }

  if (has("cinematic-zoom")) {
    parts.push("crop=iw*0.94:ih*0.94:(iw-iw*0.94)/2:(ih-ih*0.94)/2");
    parts.push(targetScale);
  }

  if (has("neon-pulse") || has("aura-glow")) {
    parts.push("gblur=sigma=0.8");
    parts.push("unsharp=5:5:1.15:5:5:0.0");
  }

  if (has("glitch-scan")) {
    parts.push("noise=alls=12:allf=t");
  }

  parts.push(targetScale);
  parts.push("fps=25");
  parts.push("format=yuv420p");

  return parts.join(",");
}

function buildOverlayEnableExpr(durationSec, effectMeta = {}, index = 0) {
  const total = Math.max(0.5, Number(durationSec || 6));
  const startBase = Math.max(0, 0.15 + index * 0.18);
  const endBase = Math.min(total, total - 0.12 + index * 0.03);

  if (
    String(effectMeta?.preset || "").toLowerCase() === "split-flash" ||
    (Array.isArray(effectMeta?.styles) &&
      effectMeta.styles.includes("split-flash"))
  ) {
    const burst = Math.min(total * 0.22, 0.9);
    const start = Math.max(0, startBase);
    const end = Math.min(total, start + burst);
    return `between(t,${start.toFixed(3)},${end.toFixed(
      3
    )})+between(t,${(total * 0.72).toFixed(3)},${Math.min(
      total,
      total * 0.72 + burst
    ).toFixed(3)})`;
  }

  return `between(t,${startBase.toFixed(3)},${endBase.toFixed(3)})`;
}

async function runFfmpegWithArgs(args, errorPrefix) {
  await new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${errorPrefix}:${code}:${stderr.slice(-1600)}`));
    });
  });
}

async function downloadToFile(url, outPath) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`download_failed:${r.status}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await fsp.writeFile(outPath, buf);
}

async function probeVideoInfo(inputPath) {
  return await new Promise((resolve, reject) => {
    const args = ["-i", inputPath];
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", () => {
      const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      const videoMatch = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/i);

      let durationSec = 0;
      if (durationMatch) {
        const hh = Number(durationMatch[1] || 0);
        const mm = Number(durationMatch[2] || 0);
        const ss = Number(durationMatch[3] || 0);
        durationSec = hh * 3600 + mm * 60 + ss;
      }

      const width = Number(videoMatch?.[1] || 0);
      const height = Number(videoMatch?.[2] || 0);

      resolve({
        durationSec: Number.isFinite(durationSec) ? durationSec : 0,
        width: Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
      });
    });
  });
}

async function canOpenMediaInput(inputPath) {
  return await new Promise((resolve) => {
    const args = [
      "-v",
      "error",
      "-i",
      inputPath,
      "-t",
      "0.1",
      "-f",
      "null",
      "-",
    ];

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", () => resolve(false));

    p.on("close", (code) => {
      if (code === 0) return resolve(true);

      const errText = String(stderr || "").toLowerCase();
      if (
        errText.includes("moov atom not found") ||
        errText.includes("invalid data found when processing input") ||
        errText.includes("error opening input") ||
        errText.includes("cannot determine format")
      ) {
        return resolve(false);
      }

      return resolve(false);
    });
  });
}

async function runPhotofxEffectsApply({
  inputPath,
  outputPath,
  effectMeta,
  durationSec = 6,
  baseWidth = 0,
  baseHeight = 0,
  seed = "",
}) {
  const safeMeta = effectMeta || resolveEffectMeta({});
  const safePreset = String(safeMeta?.preset || "").trim().toLowerCase();
  const safeStyles = Array.isArray(safeMeta?.styles)
    ? safeMeta.styles.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const overlayFilesAll = await collectFilesFromPaths(
    safeMeta?.overlayPaths || [],
    [".mp4", ".mov", ".webm"],
    4
  );

  const lutFilesAll = await collectFilesFromPaths(
    safeMeta?.lutPaths || [],
    [".cube", ".3dl"],
    2
  );

  const overlaySourcePaths = uniqStrings(safeMeta?.overlayPaths || []);
  const lutSourcePaths = uniqStrings(safeMeta?.lutPaths || []);

  const maxOverlayCount = Math.max(
    1,
    Math.min(4, Number(safeMeta?.doseProfile?.maxOverlayCount || 1))
  );

  const overlayFiles = pickDeterministic(
    overlayFilesAll,
    `${seed}:${safePreset}:${safeStyles.join(",")}:overlay`,
    maxOverlayCount
  );

  const overlayValidation = await Promise.all(
    overlayFiles.map(async (file) => {
      const ok = await canOpenMediaInput(file);
      return { file, ok };
    })
  );

  const safeOverlayFiles = overlayValidation.filter((x) => x.ok).map((x) => x.file);
  const rejectedOverlayFiles = overlayValidation.filter((x) => !x.ok).map((x) => x.file);

  if (safeOverlayFiles.length < maxOverlayCount) {
    const fallbackCandidates = overlayFilesAll.filter(
      (file) =>
        !safeOverlayFiles.includes(file) &&
        !rejectedOverlayFiles.includes(file)
    );

    for (const file of fallbackCandidates) {
      const ok = await canOpenMediaInput(file);
      if (!ok) {
        rejectedOverlayFiles.push(file);
        continue;
      }

      safeOverlayFiles.push(file);

      if (safeOverlayFiles.length >= maxOverlayCount) {
        break;
      }
    }
  }

  console.log("[photofx/runPhotofxEffectsApply] asset collect debug =", {
    preset: safePreset,
    styles: safeStyles,
    overlaySourcePaths,
    lutSourcePaths,
    overlayFilesAllCount: overlayFilesAll.length,
    lutFilesAllCount: lutFilesAll.length,
    overlayFilesAllSample: overlayFilesAll.slice(0, 10),
    lutFilesAllSample: lutFilesAll.slice(0, 10),
    baseWidth,
    baseHeight,
  });

  const lutFiles = pickDeterministic(
    lutFilesAll,
    `${seed}:${safePreset}:${safeStyles.join(",")}:lut`,
    1
  );

  const shouldProcess =
    !!safePreset ||
    safeStyles.length > 0 ||
    overlaySourcePaths.length > 0 ||
    lutSourcePaths.length > 0;

  if (!shouldProcess) {
    await fsp.copyFile(inputPath, outputPath);
    return {
      ok: true,
      applied: false,
      mode: "passthrough_copy",
      preset: safePreset,
      styles: safeStyles,
      outputPath,
      overlay_assets_found: overlayFilesAll,
      overlay_assets_used: [],
      lut_assets_found: lutFilesAll,
      lut_assets_used: [],
    };
  }

  if (!baseWidth || !baseHeight) {
    throw new Error("base_video_dimensions_missing");
  }

  const normalizedBaseWidth = Math.max(2, Math.floor(Number(baseWidth || 0) / 2) * 2);
  const normalizedBaseHeight = Math.max(2, Math.floor(Number(baseHeight || 0) / 2) * 2);

  const baseFilter = buildBaseVisualFilter(
    safeMeta,
    normalizedBaseWidth,
    normalizedBaseHeight
  );

  const inputs = ["-y", "-i", inputPath];
  const graph = [];
  let currentLabel = "[0:v]";
  let inputIndex = 1;

  if (baseFilter) {
    graph.push(`${currentLabel}${baseFilter}[v0]`);
    currentLabel = "[v0]";
  }

  for (let i = 0; i < safeOverlayFiles.length; i++) {
    const overlayFile = safeOverlayFiles[i];
    inputs.push("-stream_loop", "-1", "-i", overlayFile);

    const overlayInput = `[${inputIndex}:v]`;
    const scaled = `[ov${i}s]`;
    const enabled = buildOverlayEnableExpr(durationSec, safeMeta, i);

    graph.push(
      `${overlayInput}scale=${normalizedBaseWidth}:${normalizedBaseHeight}:force_original_aspect_ratio=increase,crop=${normalizedBaseWidth}:${normalizedBaseHeight},format=rgba,colorchannelmixer=aa=${Number(
        i === 0
          ? safeMeta?.doseProfile?.overlayOpacity || 0.18
          : safeMeta?.doseProfile?.secondaryOpacity || 0.08
      ).toFixed(3)}${scaled}`
    );

    const nextLabel = `[v${i + 1}]`;
    const blendMode = String(
      safeMeta?.doseProfile?.blendMode || "screen"
    ).toLowerCase();

    if (blendMode === "add") {
      graph.push(
        `${currentLabel}${scaled}blend=all_mode=addition:all_opacity=1:enable='${enabled}'${nextLabel}`
      );
    } else if (blendMode === "overlay") {
      graph.push(
        `${currentLabel}${scaled}blend=all_mode=overlay:all_opacity=1:enable='${enabled}'${nextLabel}`
      );
    } else if (blendMode === "soft-light") {
      graph.push(
        `${currentLabel}${scaled}blend=all_mode=softlight:all_opacity=1:enable='${enabled}'${nextLabel}`
      );
    } else {
      graph.push(
        `${currentLabel}${scaled}blend=all_mode=screen:all_opacity=1:enable='${enabled}'${nextLabel}`
      );
    }

    currentLabel = nextLabel;
    inputIndex += 1;
  }

  let finalVideoLabel = currentLabel;

  if (lutFiles.length > 0) {
    const lutPath = lutFiles[0].replace(/\\/g, "/").replace(/:/g, "\\:");
    const splitA = "[vprelut]";
    const splitB = "[vbase]";
    const lutOut = "[vlut]";

    graph.push(`${currentLabel}split=2${splitA}${splitB}`);
    graph.push(`${splitA}lut3d=file='${lutPath}'${lutOut}`);

    const intensity = Math.max(
      0,
      Math.min(1, Number(safeMeta?.doseProfile?.lutIntensity || 0.3))
    );

    if (intensity >= 0.999) {
      finalVideoLabel = lutOut;
    } else {
      const mixOut = "[vfinal]";
      graph.push(
        `${splitB}${lutOut}blend=all_mode=normal:all_opacity=${intensity.toFixed(
          3
        )}${mixOut}`
      );
      finalVideoLabel = mixOut;
    }
  }

  const args = [
    ...inputs,
    "-filter_complex",
    graph.join(";"),
    "-map",
    finalVideoLabel,
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "17",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  ];

  await runFfmpegWithArgs(args, "photofx_apply_effects_failed");

  return {
    ok: true,
    applied: true,
    mode: "ffmpeg_overlay_lut_composite_v2",
    preset: safePreset,
    styles: safeStyles,
    outputPath,
    overlay_assets_found: overlayFilesAll,
    overlay_assets_used: safeOverlayFiles,
    overlay_assets_rejected: rejectedOverlayFiles,
    lut_assets_found: lutFilesAll,
    lut_assets_used: lutFiles,
  };
}

function getR2Client() {
  if (!process.env.R2_ENDPOINT) throw new Error("missing_env:R2_ENDPOINT");
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error("missing_env:R2_ACCESS_KEY_ID");
  }
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("missing_env:R2_SECRET_ACCESS_KEY");
  }

  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadFileToR2({ filePath, key, contentType }) {
  if (!process.env.R2_BUCKET) throw new Error("missing_env:R2_BUCKET");

  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE ||
    "https://media.aivo.tr";

  const r2 = getR2Client();

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType || "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${String(publicBase).replace(/\/$/, "")}/${key}`;
}

async function verifyPublicUrl(url, label) {
  if (!url) throw new Error(`public_url_missing:${label}`);

  const methods = ["HEAD", "GET"];

  for (const method of methods) {
    try {
      const r = await fetch(url, {
        method,
        cache: "no-store",
        redirect: "follow",
      });

      if (r.ok) {
        return {
          ok: true,
          status: r.status,
          method,
          contentType: r.headers.get("content-type") || "",
          contentLength: r.headers.get("content-length") || "",
        };
      }
    } catch {}
  }

  throw new Error(`public_url_unreachable:${label}:${url}`);
}

function removeFinalFlags(outputs) {
  const arr = Array.isArray(outputs) ? outputs.slice() : [];
  return arr.map((o) => {
    if (!o || !o.meta) return o;
    return {
      ...o,
      meta: {
        ...(o.meta || {}),
        is_final: false,
      },
    };
  });
}

function upsertVideoOutput(outputs, variant, url, extraMeta = {}) {
  const arr = Array.isArray(outputs) ? outputs.slice() : [];

  const idx = arr.findIndex(
    (o) => isVideo(o) && normVariant(o) === String(variant || "").toLowerCase()
  );

  const item = {
    type: "video",
    url,
    meta: {
      app: "photofx",
      variant,
      ...(extraMeta || {}),
    },
  };

  if (idx >= 0) {
    arr[idx] = {
      ...(arr[idx] || {}),
      ...item,
      meta: { ...((arr[idx] || {}).meta || {}), ...(item.meta || {}) },
    };
    return arr;
  }

  arr.unshift(item);
  return arr;
}

function pickBestSourceOutput(outputs = [], options = {}) {
  const arr = Array.isArray(outputs) ? outputs : [];
  const excludeVariants = new Set(
    toArray(options?.excludeVariants).map((v) => String(v || "").toLowerCase())
  );

  const variants = [
    "logo_overlay",
    "mux",
    "provider",
    "finalized",
    "preview",
    "effects_applied",
  ].filter((variant) => !excludeVariants.has(variant));

  for (const variant of variants) {
    const found = arr.find(
      (o) => isVideo(o) && normVariant(o) === variant && pickUrl(o)
    );
    if (found) {
      return {
        variant,
        url: pickUrl(found),
        output: found,
      };
    }
  }

  const anyVideo = arr.find(
    (o) =>
      isVideo(o) &&
      pickUrl(o) &&
      !excludeVariants.has(normVariant(o) || "video")
  );

  if (anyVideo) {
    return {
      variant: normVariant(anyVideo) || "video",
      url: pickUrl(anyVideo),
      output: anyVideo,
    };
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let tmpDir = null;

  const photofxAssetDebug = {
    cwd: process.cwd(),
    asset_mode: "r2_or_public_url",
    overlay_source_paths: [],
    lut_source_paths: [],
  };

  try {
    const body = req.body || {};
    const job_id = String(body.job_id || "").trim();
    const force = body.force === true;

    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    if (!isUuidLike(job_id)) {
      return res.status(400).json({ ok: false, error: "job_id_invalid" });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    const rows = await sql`
      select *
      from jobs
      where lower(app) = 'photofx'
        and (
          id::text = ${job_id}
          or id = ${job_id}::uuid
        )
      limit 1
    `;

    const job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    const meta = job.meta || {};
    const effectMeta = resolveEffectMeta(meta);

    photofxAssetDebug.overlay_source_paths = effectMeta?.overlayPaths || [];
    photofxAssetDebug.lut_source_paths = effectMeta?.lutPaths || [];

    console.log("[photofx/apply-effects] asset debug =", photofxAssetDebug);
    console.log("[photofx/apply-effects] resolved effect meta =", {
      preset: effectMeta?.preset || "",
      styles: effectMeta?.styles || [],
      overlayPaths: effectMeta?.overlayPaths || [],
      lutPaths: effectMeta?.lutPaths || [],
    });

    const existingEffectsOut = outputs.find(
      (o) => isVideo(o) && normVariant(o) === "effects_applied"
    );
    const existingEffectsUrl = pickUrl(existingEffectsOut);

    if (existingEffectsUrl && !force) {
      return res.status(200).json({
        ok: true,
        job_id,
        skipped: true,
        reason: "effects_already_applied",
        effects_url: existingEffectsUrl,
      });
    }

    const sourceOutput = pickBestSourceOutput(outputs, {
      excludeVariants: force ? ["effects_applied"] : [],
    });

    const sourceFromMeta =
      String(meta?.logo_overlay_url || "").trim() ||
      String(meta?.muxed_url || "").trim() ||
      String(meta?.preview_video_url || "").trim() ||
      String(meta?.final_video_url || "").trim();

    const sourceUrl = sourceOutput?.url || sourceFromMeta || "";
    const sourceVariant =
      sourceOutput?.variant ||
      (meta?.logo_overlay_url
        ? "logo_overlay"
        : meta?.muxed_url
        ? "mux"
        : meta?.preview_video_url
        ? "preview"
        : meta?.final_video_url
        ? "finalized"
        : "provider");

    if (!sourceUrl) {
      return res.status(400).json({
        ok: false,
        error: "effects_input_missing",
        debug: {
          outputs_count: outputs.length,
          source_variant: sourceVariant,
        },
      });
    }

    tmpDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "aivo-photofx-apply-effects-")
    );

    const inputPath = path.join(tmpDir, "input.mp4");
    const outputPath = path.join(tmpDir, "effects-applied.mp4");

    await downloadToFile(sourceUrl, inputPath);

    const videoInfo = await probeVideoInfo(inputPath);
    const inputDurationSec = Number(videoInfo?.durationSec || 0);
    const baseWidth = Number(videoInfo?.width || 0);
    const baseHeight = Number(videoInfo?.height || 0);

    const effectResult = await runPhotofxEffectsApply({
      inputPath,
      outputPath,
      effectMeta,
      durationSec: inputDurationSec,
      baseWidth,
      baseHeight,
      seed: job_id,
    });

    if (!effectResult?.outputPath) {
      throw new Error("effects_output_missing");
    }

    const outputId = `effects-${Date.now()}`;
    const key = `outputs/photofx/${job_id}/${outputId}.mp4`;

    const effects_url = await uploadFileToR2({
      filePath: effectResult.outputPath,
      key,
      contentType: "video/mp4",
    });

    await verifyPublicUrl(effects_url, "effects_applied");

    let nextOutputs = removeFinalFlags(outputs);
    nextOutputs = upsertVideoOutput(
      nextOutputs,
      "effects_applied",
      effects_url,
      {
        is_effects_applied: true,
        is_final: false,
        source_variant: sourceVariant,
        preset: effectMeta.preset || "",
        styles: effectMeta.styles || [],
      }
    );

    const patchMeta = {
      effects_applied_url: effects_url,
      effects_applied_at: new Date().toISOString(),
      effects_applied_key: key,
      effects_applied_from_url: sourceUrl,
      effects_applied_from_variant: sourceVariant,
      effects_applied_preset: effectMeta.preset || "",
      effects_applied_styles: effectMeta.styles || [],
      effects: {
        ...(meta?.effects || {}),
        applied: true,
        applied_at: new Date().toISOString(),
        source_variant: sourceVariant,
        source_url: sourceUrl,
        output_url: effects_url,
        output_key: key,
        mode: effectResult.mode || "unknown",
        preset: effectMeta.preset || "",
        styles: effectMeta.styles || [],
        overlayPaths: effectMeta.overlayPaths || [],
        lutPaths: effectMeta.lutPaths || [],
        overlay_assets_found: effectResult.overlay_assets_found || [],
        overlay_assets_used: effectResult.overlay_assets_used || [],
        overlay_assets_rejected: effectResult.overlay_assets_rejected || [],
        lut_assets_found: effectResult.lut_assets_found || [],
        lut_assets_used: effectResult.lut_assets_used || [],
      },
      asset_debug: photofxAssetDebug,
    };

    await sql`
      update jobs
      set
        outputs = ${JSON.stringify(nextOutputs)}::jsonb,
        meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
        updated_at = now()
      where id = ${job_id}::uuid
    `;

    return res.status(200).json({
      ok: true,
      job_id,
      step: "effects_applied",
      input_url: sourceUrl,
      input_variant: sourceVariant,
      effects_url,
      effect_result: {
        applied: !!effectResult.applied,
        mode: effectResult.mode || "",
        preset: effectMeta.preset || "",
        styles: effectMeta.styles || [],
        overlay_assets_found: effectResult.overlay_assets_found || [],
        overlay_assets_used: effectResult.overlay_assets_used || [],
        overlay_assets_rejected: effectResult.overlay_assets_rejected || [],
        lut_assets_found: effectResult.lut_assets_found || [],
        lut_assets_used: effectResult.lut_assets_used || [],
      },
      debug_effect_meta: {
        preset: effectMeta.preset || "",
        styles: effectMeta.styles || [],
        overlayPaths: effectMeta.overlayPaths || [],
        lutPaths: effectMeta.lutPaths || [],
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || "photofx_apply_effects_failed"),
    });
  } finally {
    if (tmpDir) {
      try {
        await fsp.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
};
