const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");

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

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

function isValidDateOnly(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function resolveDateRange(dateStr) {
  const base = isValidDateOnly(dateStr)
    ? String(dateStr)
    : new Date().toISOString().slice(0, 10);

  const start = `${base}T00:00:00.000Z`;
  const end = `${base}T23:59:59.999Z`;

  return {
    date: base,
    start,
    end
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return safeJson(res, 405, {
        ok: false,
        error: "method_not_allowed"
      });
    }

    const conn = pickConn();
    if (!conn) {
      return safeJson(res, 500, {
        ok: false,
        error: "missing_db_env"
      });
    }

    if (typeof requireAuth !== "function") {
      return safeJson(res, 500, {
        ok: false,
        error: "require_auth_missing"
      });
    }

    try {
      await requireAuth(req);
    } catch (e) {
      return safeJson(res, 401, {
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const dateParam = safeText(req.query?.date);
    const { date, start, end } = resolveDateRange(dateParam);

    const sql = neon(conn);

    const rows = await sql`
      select
        id,
        user_uuid,
        user_id,
        app,
        action,
        kind,
        amount,
        currency_unit,
        status,
        request_id,
        job_id,
        provider_job_id,
        idempotency_key,
        related_transaction_id,
        reason,
        meta,
        created_at,
        updated_at
      from credit_transactions
      where status = 'applied'
        and created_at >= ${start}::timestamptz
        and created_at <= ${end}::timestamptz
      order by created_at desc
    `;

    return safeJson(res, 200, {
      ok: true,
      date,
      count: Array.isArray(rows) ? rows.length : 0,
      rows: Array.isArray(rows) ? rows : []
    });
  } catch (e) {
    console.error("admin/daily-credit-stats failed:", e);
    return safeJson(res, 500, {
      ok: false,
      error: "daily_credit_stats_failed",
      message: String(e?.message || e)
    });
  }
};
