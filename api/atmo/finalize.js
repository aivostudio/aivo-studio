// /api/atmo/finalize.js
// CommonJS
// Atmo için ayrı finalize endpoint:
// input: provider/persisted video url
// output: ileride safari-friendly final mp4 üretip DB'ye yazacak

const { neon } = require("@neondatabase/serverless");

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function isUuidLike(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = req.body || {};
    const job_id = String(body.job_id || "").trim();

    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    if (!isUuidLike(job_id)) {
      return res.status(400).json({ ok: false, error: "job_id_invalid" });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    const rows = await sql`
      select *
      from jobs
      where id = ${job_id}::uuid
      limit 1
    `;

    const job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    if (String(job.app || "").toLowerCase() !== "atmo") {
      return res.status(400).json({ ok: false, error: "job_not_atmo" });
    }

    return res.status(200).json({
      ok: true,
      job_id,
      step: "finalize_endpoint_ready"
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e)
    });
  }
};
