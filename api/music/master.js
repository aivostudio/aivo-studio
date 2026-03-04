import fs from "fs";
import { neon } from "@neondatabase/serverless";

// NOTE: Vercel/Node ESM'de require lazım olursa:
import { createRequire } from "module";
const require = createRequire(import.meta.url);

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

async function appendMasterOutputToDB({ job_id, url }) {
  const conn = pickConn();
  if (!conn) return { ok: false, skipped: true, reason: "missing_db_env" };

  const sql = neon(conn);

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
    type: "master",
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

function getBaseUrl(req) {
  const proto =
    (req.headers["x-forwarded-proto"]
      ? String(req.headers["x-forwarded-proto"])
      : "https"
    )
      .split(",")[0]
      .trim() || "https";
  const host =
    (req.headers["x-forwarded-host"]
      ? String(req.headers["x-forwarded-host"])
      : "") ||
    (req.headers.host ? String(req.headers.host) : "");
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const audio_url = body.audio_url || body.audioUrl || null;

    // öncelik: provider_job_id (senin gerçek case’in)
    const provider_job_id =
      body.provider_job_id || body.providerJobId || body.provider_id || null;

    // eski/fallback: job_id
    const job_id = body.job_id || body.jobId || null;

    if (!audio_url) {
      return res.status(400).json({ ok: false, error: "missing_audio_url" });
    }

    // master key için stabil id
    const id = String(provider_job_id || job_id || Date.now());
    const inputPath = `/tmp/${id}.mp3`;

    console.log("[MASTER] start", { id, provider_job_id, job_id, audio_url });

    // 1) download audio
    const response = await fetch(audio_url, {
      headers: { "User-Agent": "AIVO-Mastering" },
    });
    if (!response.ok) throw new Error(`download_failed_${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);
    console.log("[MASTER] downloaded", { inputPath, bytes: buffer.length });

    // 2) R2 presign + upload (outputs/master/...)
    const origin = getBaseUrl(req);
    const key = `outputs/master/${id}.mp3`;

    const presignRes = await fetch(`${origin}/api/r2/presign-put`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        contentType: "audio/mpeg",
      }),
    });

    const presignText = await presignRes.text();
    let presign;
    try {
      presign = JSON.parse(presignText);
    } catch {
      presign = null;
    }

    if (!presignRes.ok || !presign?.ok || !presign?.upload_url || !presign?.public_url) {
      return res.status(500).json({
        ok: false,
        error: "presign_failed",
        upstream_status: presignRes.status,
        upstream_preview: String(presignText || "").slice(0, 300),
      });
    }

    const upload_url = presign.upload_url;
    const public_url = presign.public_url;

    const putRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "audio/mpeg" },
      body: buffer,
    });

    if (!putRes.ok) {
      const t = await putRes.text().catch(() => "");
      return res.status(500).json({
        ok: false,
        error: "r2_put_failed",
        upstream_status: putRes.status,
        upstream_preview: String(t || "").slice(0, 300),
      });
    }

    // 3) verify (HEAD public_url)
    const headRes = await fetch(public_url, { method: "HEAD" });
    if (!headRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "r2_verify_failed",
        upstream_status: headRes.status,
        public_url,
      });
    }

    console.log("[MASTER] uploaded", { key, public_url });

    // 4) best-effort: DB append (job row varsa)
    const dbTargetId = String(provider_job_id || job_id || id);
    const db = await appendMasterOutputToDB({ job_id: dbTargetId, url: public_url });

    // 5) best-effort: Redis marker (ileride status.js master’ı buradan da okuyabilir)
    try {
      const { getRedis } = require("../_kv");
      const redis = getRedis();
      await redis.set(
        `music_master:${String(provider_job_id || id)}`,
        JSON.stringify({ url: public_url, at: new Date().toISOString() })
      );
    } catch {}

    return res.status(200).json({
      ok: true,
      provider_job_id: provider_job_id ? String(provider_job_id) : null,
      job_id: id,
      downloaded: true,
      mastering: "completed",
      tmp: inputPath,
      master_url: public_url,
      key,
      db,
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
