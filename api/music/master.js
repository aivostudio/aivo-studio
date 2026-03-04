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
    const inputPath = `/tmp/${id}.mp3`;

    console.log("[MASTER] start", { id, audio_url });

    // download audio
    const response = await fetch(audio_url, {
      headers: { "User-Agent": "AIVO-Mastering" }
    });

    if (!response.ok) {
      throw new Error(`download_failed_${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    console.log("[MASTER] downloaded", inputPath);

    // placeholder (mastering worker later)
    return res.status(200).json({
      ok: true,
      job_id: id,
      downloaded: true,
      mastering: "queued"
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
