'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { Readable } = require('node:stream');

function getFfmpegPath() {
  try {
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
  if (isWebReadableStream(body)) {
    if (typeof Readable.fromWeb === 'function') return Readable.fromWeb(body);
    return null;
  }
  if (typeof body.pipe === 'function') return body;
  return null;
}

async function downloadToFile(url, outPath, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 180000;

  const fetchFn =
    typeof global.fetch === 'function'
      ? global.fetch
      : (() => {
          try {
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

async function faststartMp4(videoUrl) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('ffmpeg_static_missing: add ffmpeg-static to dependencies');
  if (!videoUrl) throw new Error('missing_videoUrl');

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aivo-faststart-'));
  const inVideo = path.join(tmpDir, 'in.mp4');
  const outMp4Path = path.join(tmpDir, 'out.mp4');

  try {
    await downloadToFile(videoUrl, inVideo, { timeoutMs: 240000 });

    await runFfmpeg(ffmpegPath, [
      '-y',
      '-i', inVideo,
      '-c', 'copy',
      '-movflags', '+faststart',
      outMp4Path,
    ]);

    async function cleanup() {
      try { await fsp.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }

    return { outMp4Path, tmpDir, cleanup };
  } catch (e) {
    try { await fsp.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
    throw e;
  }
}

module.exports = { faststartMp4 };
