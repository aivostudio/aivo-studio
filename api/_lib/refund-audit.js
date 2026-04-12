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

function getSql() {
  const conn = pickConn();
  if (!conn) {
    throw new Error("missing_db_env");
  }
  return neon(conn);
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

function buildMeta(v) {
  if (!v || typeof v !== "object") return {};
  return v;
}

async function writeRefundAudit(input) {
  const sql = getSql();

  const row = {
    scope: "credits_refund",
    user_uuid: safeText(input.user_uuid),
    user_id: safeText(input.user_id),
    app: safeText(input.app),
    action: safeText(input.action),
    amount: safeInt(input.amount),
    request_id: safeText(input.request_id),
    job_id: safeText(input.job_id),
    provider_job_id: safeText(input.provider_job_id),
    related_transaction_id: safeText(input.related_transaction_id),
    reason: safeText(input.reason),
    status: safeText(input.status) || "logged",
    meta: buildMeta(input.meta)
  };

  await sql`
    insert into admin_audit_logs (
      scope,
      user_uuid,
      user_id,
      app,
      action,
      amount,
      request_id,
      job_id,
      provider_job_id,
      related_transaction_id,
      reason,
      status,
      meta,
      created_at
    )
    values (
      ${row.scope},
      ${row.user_uuid}::uuid,
      ${row.user_id},
      ${row.app},
      ${row.action},
      ${row.amount},
      ${row.request_id},
      ${row.job_id},
      ${row.provider_job_id},
      ${row.related_transaction_id}::uuid,
      ${row.reason},
      ${row.status},
      ${row.meta},
      now()
    )
  `;

  return { ok: true };
}

module.exports = {
  writeRefundAudit
};
