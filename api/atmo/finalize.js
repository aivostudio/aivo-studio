// /api/atmo/finalize.js
// CommonJS
// Atmo finalize:
// input: provider / mux / final url
// işlem: ffmpeg remux + faststart + preview encode
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
      app: "atmo",
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
  if (!process.env.R2_ACCESS_KEY_ID)
    throw new Error("missing_env:R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY)
    throw new Error("missing_env:R2_SECRET_ACCESS_KEY");

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

  // hedef: final dosyanin 1/4'u
  const minPreviewBytes = 3 * 1024 * 1024; // 3 MB
  const maxPreviewBytes = 5 * 1024 * 1024; // 5 MB
  const rawTargetPreviewBytes = Math.floor(bytes / 4);

  const targetPreviewBytes = Math.max(
    minPreviewBytes,
    Math.min(rawTargetPreviewBytes, maxPreviewBytes)
  );

  // bytes -> bits -> kbps
  let targetKbps = Math.floor((targetPreviewBytes * 8) / sec / 1000);

  // kalite çok ezilmesin / ffmpeg gereksiz sıçramasın
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

      // video + varsa audio map et
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",

      // preview için hafif küçültme
      "-vf",
      "scale='min(640,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",

      // dinamik bitrate: final/4, min 3MB, max 5MB
      "-b:v",
      `${targetKbps}k`,
      "-maxrate",
      `${maxrateKbps}k`,
      "-bufsize",
      `${bufsizeKbps}k`,

      // audio'yu koru
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
      where lower(app) = 'atmo'
        and (
          id::text = ${job_id}
          or id = ${job_id}::uuid
        )
      limit 1
    `;

    const job = rows[0] || null;

    if (!job) {
      const recentAtmoRows = await sql`
        select id, app, status, created_at
        from jobs
        where lower(app) = 'atmo'
        order by created_at desc
        limit 5
      `;

      return res.status(404).json({
        ok: false,
        error: "job_not_found",
        debug: {
          requested_job_id: job_id,
          found_rows: rows.length,
          recent_atmo_job_ids: (recentAtmoRows || []).map((x) => ({
            id: String(x.id || ""),
            app: String(x.app || ""),
            status: String(x.status || ""),
            created_at: x.created_at || null,
          })),
        },
      });
    }

    if (String(job.app || "").toLowerCase() !== "atmo") {
      return res.status(400).json({ ok: false, error: "job_not_atmo" });
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

    if (existingFinalized && existingPreview && !body.force) {
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

    // KURAL 1:
    // Preview daima gercek final videodan tureyecek.
    // Final secim onceligi:
    // 1) logo overlay final
    // 2) muxed final
    // 3) provider video
    const selectedFinalSourceUrl =
      logoOverlayUrl || muxUrl || providerUrl || "";

    if (!selectedFinalSourceUrl) {
      return res.status(400).json({
        ok: false,
        error: "finalize_input_missing",
        job_id,
        has_audio: hasAudio,
        has_mux: hasMux,
      });
    }

    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "aivo-atmo-finalize-"));

    const inputPath = path.join(tmpDir, "input.mp4");
    const audioPath = path.join(tmpDir, "audio-input");
    const muxedInputPath = path.join(tmpDir, "muxed-input.mp4");
    const outputPath = path.join(tmpDir, "finalized.mp4");
    const previewPath = path.join(tmpDir, "preview.mp4");

    await downloadToFile(selectedFinalSourceUrl, inputPath);

    let effectiveInputPath = inputPath;

    // Sadece gercek final kaynagi henuz mux edilmemisse inline mux yap.
    // logo overlay veya mux varsa artik onlar final kaynaktir; tekrar mux yapma.
    const needsInlineMux = hasAudio && !logoOverlayUrl && !muxUrl;

    if (needsInlineMux) {
      await downloadToFile(audioUrl, audioPath);
      await runFfmpegMuxVideoAndAudio({
        videoPath: inputPath,
        audioPath,
        outputPath: muxedInputPath,
      });
      effectiveInputPath = muxedInputPath;
    }

    const input_url = selectedFinalSourceUrl;

    await runFfmpegFaststart(effectiveInputPath, outputPath);

    const finalStat = await fsp.stat(outputPath);
    const durationSec = await probeVideoDurationSec(outputPath);

    const previewBitrateCfg = calcPreviewVideoBitrateKbps({
      finalBytes: finalStat?.size || 0,
      durationSec,
    });

    await runFfmpegPreview(outputPath, previewPath, previewBitrateCfg);

    const outputId = `finalized-${Date.now()}`;
    const key = `outputs/atmo/${job_id}/${outputId}.mp4`;
    const previewKey = `outputs/atmo/${job_id}/${outputId}-preview.mp4`;

    const muxOutputId = `mux-${Date.now()}`;
    const muxKey = `outputs/atmo/${job_id}/${muxOutputId}.mp4`;

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
      needs_inline_mux: needsInlineMux,
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
