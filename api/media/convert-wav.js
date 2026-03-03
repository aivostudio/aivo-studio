// api/media/convert-wav.js
// MP3 -> WAV (44.1kHz, PCM s16le) converter + direct download
// Works great for "stems" when provider only returns MP3.
// Requires dependency: ffmpeg-static (see command below)

import { URL } from "url";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";

import ffmpegPath from "ffmpeg-static";

function safeFilename(name) {
  const s = String(name || "").trim();
  if (!s) return "track.wav";
  const cleaned = s
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  return cleaned.toLowerCase().endsWith(".wav") ? cleaned : `${cleaned}.wav`;
}

function pickUpstreamUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  // allow passing either upstream url OR our proxy url
  // if proxy: /api/media/proxy?url=<encoded>
  try {
    const u = new URL(s);
    if (u.pathname === "/api/media/proxy") {
      const inner = u.searchParams.get("url");
      return inner ? decodeURIComponent(inner) : "";
    }
    return s;
  } catch {
    // might be relative (proxy path)
    try {
      const u2 = new URL(s, "https://aivo.tr");
      if (u2.pathname === "/api/media/proxy") {
        const inner = u2.searchParams.get("url");
        return inner ? decodeURIComponent(inner) : "";
      }
    } catch {}
    return "";
  }
}

export default async function handler(req, res) {
  try {
    // CORS (optional)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range,Content-Type");

    // debug marker
    res.setHeader("X-AIVO-Convert", "wav");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // IMPORTANT: ffmpeg must exist
    if (!ffmpegPath) {
      return res.status(500).json({ ok: false, error: "missing_ffmpeg_static" });
    }

    const rawUrl = String(req.query.url || "").trim();
    const upstreamUrl = pickUpstreamUrl(rawUrl);
    if (!upstreamUrl) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_url" });
    }

    // We download via OUR proxy to keep allowlist/security centralized.
    const viaProxy = `https://aivo.tr/api/media/proxy?url=${encodeURIComponent(upstreamUrl)}`;

    // temp paths (Vercel supports /tmp)
    const inPath = path.join("/tmp", `aivo_in_${Date.now()}.mp3`);
    const outPath = path.join("/tmp", `aivo_out_${Date.now()}.wav`);

    // 1) Download MP3 to /tmp
    const r = await fetch(viaProxy, { method: "GET", redirect: "follow" });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(r.status).end(t || "upstream_download_failed");
    }
    await pipeline(r.body, fs.createWriteStream(inPath));

    // 2) Convert to WAV (44.1kHz, PCM s16le)
    // ffmpeg -y -i in.mp3 -acodec pcm_s16le -ar 44100 -ac 2 out.wav
    await new Promise((resolve, reject) => {
      const ff = spawn(
        ffmpegPath,
        [
          "-y",
          "-i",
          inPath,
          "-acodec",
          "pcm_s16le",
          "-ar",
          "44100",
          "-ac",
          "2",
          outPath,
        ],
        { stdio: ["ignore", "ignore", "pipe"] }
      );

      let errBuf = "";
      ff.stderr.on("data", (d) => {
        errBuf += d ? d.toString() : "";
        if (errBuf.length > 8000) errBuf = errBuf.slice(-8000);
      });

      ff.on("error", (e) => reject(e));
      ff.on("close", (code) => {
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg_failed code=${code} stderr=${errBuf}`));
      });
    });

    // 3) Respond as direct download (no new page)
    const filename = safeFilename(req.query.filename || "stem.wav");
    res.status(200);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "HEAD") {
      // cleanup
      try { fs.unlinkSync(inPath); } catch {}
      try { fs.unlinkSync(outPath); } catch {}
      return res.end();
    }

    const stat = fs.statSync(outPath);
    res.setHeader("Content-Length", String(stat.size));

    const readStream = fs.createReadStream(outPath);
    readStream.on("close", () => {
      try { fs.unlinkSync(inPath); } catch {}
      try { fs.unlinkSync(outPath); } catch {}
    });
    readStream.on("error", () => {
      try { fs.unlinkSync(inPath); } catch {}
      try { fs.unlinkSync(outPath); } catch {}
    });

    return readStream.pipe(res);
  } catch (err) {
    console.error("convert_wav_error:", err);
    return res.status(500).end("convert_wav_failed");
  }
}
