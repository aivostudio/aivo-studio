const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");
const { refundCredits } = require("../_lib/credits-ledger.js");
const { writeRefundAudit } = require("../_lib/refund-audit.js");

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

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
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

    let auth;
    try {
      auth = await requireAuth(req);
    } catch (e) {
      return safeJson(res, 401, {
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const email = safeText(auth?.email);
    if (!email) {
      return safeJson(res, 401, {
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
      return safeJson(res, 401, {
        ok: false,
        error: "user_not_found"
      });
    }

    const user_uuid = String(userRows[0].id);
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const app = safeText(body.app);
    const action = safeText(body.action);
    const amount = safeInt(body.amount || body.cost);
    const request_id = safeText(body.request_id);
    const job_id = safeText(body.job_id);
    const provider_job_id = safeText(body.provider_job_id);
    const related_transaction_id = safeText(body.related_transaction_id);
    const reason = safeText(body.reason) || "provider_create_failed";
    const idempotency_key = safeText(body.idempotency_key);

    if (!app) {
      return safeJson(res, 400, {
        ok: false,
        error: "missing_app"
      });
    }

    if (!action) {
      return safeJson(res, 400, {
        ok: false,
        error: "missing_action"
      });
    }

    if (!related_transaction_id) {
      return safeJson(res, 400, {
        ok: false,
        error: "missing_related_transaction_id"
      });
    }

    if (amount <= 0) {
      return safeJson(res, 400, {
        ok: false,
        error: "invalid_amount"
      });
    }

    const result = await refundCredits({
      user_uuid,
      user_id: email,
      app,
      action,
      amount,
      request_id,
      job_id,
      provider_job_id,
      related_transaction_id,
      reason,
      idempotency_key,
      meta: {
        source: "api/credits/refund",
        refund_message: "İşlem başarısız oldu, kredi iade edildi."
      }
    });

    if (!result?.ok) {
      return safeJson(res, 400, {
        ok: false,
        error: result?.error || "refund_failed",
        transaction_id: result?.transaction_id || null
      });
    }

    try {
      await writeRefundAudit({
        user_uuid,
        user_id: email,
        app,
        action,
        amount,
        request_id,
        job_id,
        provider_job_id,
        related_transaction_id,
        reason,
        status: result.refunded
          ? "refunded"
          : (result.skipped ? "skipped" : (result.deduped ? "deduped" : "processed")),
        meta: {
          source: "api/credits/refund",
          refunded: !!result.refunded,
          deduped: !!result.deduped,
          skipped: !!result.skipped,
          refund_transaction_id: result?.transaction?.id || null
        }
      });
    } catch (auditErr) {
      console.error("refund audit write failed:", auditErr);
    }

    return safeJson(res, 200, {
      ok: true,
      refunded: !!result.refunded,
      deduped: !!result.deduped,
      skipped: !!result.skipped,
      credits: typeof result.credits === "number" ? result.credits : null,
      transaction: result.transaction || null,
      message: result.refunded
        ? "İşlem başarısız oldu, kredi iade edildi."
        : (result.skipped ? "İade atlandı." : "İade zaten uygulanmış.")
    });
  } catch (e) {
    console.error("credits/refund failed:", e);
    return safeJson(res, 500, {
      ok: false,
      error: "refund_failed",
      message: String(e?.message || e)
    });
  }
};
