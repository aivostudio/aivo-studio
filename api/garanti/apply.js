// /api/garanti/apply.js
// GARANTI apply (idempotent + lock)
// credits:<email> (string sayı)
// invoices:<email> (list, JSON string)

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function safeJsonParse(x) {
  try { return JSON.parse(x); } catch { return null; }
}

async function kvCmd(path, { method = "GET", body } = {}) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  return data && typeof data === "object" && "result" in data ? data.result : data;
}

async function kvGet(key) {
  const r = await kvCmd(`/get/${encodeURIComponent(key)}`);
  if (r && typeof r === "object" && "value" in r) return r.value;
  return r;
}

async function kvSetJson(key, obj, { exSec } = {}) {
  const q = exSec ? `?EX=${encodeURIComponent(String(exSec))}` : "";
  return kvCmd(`/set/${encodeURIComponent(key)}${q}`, { method: "POST", body: obj });
}

async function kvSetNxLock(lockKey, lockValue, ttlSec) {
  const path =
    `/set/${encodeURIComponent(lockKey)}` +
    `/${encodeURIComponent(lockValue)}` +
    `/NX/EX/${encodeURIComponent(String(ttlSec))}`;
  return kvCmd(path);
}

async function kvDel(key) {
  return kvCmd(`/del/${encodeURIComponent(key)}`);
}

async function kvIncrBy(key, by) {
  return kvCmd(`/incrby/${encodeURIComponent(key)}/${encodeURIComponent(String(by))}`);
}

async function kvLpush(key, valueStr) {
  return kvCmd(`/lpush/${encodeURIComponent(key)}`, { method: "POST", body: valueStr });
}

async function safeDelIfWrongType(key, allowedTypes) {
  try {
    const t = await kvCmd(`/type/${encodeURIComponent(key)}`);
    const type = (t && typeof t === "string") ? t : null;
    if (type && type !== "none" && !allowedTypes.includes(type)) {
      await kvDel(key);
    }
  } catch (_) {}
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const oid =
    (req.method === "GET" ? req.query?.oid : req.body?.oid) ||
    (req.method === "GET" ? req.query?.order_id : req.body?.order_id);

  if (!oid) return json(res, 400, { ok: false, error: "MISSING_OID" });

  const orderKey = `aivo:garanti:order:${oid}`;
  const initKey = `aivo:garanti:order_init:${oid}`;
  const lockKey = `aivo:lock:garanti:apply:${oid}`;
  const processedKey = `processed:garanti:${oid}`;

  const orderRaw = await kvGet(orderKey);
  const order = typeof orderRaw === "string" ? safeJsonParse(orderRaw) : orderRaw;
  if (!order) return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND", oid });

  if (order.status !== "paid") {
    return json(res, 409, { ok: false, error: "ORDER_NOT_PAID", oid, status: order.status });
  }

  const initRaw = await kvGet(initKey);
  const init = typeof initRaw === "string" ? safeJsonParse(initRaw) : initRaw;

  const email = normEmail(init?.email || order.email || init?.user_email || null);
  if (!email) {
    return json(res, 409, {
      ok: false,
      error: "EMAIL_BINDING_MISSING",
      message: "garanti init tarafında aivo:garanti:order_init:<oid> içine email yazılmalı.",
      oid,
    });
  }

  const creditsKey = `credits:${email}`;
  const invoicesKey = `invoices:${email}`;

  await safeDelIfWrongType(processedKey, ["string"]);
  await safeDelIfWrongType(creditsKey, ["string"]);
  await safeDelIfWrongType(invoicesKey, ["list"]);

  const firstTime = await kvCmd(
    `/set/${encodeURIComponent(processedKey)}/1/NX/EX/${encodeURIComponent(String(60 * 60 * 24 * 30))}`
  );

  if (!firstTime) {
    const cur = Number(await kvGet(creditsKey) || 0) || 0;
    const existingInvoiceId = `garanti_${oid}`;

    return json(res, 200, {
      ok: true,
      oid,
      email,
      added: 0,
      credits: cur,
      credits_balance: cur,
      invoiceId: existingInvoiceId,
      invoice_id: existingInvoiceId,
      credit_applied: true,
      invoice_created: true,
      already_processed: true,
    });
  }

  const lockVal = `garanti_apply_${Date.now()}`;
  const lockOk = await kvSetNxLock(lockKey, lockVal, 30);
  if (!lockOk) {
    return json(res, 429, { ok: false, error: "APPLY_IN_PROGRESS", oid });
  }

  try {
    const freshRaw = await kvGet(orderKey);
    const fresh = typeof freshRaw === "string" ? safeJsonParse(freshRaw) : freshRaw;
    if (!fresh) return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND_AFTER_LOCK", oid });

    if (fresh.status !== "paid") {
      return json(res, 409, { ok: false, error: "ORDER_NOT_PAID", oid, status: fresh.status });
    }

    const creditsToAdd = Number(fresh.credits || init?.credits || 0);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return json(res, 409, { ok: false, error: "INVALID_CREDITS", oid, credits: fresh.credits });
    }

    const newTotal = await kvIncrBy(creditsKey, creditsToAdd);

    const invoiceId = `garanti_${oid}`;
    const invoice = {
      id: invoiceId,
      provider: "garanti",
      type: "purchase",
      oid,
      email,
      plan: fresh.plan || init?.plan || null,
      credits: creditsToAdd,
      amountTRY: fresh.amount || init?.amount || null,
      created_at: new Date().toISOString(),
      status: "paid",
    };

    await kvLpush(invoicesKey, JSON.stringify(invoice));

    fresh.credit_applied = true;
    fresh.invoice_created = true;
    fresh.invoice_id = invoiceId;
    fresh.applied_at = new Date().toISOString();
    await kvSetJson(orderKey, fresh);

    return json(res, 200, {
      ok: true,
      oid,
      email,
      added: creditsToAdd,
      credits: Number(newTotal) || 0,
      credits_balance: Number(newTotal) || 0,
      invoiceId,
      invoice_id: invoiceId,
      credit_applied: true,
      invoice_created: true,
      already_processed: false,
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "APPLY_FAILED", oid, detail: String(e?.message || e) });
  } finally {
    await kvDel(lockKey);
  }
}
