import fs from "fs";
import { execSync } from "child_process";

export default async function handler(req, res) {
  try {

    const { audio_url, job_id } = req.body || {};

    if (!audio_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_audio_url"
      });
    }

    const id = job_id || Date.now().toString();

    const inputPath = `/tmp/${id}.mp3`;
    const outputPath = `/tmp/${id}_master.mp3`;

    console.log("[MASTER] start", { id, audio_url });

    // download
    const response = await fetch(audio_url, {
      headers: { "User-Agent": "AIVO-Mastering" }
    });

    if (!response.ok) {
      throw new Error(`download_failed_${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    console.log("[MASTER] downloaded", inputPath);

    // MASTERING PIPELINE
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

    console.log("[MASTER] mastered", outputPath);

    return res.status(200).json({
      ok: true,
      job_id: id,
      mastered: true,
      input: inputPath,
      output: outputPath
    });

  } catch (err) {

    console.error("[MASTER] error", err);

    return res.status(500).json({
      ok: false,
      error: "master_failed",
      message: err.message
    });

  }
}
