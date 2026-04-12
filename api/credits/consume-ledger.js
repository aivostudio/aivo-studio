export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { consumeCredits } = require("../_lib/credits-ledger.js");
const { requireAuth } = authModule;

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

export default async function handler(req, res) {
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
      select id, email, credits
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
    const body = req.body || {};

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

    if (amount <= 0) {
      return safeJson(res, 400, {
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
      return safeJson(res, 400, {
        ok: false,
        error: result?.error || "consume_failed",
        transaction_id: result?.transaction_id || null
      });
    }

    return safeJson(res, 200, {
      ok: true,
      deduped: !!result.deduped,
      credits: typeof result.credits === "number" ? result.credits : null,
      transaction: result.transaction || null,
      transaction_id: result?.transaction?.id || null,
      message: "Kredi düşüldü."
    });
  } catch (e) {
    console.error("credits/consume-ledger failed:", e);
    return safeJson(res, 500, {
      ok: false,
      error: "consume_failed",
      message: String(e?.message || e)
    });
  }
}
