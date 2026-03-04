// api/media/convert-wav.js
// MP3 -> WAV (44.1kHz, PCM s16le) converter + direct download
// + AUTO PERSIST stems to R2 (optional)
// NOTE: CommonJS build (fixes "Cannot use import statement outside a module")

const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { spawn } = require("child_process");
const crypto = require("crypto");

const ffmpegPath = require("ffmpeg-static");

// R2 persist
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { r2 } = require("../_lib/r2.js");

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
  try {
    const u = new URL(s);
    if (u.pathname === "/api/media/proxy") {
      const inner = u.searchParams.get("url");
      return inner ? decodeURIComponent(inner) : "";
    }
    return s;
  } catch {
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

function cleanBase(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

function stemFromFilename(filename) {
  const f = String(filename || "").trim().toLowerCase();
  if (!f) return "";
  const base = f.replace(/\.wav$/i, "").trim();
  const allowed = new Set(["vocals", "drums", "bass", "other", "guitar", "piano"]);
  return allowed.has(base) ? base : "";
}

async function persistWavToR2({ outPath, jobId, stem }) {
  const publicBase = process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE;
  if (!publicBase) throw new Error("missing_env:R2_PUBLIC_BASE_URL (or R2_PUBLIC_BASE)");
  if (!process.env.R2_BUCKET) throw new Error("missing_env:R2_BUCKET");

  const safeStem = String(stem || "").trim().toLowerCase();
  if (!safeStem || !/^[a-z0-9_-]{2,32}$/.test(safeStem)) {
    throw new Error("missing_or_invalid_stem");
  }

  const id = String(jobId || "").trim();
  const baseKey = id
    ? `outputs/music/${id}/stems/`
    : `outputs/music/_stems/${crypto.randomUUID()}/`;

  const key = `${baseKey}${safeStem}.wav`;
  const wavBuf = fs.readFileSync(outPath);

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: wavBuf,
      ContentType: "audio/wav",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const base = cleanBase(publicBase);
  return { url: `${base}/${key}`, key };
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range,Content-Type");
    res.setHeader("X-AIVO-Convert", "wav");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!ffmpegPath) {
      return res.status(500).json({ ok: false, error: "missing_ffmpeg_static" });
    }

    const rawUrl = String((req.query && req.query.url) || "").trim();
    const upstreamUrl = pickUpstreamUrl(rawUrl);
    if (!upstreamUrl) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_url" });
    }

    const viaProxy = `https://aivo.tr/api/media/proxy?url=${encodeURIComponent(upstreamUrl)}`;

    const inPath = path.join("/tmp", `aivo_in_${Date.now()}.mp3`);
    const outPath = path.join("/tmp", `aivo_out_${Date.now()}.wav`);

    // 1) Download to /tmp
    const r = await fetch(viaProxy, { method: "GET", redirect: "follow" });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(r.status).end(t || "upstream_download_failed");
    }
    await pipeline(r.body, fs.createWriteStream(inPath));

    // 2) Convert
    await new Promise((resolve, reject) => {
      const ff = spawn(
        ffmpegPath,
        ["-y", "-i", inPath, "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2", outPath],
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

    // 3) Persist logic
    const persist = String(((req.query && req.query.persist) || "")).trim() === "1";
    const filenameRaw = String(((req.query && req.query.filename) || "")).trim();
    const autoStem = stemFromFilename(filenameRaw);
    const autoPersist = !persist && !!autoStem;

    if (persist || autoPersist) {
      const jobId = String(((req.query && req.query.job_id) || "")).trim();
      const stem = persist
        ? String(((req.query && req.query.stem) || "")).trim().toLowerCase()
        : autoStem;

      if (persist && !jobId) {
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        return res.status(400).json({ ok: false, error: "missing_job_id" });
      }

      let out;
      try {
        out = await persistWavToR2({ outPath, jobId, stem });
      } catch (e) {
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
      }

      // IMPORTANT: AUTO persist -> attachment download (redirect yapmıyoruz)
      if (!persist) {
        const dlName = safeFilename(req.query.filename || `${autoStem}.wav`);
        res.status(200);
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Disposition", `attachment; filename="${dlName}"`);
        res.setHeader("Cache-Control", "no-store");

        if (req.method === "HEAD") {
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
      }

      // explicit persist=1 -> JSON
      try { fs.unlinkSync(inPath); } catch {}
      try { fs.unlinkSync(outPath); } catch {}

      if (req.method === "HEAD") {
        res.status(200);
        res.setHeader("Content-Type", "application/json");
        return res.end();
      }
      return res.status(200).json({ ok: true, url: out.url, key: out.key });
    }

    // 4) Default: direct download (no persist)
    const filename = safeFilename(req.query.filename || "stem.wav");
    res.status(200);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "HEAD") {
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
};
