// src/server/media/muxMp4WithAudio.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Vercel'de ffmpeg binary lazım. En pratik: ffmpeg-static
// pnpm add ffmpeg-static
// (ya da npm/yarn)
import ffmpegPath from "ffmpeg-static";

async function downloadToFile(url: string, outPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(outPath, buf);
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
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
 * videoUrl (mp4) + audioUrl (mp3/wav/...) => muxed mp4 (aac)
 * @returns muxed mp4 file path (tmp)
 */
export async function muxMp4WithAudio(videoUrl: string, audioUrl: string) {
  if (!ffmpegPath) throw new Error("ffmpeg_static_missing");

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "aivo-mux-"));
  const inVideo = path.join(dir, "in.mp4");
  const inAudio = path.join(dir, "in.audio");
  const outMp4 = path.join(dir, "out.mp4");

  await downloadToFile(videoUrl, inVideo);
  await downloadToFile(audioUrl, inAudio);

  // -c:v copy: video stream'e dokunma
  // -c:a aac: mp4 uyumlu audio
  // -shortest: video süresine göre kes
  await run(ffmpegPath, [
    "-y",
    "-i",
    inVideo,
    "-i",
    inAudio,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    outMp4,
  ]);

  return { outMp4, tmpDir: dir };
}
