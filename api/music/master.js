// AIVO Mastering Engine
// Step 2: robust audio download

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

    const id = job_id || Date.now().toString();

    console.log("[MASTER] start", {
      job_id: id,
      audio_url
    });

    const tmpPath = `/tmp/${id}.mp3`;

    // download with headers (some CDNs require UA)
    const response = await fetch(audio_url, {
      method: "GET",
      headers: {
        "User-Agent": "AIVO-Mastering-Engine"
      }
    });

    if (!response.ok) {
      throw new Error(`download_failed_${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(tmpPath, buffer);

    console.log("[MASTER] downloaded", tmpPath);

    return res.status(200).json({
      ok: true,
      job_id: id,
      mastered: false,
      downloaded: true,
      tmp: tmpPath
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
