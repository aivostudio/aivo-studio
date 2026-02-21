// api/_lib/mux-mp4-with-audio.js
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { Readable } = require('node:stream');

/**
 * Lazy-load ffmpeg-static so the whole API function doesn't crash at import time
 * if dependency is missing in a deploy.
 */
function getFfmpegPath() {
  try {
    // eslint-disable-next-line global-require
    const p = require('ffmpeg-static');
    if (!p || typeof p !== 'string') return null;
    return p;
  } catch (_) {
    return null;
  }
}

function isWebReadableStream(x) {
  return x && typeof x.getReader === 'function';
}

function toNodeReadable(body) {
  if (!body) return null;

  // Node 18+ fetch => Web ReadableStream
  if (isWebReadableStream(body)) {
    if (typeof Readable.fromWeb === 'function') return Readable.fromWeb(body);
    return null;
  }

  // node-fetch or other => Node stream
  if (typeof body.pipe === 'function') return body;

  return null;
}

async function downloadToFile(url, outPath, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 180000;

  // Prefer Node18 native fetch; fallback to node-fetch only if present.
  const fetchFn =
    typeof global.fetch === 'function'
      ? global.fetch
      : (() => {
          try {
            // eslint-disable-next-line global-require
            return require('node-fetch');
          } catch (e) {
            throw new Error('fetch_missing: Node fetch unavailable and node-fetch not installed');
          }
        })();

  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetchFn(url, ac ? { signal: ac.signal } : undefined);
  } catch (e) {
    throw new Error(`download_fetch_failed: ${url} ${String(e?.message || e)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res || !res.ok) {
    const text = res && res.text ? await res.text().catch(() => '') : '';
    throw new Error(
      `download_failed: ${url} status=${res && res.status} ${String(text || '').slice(0, 200)}`
    );
  }

  const nodeStream = toNodeReadable(res.body);
  if (!nodeStream || typeof nodeStream.pipe !== 'function') {
    throw new Error(`download_stream_invalid: ${url} (no pipe)`);
  }

  await fsp.mkdir(path.dirname(outPath), { recursive: true }).catch(() => {});

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);

    const onErr = (err) => {
      try { file.destroy(); } catch (_) {}
      reject(err);
    };

    file.on('error', onErr);
    nodeStream.on('error', onErr);

    file.on('finish', resolve);
    nodeStream.pipe(file);
  });

  return outPath;
}

function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      args,
      { windowsHide: true, maxBuffer: 1024 * 1024 * 20 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || stdout || '').toString().slice(0, 2000);
          reject(new Error(`ffmpeg_failed: ${err.message}\n${msg}`));
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

/**
 * mp4 + audioUrl => muxed mp4 (AAC) produces a local file
 * Returns: { outMp4Path, tmpDir, cleanup() }
 */
async function muxMp4WithAudio(videoUrl, audioUrl) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('ffmpeg_static_missing: add ffmpeg-static to dependencies');
  if (!videoUrl) throw new Error('missing_videoUrl');
  if (!audioUrl) throw new Error('missing_audioUrl');

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aivo-mux-'));
  const inVideo = path.join(tmpDir, 'in.mp4');
  const inAudio = path.join(tmpDir, 'in.audio');
  const outMp4Path = path.join(tmpDir, 'out.mp4');

  try {
    await downloadToFile(videoUrl, inVideo, { timeoutMs: 240000 });
    await downloadToFile(audioUrl, inAudio, { timeoutMs: 240000 });

    // -c:v copy => video stream aynen
    // -c:a aac  => audio AAC'e
    // -shortest => kısa olan bittiğinde bitir
    // +faststart => mp4 hızlı başlasın
    await runFfmpeg(ffmpegPath, [
      '-y',
      '-i', inVideo,
      '-i', inAudio,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-movflags', '+faststart',
      outMp4Path,
    ]);

    async function cleanup() {
      try { await fsp.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }

    return { outMp4Path, tmpDir, cleanup };
  } catch (e) {
    // best-effort cleanup on failure too
    try { await fsp.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
    throw e;
  }
}

module.exports = { muxMp4WithAudio };
