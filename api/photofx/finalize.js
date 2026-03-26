// /api/photofx/finalize.js
// CommonJS
// PhotoFX finalize:
// input: provider / mux / final url
// işlem: optional inline logo overlay + optional inline mux + optional compositing scaffold + faststart + preview encode
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

async function probeVideoBitrate(inputPath) {
  return await new Promise((resolve) => {
    const p = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=bit_rate",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );

    let out = "";
    p.stdout.on("data", (d) => {
      out += d.toString();
    });

    p.on("close", () => {
      const n = Number(String(out || "").trim());
      resolve(Number.isFinite(n) && n > 0 ? n : null);
    });

    p.on("error", () => resolve(null));
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

async function runPhotofxCompositingScaffold({
  inputPath,
  outputPath,
  preset,
  styles = [],
}) {
  const safePreset = String(preset || "").trim().toLowerCase();
  const safeStyles = Array.isArray(styles)
    ? styles.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const shouldProcess = !!safePreset || safeStyles.length > 0;

  if (!shouldProcess) {
    await fsp.copyFile(inputPath, outputPath);
    return {
      ok: true,
      applied: false,
      preset: safePreset,
      styles: safeStyles,
      mode: "passthrough_copy",
      outputPath,
    };
  }

  // ŞİMDİLİK SCAFFOLD:
  // Gerçek overlay / LUT / motion zinciri burada çalışacak.
  // İlk aşamada pipeline kırılmasın diye yine outputPath'e düz kopya atıyoruz.
  await fsp.copyFile(inputPath, outputPath);

  return {
    ok: true,
    applied: false,
    preset: safePreset,
    styles: safeStyles,
    mode: "scaffold_copy",
    outputPath,
  };
}

async function runFfmpegFaststart(inputPath, outputPath) {
  await new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg_failed:${code}:${stderr.slice(-1000)}`));
    });
  });
}

async function runFfmpegPreview(inputPath, outputPath, bitrateCfg = {}) {
  const targetKbps = Number(bitrateCfg?.targetKbps || 2600);
  const maxrateKbps = Number(bitrateCfg?.maxrateKbps || 3200);
  const bufsizeKbps = Number(bitrateCfg?.bufsizeKbps || 6400);

  await new Promise((resolve, reject) => {
    const args = [
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
    ];

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg_preview_failed:${code}:${stderr.slice(-1000)}`));
    });
  });
}

async function runFfmpegMuxVideoAndAudio({
  videoPath,
  audioPath,
  outputPath,
}) {
  await new Promise((resolve, reject) => {
    const args = [
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
    ];

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg_mux_failed:${code}:${stderr.slice(-1000)}`));
    });
  });
}

async function runFfmpegOverlayLogo({
  videoPath,
  logoPath,
  outputPath,
  logoPos = "br",
  logoSize = "sm",
  logoOpacity = 0.85,
}) {
  const POS = {
    br: "W-w-24:H-h-24",
    bl: "24:H-h-24",
    tr: "W-w-24:24",
    tl: "24:24",
    c: "(W-w)/2:(H-h)/2",
  };

  const SIZE = {
    sm: 0.16,
    md: 0.22,
    lg: 0.30,
  };

  const pos = POS[String(logoPos || "").trim()] || POS.br;
  const sizeRatio = SIZE[String(logoSize || "").trim()] || SIZE.sm;
  const opacity = Math.max(0, Math.min(1, Number(logoOpacity)));

  const sourceBitrate = await probeVideoBitrate(videoPath);
  const targetBitrate = sourceBitrate
    ? Math.max(1200000, Math.round(sourceBitrate * 0.98))
    : 8000000;

  const filter = [
    `[1:v]scale=iw*${sizeRatio}:-1,format=rgba,colorchannelmixer=aa=${opacity}[lg]`,
    `[0:v][lg]overlay=${pos}:format=auto[v]`,
  ].join(";");

  await new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      videoPath,
      "-i",
      logoPath,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-b:v",
      String(targetBitrate),
      "-maxrate",
      String(targetBitrate),
      "-bufsize",
      String(targetBitrate * 2),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    p.on("error", reject);

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg_logo_overlay_failed:${code}:${stderr.slice(-1000)}`));
    });
  });

  return {
    sourceBitrate,
    targetBitrate,
  };
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

const logoEnabled = !!meta?.logo_enabled;
const logoUrl = String(meta?.logo_url || "").trim();
const existingLogoOverlayUrl = String(meta?.logo_overlay_url || "").trim();
const hasLogoRequest = !!(logoEnabled && logoUrl);
const needsLogoFinalize = !!(hasLogoRequest && !existingLogoOverlayUrl);

if (existingFinalized && existingPreview && !body.force && !needsLogoFinalize) {
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
    const providerUrl = pickUrl(providerOut);

    const logoName = String(meta?.logo_name || "").trim();
    const logoPos = String(meta?.logo_pos || "br").trim();
    const logoSize = String(meta?.logo_size || "sm").trim();
    const logoOpacity = Number(meta?.logo_opacity ?? 0.85);

    const hasAudio = !!audioUrl;
    const hasMux = !!muxUrl;
    const hasLogo = !!(logoEnabled && logoUrl);

    const selectedFinalSourceUrl = muxUrl || providerUrl || "";

    if (!selectedFinalSourceUrl) {
      return res.status(400).json({
        ok: false,
        error: "finalize_input_missing",
        job_id,
        has_audio: hasAudio,
        has_mux: hasMux,
        has_logo: hasLogo,
      });
    }

    tmpDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "aivo-photofx-finalize-")
    );

    const inputPath = path.join(tmpDir, "input.mp4");
    const logoPath = path.join(tmpDir, "logo-input");
    const logoOverlaidPath = path.join(tmpDir, "logo-overlaid.mp4");
    const audioPath = path.join(tmpDir, "audio-input");
    const muxedInputPath = path.join(tmpDir, "muxed-input.mp4");
    const outputPath = path.join(tmpDir, "finalized.mp4");
    const previewPath = path.join(tmpDir, "preview.mp4");
    const compositedPath = path.join(tmpDir, "composited-input.mp4");

    await downloadToFile(selectedFinalSourceUrl, inputPath);

    let effectiveInputPath = inputPath;
    let selectedFinalSourceVariant = muxUrl ? "mux" : "provider";
    let logo_overlay_url = "";
    let logoOverlayMeta = null;

    if (hasLogo) {
      await downloadToFile(logoUrl, logoPath);

      logoOverlayMeta = await runFfmpegOverlayLogo({
        videoPath: effectiveInputPath,
        logoPath,
        outputPath: logoOverlaidPath,
        logoPos,
        logoSize,
        logoOpacity,
      });

      const logoOverlayOutputId = `logo-overlay-${Date.now()}`;
      const logoOverlayKey = `outputs/photofx/${job_id}/${logoOverlayOutputId}.mp4`;

      logo_overlay_url = await uploadFileToR2({
        filePath: logoOverlaidPath,
        key: logoOverlayKey,
        contentType: "video/mp4",
      });

      await verifyPublicUrl(logo_overlay_url, "logo_overlay");

      effectiveInputPath = logoOverlaidPath;
      selectedFinalSourceVariant = "logo_overlay";
    }

    // Logo basılmış video varsa üstüne sadece audio mux yapılır.
    // Hazır mux varsa onu source alıp logo üstüne basmış olduk.
    const needsInlineMux = hasAudio && !hasMux;

    if (needsInlineMux) {
      await downloadToFile(audioUrl, audioPath);
      await runFfmpegMuxVideoAndAudio({
        videoPath: effectiveInputPath,
        audioPath,
        outputPath: muxedInputPath,
      });
      effectiveInputPath = muxedInputPath;
    }

    const input_url = selectedFinalSourceUrl;

    const presetKey = String(
      meta?.preset ||
        meta?.preset_key ||
        meta?.effect ||
        meta?.effect_key ||
        ""
    )
      .trim()
      .toLowerCase();

    const styleKeys = Array.isArray(meta?.styles)
      ? meta.styles
          .map((x) => String(x || "").trim().toLowerCase())
          .filter(Boolean)
      : [];

    const compositingPlan = {
      enabled: !!presetKey || styleKeys.length > 0,
      preset: presetKey,
      styles: styleKeys,
      input_path_before_composite: effectiveInputPath,
      output_path_after_composite: compositedPath,
      stage: "pre_faststart",
      source_variant: selectedFinalSourceVariant,
    };

    if (compositingPlan.enabled) {
      const compositingResult = await runPhotofxCompositingScaffold({
        inputPath: effectiveInputPath,
        outputPath: compositedPath,
        preset: compositingPlan.preset,
        styles: compositingPlan.styles,
      });

      effectiveInputPath = compositingResult.outputPath;
    }

    await runFfmpegFaststart(effectiveInputPath, outputPath);

    const finalStat = await fsp.stat(outputPath);
    const durationSec = await probeVideoDurationSec(outputPath);

    const previewBitrateCfg = calcPreviewVideoBitrateKbps({
      finalBytes: finalStat?.size || 0,
      durationSec,
    });

    await runFfmpegPreview(outputPath, previewPath, previewBitrateCfg);

    const outputId = `finalized-${Date.now()}`;
    const key = `outputs/photofx/${job_id}/${outputId}.mp4`;
    const previewKey = `outputs/photofx/${job_id}/${outputId}-preview.mp4`;

    const muxOutputId = `mux-${Date.now()}`;
    const muxKey = `outputs/photofx/${job_id}/${muxOutputId}.mp4`;

    let mux_url = String(meta?.muxed_url || "").trim() || pickUrl(muxOut) || "";

    if (needsInlineMux) {
      mux_url = await uploadFileToR2({
        filePath: muxedInputPath,
        key: muxKey,
        contentType: "video/mp4",
      });

      await verifyPublicUrl(mux_url, "mux");
    }

    const final_url = await uploadFileToR2({
      filePath: outputPath,
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

    if (logo_overlay_url) {
      nextOutputs = upsertVideoOutput(nextOutputs, "logo_overlay", logo_overlay_url, {
        is_logo_overlay: true,
        is_final: false,
        logo_name: logoName,
        logo_url: logoUrl,
        logo_pos: logoPos,
        logo_size: logoSize,
        logo_opacity: logoOpacity,
      });
    }

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
      preview_target_kbps: previewBitrateCfg.targetKbps,
      preview_maxrate_kbps: previewBitrateCfg.maxrateKbps,
      preview_bufsize_kbps: previewBitrateCfg.bufsizeKbps,
      preview_source_final_bytes: finalStat?.size || 0,
      preview_source_duration_sec: durationSec || 0,
      preview_target_bytes: previewBitrateCfg.targetPreviewBytes || 0,
      preview_source_url: selectedFinalSourceUrl,
      selected_final_source_variant: compositingPlan.source_variant,
      compositing_enabled: compositingPlan.enabled,
      compositing_preset: compositingPlan.preset || "",
      compositing_styles: compositingPlan.styles,
      ...(logo_overlay_url
        ? {
            logo_overlay_url: logo_overlay_url,
            logo_name: logoName,
            logo_url: logoUrl,
            logo_pos: logoPos,
            logo_size: logoSize,
            logo_opacity: logoOpacity,
            logo_overlay_source_bitrate:
              logoOverlayMeta?.sourceBitrate || null,
            logo_overlay_target_bitrate:
              logoOverlayMeta?.targetBitrate || null,
          }
        : {}),
      ...(needsInlineMux && mux_url
        ? {
            muxed_url: mux_url,
            mux_key: muxKey,
          }
        : {}),
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
      input_url,
      final_url,
      preview_url,
      step: "finalized",
      preview_cfg: previewBitrateCfg,
      preview_source_url: selectedFinalSourceUrl,
      selected_final_source_variant: compositingPlan.source_variant,
      needs_inline_mux: needsInlineMux,
      has_logo: hasLogo,
      logo_overlay_url: logo_overlay_url || "",
      compositing: {
        enabled: compositingPlan.enabled,
        preset: compositingPlan.preset || "",
        styles: compositingPlan.styles,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
};
