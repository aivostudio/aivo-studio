// api/atmo/overlay-logo.js
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
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

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed:${res.status}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(ab));
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
      app = "atmo",
    } = req.body || {};

    if (!video_url || !logo_url) {
      return res.status(400).json({ ok: false, error: "missing_inputs" });
    }

    const id = job_id || crypto.randomUUID();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-atmo-overlay-"));

    const inputVideo = path.join(tmpDir, `in-${id}.mp4`);
    const inputLogo = path.join(tmpDir, `logo-${id}.png`);
    const outputVideo = path.join(tmpDir, `out-${id}.mp4`);

    cleanup.push(inputVideo, inputLogo, outputVideo, tmpDir);

    await download(video_url, inputVideo);
    await download(logo_url, inputLogo);

    const pos = POS[logo_pos] || POS.br;
    const sizeRatio = SIZE[logo_size] || SIZE.sm;
    const opacity = Math.max(0, Math.min(1, Number(logo_opacity)));

    const sourceBitrate = await probeVideoBitrate(inputVideo);
    const targetBitrate = sourceBitrate
      ? Math.max(1200000, Math.round(sourceBitrate * 0.98))
      : 8000000;
    const targetBitrateStr = String(targetBitrate);
    const targetBufsizeStr = String(targetBitrate * 2);

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
      targetBitrateStr,
      "-maxrate",
      targetBitrateStr,
      "-bufsize",
      targetBufsizeStr,
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

    return res.json({
      ok: true,
      url: publicUrl,
      job_id: id,
      video_bitrate: sourceBitrate,
      target_bitrate: targetBitrate,
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
