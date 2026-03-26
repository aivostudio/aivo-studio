// /api/photofx/overlay-logo.js

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { neon } from "@neondatabase/serverless";
import { putObject } from "../_lib/r2.js";

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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(err || `process_failed:${code}`));
    });
  });
}

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

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed:${res.status}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(ab));
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

export default async function handler(req, res) {
  const cleanup = [];

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      job_id,
      video_url,
      logo_url,
      logo_pos = "br",
      logo_size = "sm",
      logo_opacity = 0.85,
      app = "photofx",
    } = req.body || {};

    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    if (!isUuidLike(job_id)) {
      return res.status(400).json({ ok: false, error: "job_id_invalid" });
    }

    if (!video_url || !logo_url) {
      return res.status(400).json({ ok: false, error: "missing_inputs" });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    const rows = await sql`
      select id, app, outputs, meta
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

    const id = String(job_id || crypto.randomUUID()).trim();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-photofx-overlay-"));

    const inputVideo = path.join(tmpDir, `in-${id}.mp4`);
    const inputLogo = path.join(tmpDir, `logo-${id}.png`);
    const outputVideo = path.join(tmpDir, `out-${id}.mp4`);

    cleanup.push(inputVideo, inputLogo, outputVideo, tmpDir);

    await download(video_url, inputVideo);
    await download(logo_url, inputLogo);

    const pos = POS[String(logo_pos || "").trim()] || POS.br;
    const sizeRatio = SIZE[String(logo_size || "").trim()] || SIZE.sm;
    const opacity = Math.max(0, Math.min(1, Number(logo_opacity)));

    const sourceBitrate = await probeVideoBitrate(inputVideo);
    const targetBitrate = sourceBitrate
      ? Math.max(1200000, Math.round(sourceBitrate * 0.98))
      : 8000000;

    const filter = [
      `[1:v]scale=iw*${sizeRatio}:-1,format=rgba,colorchannelmixer=aa=${opacity}[lg]`,
      `[0:v][lg]overlay=${pos}:format=auto[v]`,
    ].join(";");

    await run(ffmpegPath, [
      "-y",
      "-i",
      inputVideo,
      "-i",
      inputLogo,
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
      outputVideo,
    ]);

    const buffer = fs.readFileSync(outputVideo);
    const key = `outputs/${app}/${id}/logo-overlay-${Date.now()}.mp4`;

    const publicUrl = await putObject({
      key,
      body: buffer,
      contentType: "video/mp4",
    });

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    const meta = job.meta || {};

    let nextOutputs = upsertVideoOutput(outputs, "logo_overlay", publicUrl, {
      is_logo_overlay: true,
      is_final: false,
      logo_url,
      logo_pos: String(logo_pos || "br").trim(),
      logo_size: String(logo_size || "sm").trim(),
      logo_opacity: opacity,
    });

    const finalizedOut = nextOutputs.find(
      (o) => isVideo(o) && normVariant(o) === "finalized"
    );

    if (finalizedOut) {
      nextOutputs = nextOutputs.map((o) => {
        if (!o || !o.meta) return o;
        if (normVariant(o) !== "finalized") return o;
        return {
          ...o,
          meta: {
            ...(o.meta || {}),
            is_final: false,
          },
        };
      });
    }

    const patchMeta = {
      ...meta,
      logo_enabled: true,
      logo_url: String(logo_url || "").trim(),
      logo_overlay_url: publicUrl,
      logo_overlay_key: key,
      logo_overlay_applied_at: new Date().toISOString(),
      logo_pos: String(logo_pos || "br").trim(),
      logo_size: String(logo_size || "sm").trim(),
      logo_opacity: opacity,
      logo_overlay_source_url: String(video_url || "").trim(),
      logo_overlay_source_bitrate: sourceBitrate,
      logo_overlay_target_bitrate: targetBitrate,
    };

    await sql`
      update jobs
      set
        outputs = ${JSON.stringify(nextOutputs)}::jsonb,
        meta = ${JSON.stringify(patchMeta)}::jsonb,
        updated_at = now()
      where id = ${job_id}::uuid
    `;

    return res.json({
      ok: true,
      url: publicUrl,
      job_id: id,
      video_bitrate: sourceBitrate,
      target_bitrate: targetBitrate,
      variant: "logo_overlay",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "overlay_failed",
      message: e?.message || String(e),
    });
  } finally {
    for (const f of cleanup.reverse()) {
      try {
        if (!f) continue;
        if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
          fs.rmSync(f, { recursive: true, force: true });
        } else if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch {}
    }
  }
}
