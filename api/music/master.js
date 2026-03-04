// api/music/master.js (CommonJS) - Vercel Node Serverless
const fs = require("fs");
const { neon } = require("@neondatabase/serverless");

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

// getRedis optional (bu repo'da ../_kv varsa kullanır)
let getRedis = null;
try {
  // eslint-disable-next-line import/no-dynamic-require
  getRedis = require("../_kv").getRedis;
} catch {}

async function appendMasterOutputToDB({ job_id, url }) {
  const conn = pickConn();
  if (!conn) return { ok: false, skipped: true, reason: "missing_db_env" };

  const sql = neon(conn);

  // job_id: db uuid / internal_job_id / provider_job_id olabiliyor
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

  await sql`
    update jobs
    set outputs = coalesce(outputs, '[]'::jsonb) || ${JSON.stringify([output])}::jsonb
    where id = ${db_job_id}
  `;

  return { ok: true, db_job_id };
}

module.exports = async (req, res) => {
  try {
    res.setHeader("x-aivo-master-build", "master-cjs-2026-03-05");

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const provider_job_id = body.provider_job_id ? String(body.provider_job_id) : null;
    const audio_url = body.audio_url ? String(body.audio_url) : null;
    const auto = body.auto === true;

    if (!audio_url) {
      return res.status(400).json({ ok: false, error: "missing_audio_url" });
    }

    const id = String(body.job_id || provider_job_id || Date.now());
    const inputPath = `/tmp/${id}.mp3`;

    console.log("[MASTER] start", { id, provider_job_id, auto });

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

    // Şimdilik mastering worker yok -> queued dönüyoruz (auto flag'i kabul ediyoruz)
    // İleride burada mastering pipeline çalışacak, R2 upload + DB append yapılacak.

    // (best-effort) Redis marker
    try {
      if (getRedis && provider_job_id) {
        const redis = getRedis();
        await redis.set(
          `music_master:${provider_job_id}`,
          JSON.stringify({ at: new Date().toISOString(), tmp: inputPath, auto })
        );
      }
    } catch {}

    // (best-effort) DB append yok (master URL yok) -> sadece queued
    return res.status(200).json({
      ok: true,
      job_id: id,
      provider_job_id,
      downloaded: true,
      mastering: "queued",
      tmp: inputPath,
      auto,
    });
  } catch (err) {
    console.error("[MASTER] error", err);
    return res.status(500).json({
      ok: false,
      error: "master_failed",
      message: err?.message || String(err),
    });
  }
};
