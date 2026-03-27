// api/photofx/finalize.js
// CommonJS
// PhotoFX finalize:
// input: provider / mux / logo_overlay url
// process: optional inline mux + stylized compositing + faststart + preview encode
// output: R2 final mp4 + R2 preview mp4 + DB meta/output patch

const { neon } = require("@neondatabase/serverless");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
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

async function statSafe(p) {
  try {
    return await fsp.stat(p);
  } catch {
    return null;
  }
}

async function collectFilesFromPaths(pathsInput = [], exts = []) {
  const out = [];
  const seen = new Set();

  for (const raw of uniqStrings(pathsInput)) {
    const abs = ensureAbsoluteAssetPath(raw);
    if (!abs) continue;

    const st = await statSafe(abs);
    if (!st) continue;

    if (st.isFile()) {
      const ext = path.extname(abs).toLowerCase();
      if (!exts.length || exts.includes(ext)) {
        if (!seen.has(abs)) {
          seen.add(abs);
          out.push(abs);
        }
      }
      continue;
    }

    if (!st.isDirectory()) continue;

    const names = await fsp.readdir(abs).catch(() => []);
    for (const name of names) {
      const file = path.join(abs, name);
      const fst = await statSafe(file);
      if (!fst || !fst.isFile()) continue;
      const ext = path.extname(file).toLowerCase();
      if (exts.length && !exts.includes(ext)) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      out.push(file);
    }
  }

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

function upsertFinalizedAndPreviewOutputs(outputs, finalUrl, previewUrl) {
  let arr = removeFinalFlags(outputs);

  arr = upsertVideoOutput(arr, "preview", previewUrl, {
    is_preview: true,
    is_final: false,
  });

  arr = upsertVideoOutput(arr, "finalized", finalUrl, {
    is_final: true,
    is_preview: false,
  });

  return arr;
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

async function downloadToFile(url, outPath) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`download_failed:${r.status}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await fsp.writeFile(outPath, buf);
}

async function probeVideoDurationSec(inputPath) {
  return await new Promise((resolve, reject) => {
    const args = ["-i", inputPath];
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      if (!m) return resolve(0);

      const hh = Number(m[1] || 0);
      const mm = Number(m[2] || 0);
      const ss = Number(m[3] || 0);
      const total = hh * 3600 + mm * 60 + ss;

      resolve(Number.isFinite(total) ? total : 0);
    });
  });
}

function calcPreviewVideoBitrateKbps({ finalBytes, durationSec }) {
  const bytes = Number(finalBytes || 0);
  const sec = Number(durationSec || 0);

  if (!bytes || !sec) {
    return {
      targetKbps: 2600,
      maxrateKbps: 3200,
      bufsizeKbps: 6400,
      targetPreviewBytes: 0,
      minPreviewBytes: 3 * 1024 * 1024,
      maxPreviewBytes: 5 * 1024 * 1024,
    };
  }

  const minPreviewBytes = 3 * 1024 * 1024;
  const maxPreviewBytes = 5 * 1024 * 1024;
  const rawTargetPreviewBytes = Math.floor(bytes / 4);

  const targetPreviewBytes = Math.max(
    minPreviewBytes,
    Math.min(rawTargetPreviewBytes, maxPreviewBytes)
  );

  let targetKbps = Math.floor((targetPreviewBytes * 8) / sec / 1000);
  targetKbps = Math.max(1400, Math.min(targetKbps, 4200));

  const maxrateKbps = Math.max(
    targetKbps + 300,
    Math.floor(targetKbps * 1.2)
  );
  const bufsizeKbps = Math.max(targetKbps * 2, maxrateKbps * 2);

  return {
    targetKbps,
    maxrateKbps,
    bufsizeKbps,
    targetPreviewBytes,
    minPreviewBytes,
    maxPreviewBytes,
  };
}

function normalizeNumber(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function resolveEffectMeta(meta = {}) {
  function buildColorEq(effectMeta = {}) {
  const mood = String(effectMeta?.runtime?.colorMood || "original").toLowerCase();
  const strength = String(effectMeta?.runtime?.effectStrength || "medium").toLowerCase();

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
  }

  if (strength === "low") {
    saturation *= 1.03;
    contrast *= 1.02;
  } else if (strength === "high") {
    saturation *= 1.12;
    contrast *= 1.10;
    brightness += 0.01;
  }

  return `eq=saturation=${saturation.toFixed(3)}:contrast=${contrast.toFixed(3)}:brightness=${brightness.toFixed(3)}:gamma=${gamma.toFixed(3)}`;
}

function buildBaseVisualFilter(effectMeta = {}) {
  const parts = [];
  const preset = String(effectMeta?.preset || "").toLowerCase();
  const styles = Array.isArray(effectMeta?.styles) ? effectMeta.styles : [];
  const has = (name) => preset === name || styles.includes(name);

  parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  parts.push(buildColorEq(effectMeta));

  if (has("shake-edit") || has("split-flash") || has("dark-trap-motion")) {
    parts.push(
      "crop=iw*0.965:ih*0.965:(iw-iw*0.965)/2+sin(t*12)*18:(ih-ih*0.965)/2+cos(t*15)*10"
    );
    parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  }

  if (has("cinematic-zoom")) {
    parts.push("crop=iw*0.94:ih*0.94:(iw-iw*0.94)/2:(ih-ih*0.94)/2");
    parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  }

  if (has("neon-pulse")) {
    parts.push("gblur=sigma=0.8");
    parts.push("unsharp=5:5:1.15:5:5:0.0");
  }

  if (has("glitch-scan")) {
    parts.push("noise=alls=12:allf=t");
  }

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
    (Array.isArray(effectMeta?.styles) && effectMeta.styles.includes("split-flash"))
  ) {
    const burst = Math.min(total * 0.22, 0.9);
    const start = Math.max(0, startBase);
    const end = Math.min(total, start + burst);
    return `between(t,${start.toFixed(3)},${end.toFixed(3)})+between(t,${(total * 0.72).toFixed(3)},${(Math.min(total, total * 0.72 + burst)).toFixed(3)})`;
  }

  return `between(t,${startBase.toFixed(3)},${endBase.toFixed(3)})`;
}
  function buildColorEq(effectMeta = {}) {
  const mood = String(effectMeta?.runtime?.colorMood || "original").toLowerCase();
  const strength = String(effectMeta?.runtime?.effectStrength || "medium").toLowerCase();

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
  }

  if (strength === "low") {
    saturation *= 1.03;
    contrast *= 1.02;
  } else if (strength === "high") {
    saturation *= 1.12;
    contrast *= 1.10;
    brightness += 0.01;
  }

  return `eq=saturation=${saturation.toFixed(3)}:contrast=${contrast.toFixed(3)}:brightness=${brightness.toFixed(3)}:gamma=${gamma.toFixed(3)}`;
}

function buildBaseVisualFilter(effectMeta = {}) {
  const parts = [];
  const preset = String(effectMeta?.preset || "").toLowerCase();
  const styles = Array.isArray(effectMeta?.styles) ? effectMeta.styles : [];
  const has = (name) => preset === name || styles.includes(name);

  parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  parts.push(buildColorEq(effectMeta));

  if (has("shake-edit") || has("split-flash") || has("dark-trap-motion")) {
    parts.push(
      "crop=iw*0.965:ih*0.965:(iw-iw*0.965)/2+sin(t*12)*18:(ih-ih*0.965)/2+cos(t*15)*10"
    );
    parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  }

  if (has("cinematic-zoom")) {
    parts.push("crop=iw*0.94:ih*0.94:(iw-iw*0.94)/2:(ih-ih*0.94)/2");
    parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  }

  if (has("neon-pulse")) {
    parts.push("gblur=sigma=0.8");
    parts.push("unsharp=5:5:1.15:5:5:0.0");
  }

  if (has("glitch-scan")) {
    parts.push("noise=alls=12:allf=t");
  }

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
    (Array.isArray(effectMeta?.styles) && effectMeta.styles.includes("split-flash"))
  ) {
    const burst = Math.min(total * 0.22, 0.9);
    const start = Math.max(0, startBase);
    const end = Math.min(total, start + burst);
    return `between(t,${start.toFixed(3)},${end.toFixed(3)})+between(t,${(total * 0.72).toFixed(3)},${(Math.min(total, total * 0.72 + burst)).toFixed(3)})`;
  }

  return `between(t,${startBase.toFixed(3)},${endBase.toFixed(3)})`;
}
  const effects = meta?.effects || {};
  const effectConfig = effects?.effectConfig || {};
  const doseProfile = effectConfig?.doseProfile || {};
  const runtime = effectConfig?.runtime || {};

  const preset = String(
    meta?.preset ||
      effects?.preset ||
      effectConfig?.preset ||
      ""
  )
    .trim()
    .toLowerCase();

  const styles = uniqStrings(
    []
      .concat(toArray(meta?.styles))
      .concat(toArray(effects?.styles))
  ).map((x) => x.toLowerCase());

  return {
    preset,
    styles,
    overlayPaths: uniqStrings(effectConfig?.overlayPaths || []),
    lutPaths: uniqStrings(effectConfig?.lutPaths || []),
    doseProfile: {
      zoomAmount: normalizeNumber(doseProfile?.zoomAmount, 0.05, 0.0, 0.25),
      shakeAmount: normalizeNumber(doseProfile?.shakeAmount, 0.02, 0.0, 0.20),
      blurAmount: normalizeNumber(doseProfile?.blurAmount, 0.04, 0.0, 0.30),
      glowAmount: normalizeNumber(doseProfile?.glowAmount, 0.08, 0.0, 0.60),
      overlayOpacity: normalizeNumber(doseProfile?.overlayOpacity, 0.18, 0.0, 0.70),
      secondaryOpacity: normalizeNumber(doseProfile?.secondaryOpacity, 0.08, 0.0, 0.35),
      lutIntensity: normalizeNumber(doseProfile?.lutIntensity, 0.30, 0.0, 1.0),
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

async function runPhotofxCompositingScaffold({
  inputPath,
  outputPath,
  effectMeta,
  durationSec = 6,
  seed = "",
}) {
  const safeMeta = effectMeta || resolveEffectMeta({});
  const safePreset = String(safeMeta?.preset || "").trim().toLowerCase();
  const safeStyles = Array.isArray(safeMeta?.styles)
    ? safeMeta.styles.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const overlayFilesAll = await collectFilesFromPaths(
    safeMeta?.overlayPaths || [],
    [".mp4", ".mov", ".webm"]
  );

  const lutFilesAll = await collectFilesFromPaths(
    safeMeta?.lutPaths || [],
    [".cube", ".3dl"]
  );

  const maxOverlayCount = Math.max(
    1,
    Math.min(
      4,
      Number(safeMeta?.doseProfile?.maxOverlayCount || 1)
    )
  );

  const overlayFiles = pickDeterministic(
    overlayFilesAll,
    `${seed}:${safePreset}:${safeStyles.join(",")}:overlay`,
    maxOverlayCount
  );

  const lutFiles = pickDeterministic(
    lutFilesAll,
    `${seed}:${safePreset}:${safeStyles.join(",")}:lut`,
    1
  );

  const shouldProcess =
    !!safePreset ||
    safeStyles.length > 0 ||
    overlayFiles.length > 0 ||
    lutFiles.length > 0;

  if (!shouldProcess) {
    await fsp.copyFile(inputPath, outputPath);
    return {
      ok: true,
      applied: false,
      preset: safePreset,
      styles: safeStyles,
      mode: "passthrough_copy",
      outputPath,
      overlay_assets_found: overlayFilesAll,
      overlay_assets_used: [],
      lut_assets_found: lutFilesAll,
    };
  }

  const baseFilter = buildBaseVisualFilter(safeMeta);
  const inputs = ["-y", "-i", inputPath];
  const graph = [];
  let currentLabel = "[0:v]";
  let inputIndex = 1;

  if (baseFilter) {
    graph.push(`${currentLabel}${baseFilter}[v0]`);
    currentLabel = "[v0]";
  }

  for (let i = 0; i < overlayFiles.length; i++) {
    const overlayFile = overlayFiles[i];
    inputs.push("-stream_loop", "-1", "-i", overlayFile);

    const overlayInput = `[${inputIndex}:v]`;
    const scaled = `[ov${i}s]`;
    const enabled = buildOverlayEnableExpr(durationSec, safeMeta, i);

    graph.push(
      `${overlayInput}scale=iw:ih,format=rgba,colorchannelmixer=aa=${Number(
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
    const lutPath = lutFiles[0]
      .replace(/\\/g, "/")
      .replace(/:/g, "\\:");
    const lutOut = "[vlut]";
    graph.push(
      `${currentLabel}lut3d=file='${lutPath}'${lutOut}`
    );

    const intensity = Math.max(
      0,
      Math.min(1, Number(safeMeta?.doseProfile?.lutIntensity || 0.30))
    );

    if (intensity >= 0.999) {
      finalVideoLabel = lutOut;
    } else {
      const mixOut = "[vfinal]";
      graph.push(
        `${currentLabel}${lutOut}blend=all_mode=normal:all_opacity=${intensity.toFixed(
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

  await runFfmpegWithArgs(args, "photofx_composite_failed");

  return {
    ok: true,
    applied: true,
    preset: safePreset,
    styles: safeStyles,
    mode: "ffmpeg_overlay_lut_composite_v3",
    outputPath,
    overlay_assets_found: overlayFilesAll,
    overlay_assets_used: overlayFiles,
    lut_assets_found: lutFilesAll,
  };
}

async function runFfmpegFaststart(inputPath, outputPath) {
  await runFfmpegWithArgs(
    [
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "ffmpeg_failed"
  );
}

async function runFfmpegPreview(inputPath, outputPath, bitrateCfg = {}) {
  const targetKbps = Number(bitrateCfg?.targetKbps || 2600);
  const maxrateKbps = Number(bitrateCfg?.maxrateKbps || 3200);
  const bufsizeKbps = Number(bitrateCfg?.bufsizeKbps || 6400);

  await runFfmpegWithArgs(
    [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale='min(640,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      `${targetKbps}k`,
      "-maxrate",
      `${maxrateKbps}k`,
      "-bufsize",
      `${bufsizeKbps}k`,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-shortest",
      outputPath,
    ],
    "ffmpeg_preview_failed"
  );
}

async function runFfmpegMuxVideoAndAudio({
  videoPath,
  audioPath,
  outputPath,
}) {
  await runFfmpegWithArgs(
    [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "ffmpeg_mux_failed"
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let tmpDir = null;

  try {
    const body = req.body || {};
    const job_id = String(body.job_id || "").trim();

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
      const recentRows = await sql`
        select id, app, status, created_at
        from jobs
        where lower(app) = 'photofx'
        order by created_at desc
        limit 5
      `;

      return res.status(404).json({
        ok: false,
        error: "job_not_found",
        debug: {
          requested_job_id: job_id,
          found_rows: rows.length,
          recent_photofx_job_ids: (recentRows || []).map((x) => ({
            id: String(x.id || ""),
            app: String(x.app || ""),
            status: String(x.status || ""),
            created_at: x.created_at || null,
          })),
        },
      });
    }

    if (String(job.app || "").toLowerCase() !== "photofx") {
      return res.status(400).json({ ok: false, error: "job_not_photofx" });
    }

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    const meta = job.meta || {};

    const muxOut = outputs.find((o) => isVideo(o) && normVariant(o) === "mux");
    const providerOut = outputs.find(
      (o) => isVideo(o) && normVariant(o) === "provider"
    );
    const finalizedOut = outputs.find(
      (o) => isVideo(o) && normVariant(o) === "finalized"
    );
    const previewOut = outputs.find(
      (o) => isVideo(o) && normVariant(o) === "preview"
    );

    const existingFinalized = pickUrl(finalizedOut);
    const existingPreview =
      String(meta?.preview_video_url || "").trim() || pickUrl(previewOut);
    const existingLogoOverlayUrl = String(meta?.logo_overlay_url || "").trim();

    const finalizedFromVariant = String(
      meta?.selected_final_source_variant || meta?.finalized_from_variant || ""
    )
      .trim()
      .toLowerCase();

    const finalizedMatchesCurrentSource = existingLogoOverlayUrl
      ? finalizedFromVariant === "logo_overlay"
      : true;

    if (
      existingFinalized &&
      existingPreview &&
      !body.force &&
      finalizedMatchesCurrentSource
    ) {
      return res.status(200).json({
        ok: true,
        job_id,
        input_url: null,
        final_url: existingFinalized,
        preview_url: existingPreview,
        skipped: true,
        reason: "already_finalized",
      });
    }

    const audioUrl =
      String(meta?.audio_url || "").trim() ||
      String(meta?.music_url || "").trim();

    const muxUrl = String(meta?.muxed_url || "").trim() || pickUrl(muxOut);
    const logoOverlayUrl = String(meta?.logo_overlay_url || "").trim();
    const providerUrl = pickUrl(providerOut);

    const hasAudio = !!audioUrl;
    const hasMux = !!muxUrl;

    const selectedFinalSourceUrl = logoOverlayUrl || muxUrl || providerUrl || "";

    if (!selectedFinalSourceUrl) {
      return res.status(400).json({
        ok: false,
        error: "finalize_input_missing",
        job_id,
        has_audio: hasAudio,
        has_mux: hasMux,
      });
    }

    tmpDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "aivo-photofx-finalize-")
    );

    const inputPath = path.join(tmpDir, "input.mp4");
    const audioPath = path.join(tmpDir, "audio-input");
    const muxedInputPath = path.join(tmpDir, "muxed-input.mp4");
    const compositedPath = path.join(tmpDir, "composited-input.mp4");
    const faststartPath = path.join(tmpDir, "finalized-faststart.mp4");
    const previewPath = path.join(tmpDir, "preview.mp4");

    await downloadToFile(selectedFinalSourceUrl, inputPath);

    let effectiveInputPath = inputPath;
    let selectedFinalSourceVariant = logoOverlayUrl
      ? "logo_overlay"
      : muxUrl
      ? "mux"
      : "provider";

    const needsInlineMux = hasAudio && !logoOverlayUrl && !muxUrl;

    if (needsInlineMux) {
      await downloadToFile(audioUrl, audioPath);
      await runFfmpegMuxVideoAndAudio({
        videoPath: effectiveInputPath,
        audioPath,
        outputPath: muxedInputPath,
      });
      effectiveInputPath = muxedInputPath;
      selectedFinalSourceVariant = "mux";
    }

    const input_url = selectedFinalSourceUrl;

    const effectMeta = resolveEffectMeta(meta);
    const inputDurationSec = await probeVideoDurationSec(effectiveInputPath);

    const compositingPlan = {
      enabled:
        !!effectMeta.preset ||
        effectMeta.styles.length > 0 ||
        effectMeta.overlayPaths.length > 0 ||
        effectMeta.lutPaths.length > 0,
      preset: effectMeta.preset,
      styles: effectMeta.styles,
      overlayPaths: effectMeta.overlayPaths,
      lutPaths: effectMeta.lutPaths,
      input_path_before_composite: effectiveInputPath,
      output_path_after_composite: compositedPath,
      stage: "pre_faststart",
      source_variant: selectedFinalSourceVariant,
      input_duration_sec: inputDurationSec,
    };

    let compositingResult = {
      ok: true,
      applied: false,
      mode: "disabled",
      outputPath: effectiveInputPath,
      overlay_assets_used: [],
      overlay_assets_found: [],
      lut_assets_found: [],
    };

    if (compositingPlan.enabled) {
     compositingResult = await runPhotofxCompositingScaffold({
  inputPath: effectiveInputPath,
  outputPath: compositedPath,
  effectMeta,
  durationSec: inputDurationSec,
  seed: job_id,
});

      if (!compositingResult || !compositingResult.outputPath) {
        throw new Error("photofx_compositing_output_missing");
      }

      effectiveInputPath = compositingResult.outputPath;
    }

    await runFfmpegFaststart(effectiveInputPath, faststartPath);

    const finalStat = await fsp.stat(faststartPath);
    const durationSec = await probeVideoDurationSec(faststartPath);

    const previewBitrateCfg = calcPreviewVideoBitrateKbps({
      finalBytes: finalStat?.size || 0,
      durationSec,
    });

    await runFfmpegPreview(faststartPath, previewPath, previewBitrateCfg);

    const outputId = `finalized-${Date.now()}`;
    const key = `outputs/photofx/${job_id}/${outputId}.mp4`;
    const previewKey = `outputs/photofx/${job_id}/${outputId}-preview.mp4`;

    const muxOutputId = `mux-${Date.now()}`;
    const muxKey = `outputs/photofx/${job_id}/${muxOutputId}.mp4`;

    let mux_url =
      String(meta?.muxed_url || "").trim() || pickUrl(muxOut) || "";

    if (needsInlineMux) {
      mux_url = await uploadFileToR2({
        filePath: muxedInputPath,
        key: muxKey,
        contentType: "video/mp4",
      });

      await verifyPublicUrl(mux_url, "mux");
    }

    const final_url = await uploadFileToR2({
      filePath: faststartPath,
      key,
      contentType: "video/mp4",
    });

    await verifyPublicUrl(final_url, "final");

    const preview_url = await uploadFileToR2({
      filePath: previewPath,
      key: previewKey,
      contentType: "video/mp4",
    });

    await verifyPublicUrl(preview_url, "preview");

    let nextOutputs = upsertFinalizedAndPreviewOutputs(
      outputs,
      final_url,
      preview_url
    );

    if (needsInlineMux && mux_url) {
      nextOutputs = upsertVideoOutput(nextOutputs, "mux", mux_url, {
        is_mux: true,
        is_final: false,
        source: "finalize_inline_mux",
      });
    }

    const patchMeta = {
      final_video_url: final_url,
      preview_video_url: preview_url,
      final_variant: "finalized",
      finalized_at: new Date().toISOString(),
      finalized_from_url: input_url,
      finalized_key: key,
      preview_key: previewKey,
      preview_target_ratio: "1/4",
      preview_min_mb: 3,
      preview_max_mb: 5,
      selected_final_source_variant: selectedFinalSourceVariant,
      needs_inline_mux: needsInlineMux,
      muxed_url: mux_url || null,
      compositing: {
        enabled: compositingPlan.enabled,
        preset: compositingPlan.preset,
        styles: compositingPlan.styles,
        mode: compositingResult.mode,
        applied: !!compositingResult.applied,
        overlay_assets_found: compositingResult.overlay_assets_found || [],
        overlay_assets_used: compositingResult.overlay_assets_used || [],
        lut_assets_found: compositingResult.lut_assets_found || [],
      },
    };

    await sql`
      update jobs
      set
        outputs = ${JSON.stringify(nextOutputs)}::jsonb,
        meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
        status = 'done',
        updated_at = now()
      where id = ${job_id}::uuid
    `;

    return res.status(200).json({
      ok: true,
      job_id,
      input_url,
      final_url,
      preview_url,
      step: "finalized",
      preview_cfg: previewBitrateCfg,
      preview_source_url: input_url,
      selected_final_source_variant: selectedFinalSourceVariant,
      needs_inline_mux: needsInlineMux,
      compositing: patchMeta.compositing,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || "finalize_failed"),
    });
  } finally {
    if (tmpDir) {
      try {
        await fsp.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
};
