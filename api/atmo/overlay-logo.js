// api/atmo/overlay-logo.js
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";
import fetch from "node-fetch";
import ffmpegPath from "ffmpeg-static";

// mevcut R2 helper’ını kullanacağız (sende var: api/_lib/r2.js)
// Buradaki export ismi sende farklıysa sadece import satırını düzelt.
import { r2PutObject } from "../_lib/r2.js";

// basit allowlist
const POS_MAP = {
  br: "W-w-24:H-h-24",
  bl: "24:H-h-24",
  tr: "W-w-24:24",
  tl: "24:24",
};

const SIZE_MAP = {
  sm: 0.16, // logonun video genişliğine oranı
  md: 0.22,
  lg: 0.30,
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code === 0) return resolve({ out, err });
      reject(new Error(`ffmpeg failed (${code})\n${err || out}`));
    });
  });
}

async function downloadTo(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
  await new Promise((resolve, reject) => {
    const s = fs.createWriteStream(filePath);
    res.body.pipe(s);
    res.body.on("error", reject);
    s.on("finish", resolve);
    s.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
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
      res.status(400).json({ ok: false, error: "missing_video_or_logo" });
      return;
    }

    const posExpr = POS_MAP[logo_pos] || POS_MAP.br;
    const sizeRatio = SIZE_MAP[logo_size] ?? SIZE_MAP.sm;

    // ffmpeg: opacity 0..1 clamp
    const op = Math.max(0, Math.min(1, Number(logo_opacity) || 0.85));

    const tmpDir = os.tmpdir();
    const id = job_id || crypto.randomUUID();
    const inVideo = path.join(tmpDir, `aivo-${id}-in.mp4`);
    const inLogo = path.join(tmpDir, `aivo-${id}-logo.png`);
    const outVideo = path.join(tmpDir, `aivo-${id}-out.mp4`);

    // indir
    await downloadTo(video_url, inVideo);
    await downloadTo(logo_url, inLogo);

    // Logo scale: video genişliğine göre ayarla (sizeRatio)
    // Opacity: format=rgba + colorchannelmixer
    // Overlay: seçilen köşe
    const filter = [
      `[1:v]format=rgba,colorchannelmixer=aa=${op}[lg];`,
      `[0:v][lg]overlay=${posExpr}:format=auto`,
    ].join("");

    const scaleFilter = `scale=iw*${sizeRatio}:-1`;

    // 2 aşama yerine tek filtergraph:
    // - logo -> scale -> rgba -> opacity
    // - overlay
    const filterComplex = [
      `[1:v]${scaleFilter},format=rgba,colorchannelmixer=aa=${op}[lg];`,
      `[0:v][lg]overlay=${posExpr}:format=auto[outv]`,
    ].join("");

    await run(ffmpegPath, [
      "-y",
      "-i",
      inVideo,
      "-i",
      inLogo,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
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
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outVideo,
    ]);

    const buf = fs.readFileSync(outVideo);

    // R2 key
    const key = `outputs/${app}/${id}/logo-overlay.mp4`;
    const put = await r2PutObject({
      key,
      body: buf,
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000, immutable",
    });

    // Temizlik (best-effort)
    for (const p of [inVideo, inLogo, outVideo]) {
      try { fs.unlinkSync(p); } catch {}
    }

    res.status(200).json({
      ok: true,
      job_id: id,
      url: put.url, // r2PutObject url döndürmüyorsa burada kendi public base’inle oluştur
      key,
      meta: { logo_pos, logo_size, logo_opacity: op },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
