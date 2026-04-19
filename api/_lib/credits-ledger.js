const { neon } = require("@neondatabase/serverless");
const kvMod = require("../_kv.js");

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;
const kvSet = kv.kvSet;

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

function buildMeta(input) {
  if (!input || typeof input !== "object") return {};
  return input;
}

function buildRefundIdempotencyKey({
  app,
  action,
  request_id,
  job_id,
  provider_job_id,
  related_transaction_id
}) {
  return [
    "refund",
    safeText(app) || "unknown_app",
    safeText(action) || "unknown_action",
    safeText(request_id) || "no_request",
    safeText(job_id) || "no_job",
    safeText(provider_job_id) || "no_provider_job",
    safeText(related_transaction_id) || "no_related"
  ].join(":");
}

async function findExistingByIdempotencyKey(sql, idempotencyKey) {
  const rows = await sql`
    select *
    from credit_transactions
    where idempotency_key = ${idempotencyKey}
    limit 1
  `;
  return rows[0] || null;
}

async function insertTransaction(sql, payload) {
  const rows = await sql`
    insert into credit_transactions (
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
      meta
    )
    values (
      ${payload.user_uuid}::uuid,
      ${payload.user_id},
      ${payload.app},
      ${payload.action},
      ${payload.kind},
      ${payload.amount},
      ${payload.currency_unit},
      ${payload.status},
      ${payload.request_id},
      ${payload.job_id},
      ${payload.provider_job_id},
      ${payload.idempotency_key},
      ${payload.related_transaction_id}::uuid,
      ${payload.reason},
      ${payload.meta}
    )
    returning *
  `;
  return rows[0] || null;
}

async function markTransactionStatus(sql, id, status, extraMeta) {
  const rows = await sql`
    update credit_transactions
    set
      status = ${status},
      meta = coalesce(meta, '{}'::jsonb) || ${buildMeta(extraMeta)}
    where id = ${id}::uuid
    returning *
  `;
  return rows[0] || null;
}

async function getUserCredits(sql, userUuid, userId) {
  const email = safeText(userId);
  if (!email) return { credits: 0 };

  if (typeof kvGet !== "function") {
    throw new Error("kv_get_missing");
  }

  const key = `credits:${String(email).trim().toLowerCase()}`;
  const credits = Number(await kvGet(key).catch(() => 0)) || 0;

  return { credits };
}

async function setUserCredits(sql, userUuid, userId, nextCredits) {
  const email = safeText(userId);
  if (!email) return null;

  if (typeof kvSet !== "function") {
    throw new Error("kv_set_missing");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const key = `credits:${normalizedEmail}`;

  await kvSet(key, safeInt(nextCredits));

  return {
    id: userUuid || null,
    email: normalizedEmail,
    credits: safeInt(nextCredits)
  };
}
async function consumeCredits(input) {
  const sql = getSql();

  const payload = {
    user_uuid: safeText(input.user_uuid),
    user_id: safeText(input.user_id),
    app: safeText(input.app),
    action: safeText(input.action),
    kind: "consume",
    amount: safeInt(input.amount),
    currency_unit: "credit",
    status: "pending",
    request_id: safeText(input.request_id),
    job_id: safeText(input.job_id),
    provider_job_id: safeText(input.provider_job_id),
    idempotency_key: safeText(input.idempotency_key),
    related_transaction_id: null,
    reason: safeText(input.reason),
    meta: buildMeta(input.meta)
  };

  if (!payload.user_uuid && !payload.user_id) {
    throw new Error("missing_user");
  }
  if (!payload.app) throw new Error("missing_app");
  if (!payload.action) throw new Error("missing_action");
  if (!payload.idempotency_key) throw new Error("missing_idempotency_key");
  if (payload.amount <= 0) throw new Error("invalid_amount");

  const existing = await findExistingByIdempotencyKey(sql, payload.idempotency_key);
  if (existing) {
    return {
      ok: true,
      deduped: true,
      transaction: existing
    };
  }

  const tx = await insertTransaction(sql, payload);
  if (!tx?.id) {
    throw new Error("consume_insert_failed");
  }

  const user = await getUserCredits(sql, payload.user_uuid, payload.user_id);
  const currentCredits = safeInt(user?.credits);

  if (currentCredits < payload.amount) {
    await markTransactionStatus(sql, tx.id, "failed", {
      error: "insufficient_credits"
    });
    return {
      ok: false,
      error: "insufficient_credits",
      transaction_id: tx.id
    };
  }

  const nextCredits = currentCredits - payload.amount;
  const updatedUser = await setUserCredits(sql, payload.user_uuid, payload.user_id, nextCredits);

  if (!updatedUser) {
    await markTransactionStatus(sql, tx.id, "failed", {
      error: "consume_user_update_failed"
    });
    throw new Error("consume_user_update_failed");
  }

  const finalTx = await markTransactionStatus(sql, tx.id, "applied", {
    credits_before: currentCredits,
    credits_after: nextCredits
  });

  return {
    ok: true,
    deduped: false,
    transaction: finalTx,
    credits: nextCredits
  };
}

async function refundCredits(input) {
  const sql = getSql();

  const payload = {
    user_uuid: safeText(input.user_uuid),
    user_id: safeText(input.user_id),
    app: safeText(input.app),
    action: safeText(input.action),
    kind: "refund",
    amount: safeInt(input.amount),
    currency_unit: "credit",
    status: "pending",
    request_id: safeText(input.request_id),
    job_id: safeText(input.job_id),
    provider_job_id: safeText(input.provider_job_id),
    related_transaction_id: safeText(input.related_transaction_id),
    reason: safeText(input.reason),
    meta: buildMeta(input.meta)
  };

  if (!payload.user_uuid && !payload.user_id) {
    throw new Error("missing_user");
  }
  if (!payload.app) throw new Error("missing_app");
  if (!payload.action) throw new Error("missing_action");
  if (payload.amount <= 0) throw new Error("invalid_amount");
  if (!payload.related_transaction_id) throw new Error("missing_related_transaction_id");

  payload.idempotency_key =
    safeText(input.idempotency_key) ||
    buildRefundIdempotencyKey(payload);

  const existing = await findExistingByIdempotencyKey(sql, payload.idempotency_key);
  if (existing) {
    return {
      ok: true,
      deduped: true,
      refunded: existing.status === "applied",
      transaction: existing
    };
  }

  const sourceRows = await sql`
    select *
    from credit_transactions
    where id = ${payload.related_transaction_id}::uuid
    limit 1
  `;
  const source = sourceRows[0] || null;

  if (!source) {
    throw new Error("related_transaction_not_found");
  }

  if (String(source.kind || "") !== "consume") {
    throw new Error("related_transaction_invalid_kind");
  }

  if (String(source.status || "") !== "applied") {
    return {
      ok: true,
      deduped: false,
      refunded: false,
      skipped: true,
      reason: "source_not_applied"
    };
  }

  const tx = await insertTransaction(sql, payload);
  if (!tx?.id) {
    throw new Error("refund_insert_failed");
  }

  const user = await getUserCredits(sql, payload.user_uuid, payload.user_id);
  const currentCredits = safeInt(user?.credits);
  const nextCredits = currentCredits + payload.amount;

  const updatedUser = await setUserCredits(sql, payload.user_uuid, payload.user_id, nextCredits);
  if (!updatedUser) {
    await markTransactionStatus(sql, tx.id, "failed", {
      error: "refund_user_update_failed"
    });
    throw new Error("refund_user_update_failed");
  }

  const finalTx = await markTransactionStatus(sql, tx.id, "applied", {
    credits_before: currentCredits,
    credits_after: nextCredits,
    related_transaction_id: payload.related_transaction_id
  });

  return {
    ok: true,
    deduped: false,
    refunded: true,
    skipped: false,
    transaction: finalTx,
    credits: nextCredits
  };
}

module.exports = {
  consumeCredits,
  refundCredits,
  buildRefundIdempotencyKey
};
