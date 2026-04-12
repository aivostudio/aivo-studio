const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");
const { consumeCredits } = require("../_lib/credits-ledger.js");

const requireAuth =
  authModule?.requireAuth ||
  authModule?.default?.requireAuth;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function safeText(v) {
  const s = String(v == null ? "" : v).trim();
  return s || null;
}

function safeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function buildConsumeIdempotencyKey({
  app,
  action,
  request_id,
  job_id,
  provider_job_id
}) {
  return [
    "consume",
    safeText(app) || "unknown_app",
    safeText(action) || "unknown_action",
    safeText(request_id) || "no_request",
    safeText(job_id) || "no_job",
    safeText(provider_job_id) || "no_provider_job"
  ].join(":");
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const conn = pickConn();
    if (!conn) {
      return res.status(500).json({
        ok: false,
        error: "missing_db_env"
      });
    }

    if (typeof requireAuth !== "function") {
      return res.status(500).json({
        ok: false,
        error: "require_auth_missing"
      });
    }

    let auth;
    try {
      auth = await requireAuth(req);
    } catch (e) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const email = safeText(auth?.email);
    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "missing_email"
      });
    }

    const sql = neon(conn);

 const userRows = await sql`
  select id, email
  from users
  where email = ${email}
  limit 1
`;

    if (!userRows.length) {
      return res.status(401).json({
        ok: false,
        error: "user_not_found"
      });
    }

    const user_uuid = String(userRows[0].id);
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const app = safeText(body.app) || "unknown_app";
    const action =
      safeText(body.action) ||
      safeText(body.reason) ||
      "generic_consume";

    const amount = safeInt(body.amount || body.cost);
    const request_id = safeText(body.request_id);
    const job_id = safeText(body.job_id);
    const provider_job_id = safeText(body.provider_job_id);
    const reason = safeText(body.reason) || action;

    const idempotency_key =
      safeText(body.idempotency_key) ||
      buildConsumeIdempotencyKey({
        app,
        action,
        request_id,
        job_id,
        provider_job_id
      });

    if (amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "invalid_amount"
      });
    }

    const result = await consumeCredits({
      user_uuid,
      user_id: email,
      app,
      action,
      amount,
      request_id,
      job_id,
      provider_job_id,
      idempotency_key,
      reason,
      meta: {
        source: "api/credits/consume-ledger"
      }
    });

    if (!result?.ok) {
      return res.status(400).json({
        ok: false,
        error: result?.error || "consume_failed",
        transaction_id: result?.transaction_id || null
      });
    }

    return res.status(200).json({
      ok: true,
      deduped: !!result.deduped,
      credits: typeof result.credits === "number" ? result.credits : null,
      transaction: result.transaction || null,
      transaction_id: result?.transaction?.id || null,
      message: "Kredi düşüldü."
    });
  } catch (e) {
    console.error("credits/consume-ledger failed:", e);
    return res.status(500).json({
      ok: false,
      error: "consume_failed",
      message: String(e?.message || e)
    });
  }
};
