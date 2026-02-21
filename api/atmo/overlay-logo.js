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

async function download(url, dest) {
  // Node fetch: res.body is web stream; pipe() yok → arrayBuffer ile indiriyoruz
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed:${res.status}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(ab));
}

export default async function handler(req, res) {
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
    const tmp = os.tmpdir();

    const inputVideo = path.join(tmp, `in-${id}.mp4`);
    const inputLogo = path.join(tmp, `logo-${id}.png`);
    const outputVideo = path.join(tmp, `out-${id}.mp4`);

    await download(video_url, inputVideo);
    await download(logo_url, inputLogo);

    const pos = POS[logo_pos] || POS.br;
    const sizeRatio = SIZE[logo_size] || SIZE.sm;
    const opacity = Math.max(0, Math.min(1, Number(logo_opacity)));

    // overlay çıktısını [v] olarak etiketliyoruz ve onu map ediyoruz
    const filter = `
      [1:v]scale=iw*${sizeRatio}:-1,format=rgba,colorchannelmixer=aa=${opacity}[lg];
      [0:v][lg]overlay=${pos}:format=auto[v]
    `.replace(/\s+/g, "");

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
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputVideo,
    ]);

    const buffer = fs.readFileSync(outputVideo);

    // cache/overwrite sorununu önlemek için her seferinde unique key
    const key = `outputs/${app}/${id}/logo-overlay-${Date.now()}.mp4`;

    const publicUrl = await putObject({
      key,
      body: buffer,
      contentType: "video/mp4",
    });

    // cleanup
    [inputVideo, inputLogo, outputVideo].forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch {}
    });

    return res.json({
      ok: true,
      url: publicUrl,
      job_id: id,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "overlay_failed",
      message: e?.message || String(e),
    });
  }
}
