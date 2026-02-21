// /media/muxMp4WithAudio.js
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");

async function downloadToFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(outPath, buf);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_failed code=${code} ${err}`));
    });
  });
}

/**
 * videoUrl + audioUrl => muxed mp4 (aac)
 */
async function muxMp4WithAudio(videoUrl, audioUrl) {
  if (!ffmpegPath) throw new Error("ffmpeg_static_missing");

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "aivo-mux-"));
  const inVideo = path.join(dir, "in.mp4");
  const inAudio = path.join(dir, "in.audio");
  const outMp4 = path.join(dir, "out.mp4");

  await downloadToFile(videoUrl, inVideo);
  await downloadToFile(audioUrl, inAudio);

  await run(ffmpegPath, [
    "-y",
    "-i", inVideo,
    "-i", inAudio,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    outMp4,
  ]);

  return { outMp4 };
}

module.exports = { muxMp4WithAudio };
