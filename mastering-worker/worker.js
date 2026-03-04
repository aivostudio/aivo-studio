// AIVO Mastering Worker
// Step 1: basic mastering pipeline (FFmpeg)

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const JOB_FILE = "./job.json"; // test için yerel job dosyası

async function run() {
  try {

    if (!fs.existsSync(JOB_FILE)) {
      console.log("[WORKER] job.json bulunamadı, bekleniyor...");
      return;
    }

    const job = JSON.parse(fs.readFileSync(JOB_FILE, "utf8"));

    const { job_id, audio_url } = job;

    if (!audio_url) {
      throw new Error("audio_url missing");
    }

    console.log("[WORKER] job başladı", job_id);

    const inputPath = `/tmp/${job_id}.mp3`;
    const outputPath = `/tmp/${job_id}_master.mp3`;

    // download mp3
    const res = await fetch(audio_url);

    if (!res.ok) {
      throw new Error("download failed");
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    console.log("[WORKER] indirildi:", inputPath);

    // FFmpeg mastering
    const cmd = `
ffmpeg -y -i ${inputPath} \
-af "loudnorm=I=-14:LRA=11:TP=-1.5,\
acompressor=threshold=-18dB:ratio=3:attack=5:release=50,\
equalizer=f=80:t=h:width=200:g=-3,\
equalizer=f=3000:t=q:w=1:g=2,\
equalizer=f=12000:t=h:w=200:g=2,\
stereotools=mlev=1.1,\
afade=t=in:st=0:d=1,\
afade=t=out:st=999:d=1" \
${outputPath}
`;

    execSync(cmd);

    console.log("[WORKER] mastering tamamlandı:", outputPath);

  } catch (err) {
    console.error("[WORKER] hata:", err.message);
  }
}

run();
