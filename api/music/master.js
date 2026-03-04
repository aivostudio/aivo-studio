import fs from "fs";
import { neon } from "@neondatabase/serverless";

async function appendMasterOutputToDB({ job_id, url }) {
  const dbUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!dbUrl) return { ok: false, skipped: true, reason: "missing_db_env" };

  const sql = neon(dbUrl);

  // job_id bazen: db uuid, internal_job_id, provider_job_id olabilir diye 3’ünü deniyoruz
  const found = await sql`
    select id
    from jobs
    where id::text = ${job_id}
       or internal_job_id = ${job_id}
       or provider_job_id = ${job_id}
    limit 1
  `;

  if (!found || found.length === 0) {
    return { ok: false, skipped: true, reason: "job_not_found" };
  }

  const db_job_id = found[0].id;

  const output = {
    type: "audio",
    url,
    meta: {
      app: "music",
      kind: "master",
      source_job_id: job_id,
      createdAt: new Date().toISOString(),
    },
  };

  // outputs jsonb ise: mevcut array’in sonuna ekliyoruz
  await sql`
    update jobs
    set outputs = coalesce(outputs, '[]'::jsonb) || ${JSON.stringify([output])}::jsonb
    where id = ${db_job_id}
  `;

  return { ok: true, db_job_id };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { audio_url, job_id } = req.body || {};

    if (!audio_url) {
      return res.status(400).json({
        ok: false,
        error: "missing_audio_url",
      });
    }

    const id = job_id || Date.now().toString();
    const inputPath = `/tmp/${id}.mp3`;

    console.log("[MASTER] start", { id, audio_url });

    // download audio
    const response = await fetch(audio_url, {
      headers: { "User-Agent": "AIVO-Mastering" },
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
      mastering: "queued",
      tmp: inputPath,
    });
  } catch (err) {
    console.error("[MASTER] error", err);

    return res.status(500).json({
      ok: false,
      error: "master_failed",
      message: err?.message || String(err),
    });
  }
}
