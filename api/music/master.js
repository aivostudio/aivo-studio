// AIVO Mastering Engine
// Step 2: audio download stage

import fs from "fs";

export default async function handler(req, res) {
  try {

    const { audio_url, job_id } = req.body || {};

    if (!audio_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_audio_url"
      });
    }

    console.log("[MASTER] start", {
      job_id,
      audio_url
    });

    // TMP path
    const tmpPath = `/tmp/${job_id}.mp3`;

    // download audio
    const response = await fetch(audio_url);

    if (!response.ok) {
      throw new Error("audio_download_failed");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    fs.writeFileSync(tmpPath, buffer);

    console.log("[MASTER] downloaded", tmpPath);

    // mastering henüz yapılmıyor
    return res.status(200).json({
      ok: true,
      job_id,
      mastered: false,
      downloaded: true,
      tmp: tmpPath
    });

  } catch (err) {

    console.error("[MASTER] error", err);

    return res.status(500).json({
      ok: false,
      error: "master_failed"
    });

  }
}
