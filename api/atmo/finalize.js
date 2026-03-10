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

const outputs = Array.isArray(job.outputs) ? job.outputs : [];
const meta = job.meta || {};

const pickUrl = (o) =>
  String(
    o?.archive_url ||
    o?.url ||
    o?.video_url ||
    o?.meta?.archive_url ||
    o?.meta?.url ||
    o?.meta?.video_url ||
    ""
  ).trim();

const normVariant = (o) =>
  String(o?.meta?.variant || "").toLowerCase().trim();

const isVideo = (o) =>
  String(o?.type || "").toLowerCase().trim() === "video";

const muxOut = outputs.find((o) => isVideo(o) && normVariant(o) === "mux");
const providerOut = outputs.find((o) => isVideo(o) && normVariant(o) === "provider");
const finalOut = outputs.find((o) => isVideo(o) && o?.meta?.is_final === true);

const input_url =
  String(meta?.muxed_url || "").trim() ||
  pickUrl(muxOut) ||
  String(meta?.final_video_url || "").trim() ||
  pickUrl(finalOut) ||
  pickUrl(providerOut) ||
  "";

if (!input_url) {
  return res.status(400).json({
    ok: false,
    error: "finalize_input_missing",
    job_id
  });
}

return res.status(200).json({
  ok: true,
  job_id,
  input_url,
  step: "finalize_input_selected"
});
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e)
    });
  }
};
