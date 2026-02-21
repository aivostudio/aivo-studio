// api/_lib/mux-mp4-with-audio.js
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function downloadToFile(url, outPath) {
  // Node 18+ fetch var; yoksa fallback için node-fetch gerekebilir.
  const fetchFn = global.fetch || require('node-fetch');
  const res = await fetchFn(url);

  if (!res || !res.ok) {
    const text = res && res.text ? await res.text().catch(() => '') : '';
    throw new Error(`download_failed: ${url} status=${res && res.status} ${text?.slice(0, 200) || ''}`);
  }

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    res.body.pipe(file);
    res.body.on('error', reject);
    file.on('finish', resolve);
    file.on('error', reject);
  });

  return outPath;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || stdout || '').toString().slice(0, 2000);
        reject(new Error(`ffmpeg_failed: ${err.message}\n${msg}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * mp4 + audioUrl => muxed mp4 (AAC) produces a local file
 * Returns: { outMp4Path, tmpDir, cleanup() }
 */
async function muxMp4WithAudio(videoUrl, audioUrl) {
  if (!ffmpegPath) throw new Error('ffmpeg_static_missing');
  if (!videoUrl) throw new Error('missing_videoUrl');
  if (!audioUrl) throw new Error('missing_audioUrl');

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aivo-mux-'));
  const inVideo = path.join(tmpDir, 'in.mp4');
  const inAudio = path.join(tmpDir, 'in.audio');
  const outMp4Path = path.join(tmpDir, 'out.mp4');

  await downloadToFile(videoUrl, inVideo);
  await downloadToFile(audioUrl, inAudio);

  // -c:v copy => video stream aynen
  // -c:a aac  => audio AAC'e
  // -shortest => kısa olan bittiğinde bitir
  // +faststart => mp4 hızlı başlasın
  await runFfmpeg([
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
}

module.exports = { muxMp4WithAudio };
