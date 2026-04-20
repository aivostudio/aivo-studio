// api/garanti/apply.js
// GARANTI apply (idempotent + lock)
// TEK SOURCE OF TRUTH: api/_kv.js üzerinden aynı Upstash/Vercel KV client'ı kullanır.

import kvMod from "../_kv.js";

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function safeJsonParse(x) {
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function resolveKv() {
  const kv = kvMod?.default || kvMod || {};

  const getRedis = kv.getRedis;
  const kvGet = kv.kvGet;
  const kvDel = kv.kvDel;
  const kvIncr = kv.kvIncr;
  const kvGetJson = kv.kvGetJson;
  const kvSetJson = kv.kvSetJson;

  if (typeof getRedis !== "function") {
    throw new Error("KV_HELPER_MISSING:getRedis");
  }
  if (typeof kvGet !== "function") {
    throw new Error("KV_HELPER_MISSING:kvGet");
  }
  if (typeof kvDel !== "function") {
    throw new Error("KV_HELPER_MISSING:kvDel");
  }
  if (typeof kvIncr !== "function") {
    throw new Error("KV_HELPER_MISSING:kvIncr");
  }
  if (typeof kvGetJson !== "function") {
    throw new Error("KV_HELPER_MISSING:kvGetJson");
  }
  if (typeof kvSetJson !== "function") {
    throw new Error("KV_HELPER_MISSING:kvSetJson");
  }

  return {
    getRedis,
    kvGet,
    kvDel,
    kvIncr,
    kvGetJson,
    kvSetJson,
  };
}

async function kvType(redis, key) {
  try {
    const t = await redis.type(key);
    return typeof t === "string" ? t : null;
  } catch {
    return null;
  }
}

async function safeDelIfWrongType(redis, kvDel, key, allowedTypes) {
  try {
    const type = await kvType(redis, key);
    if (type && type !== "none" && !allowedTypes.includes(type)) {
      await kvDel(key);
    }
  } catch (_) {}
}

async function setNxWithExpire(redis, key, value, ttlSec) {
  try {
    const result = await redis.set(key, value, { nx: true, ex: ttlSec });
    return result === "OK" || result === true;
  } catch {
    return false;
  }
}

async function lpushJson(redis, key, obj) {
  return await redis.lpush(key, JSON.stringify(obj));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const { getRedis, kvGet, kvDel, kvIncr, kvSetJson } = resolveKv();
    const redis = getRedis();

    const oid =
      (req.method === "GET" ? req.query?.oid : req.body?.oid) ||
      (req.method === "GET" ? req.query?.order_id : req.body?.order_id);

    if (!oid) {
      return json(res, 400, { ok: false, error: "MISSING_OID" });
    }

    const orderKey = `aivo:garanti:order:${oid}`;
    const initKey = `aivo:garanti:order_init:${oid}`;
    const lockKey = `aivo:lock:garanti:apply:${oid}`;
    const processedKey = `processed:garanti:${oid}`;

    const orderRaw = await kvGet(orderKey);
    const order = typeof orderRaw === "string" ? safeJsonParse(orderRaw) : orderRaw;

    if (!order) {
      return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND", oid });
    }

    if (order.status !== "paid") {
      return json(res, 409, {
        ok: false,
        error: "ORDER_NOT_PAID",
        oid,
        status: order.status,
      });
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

    await safeDelIfWrongType(redis, kvDel, processedKey, ["string"]);
    await safeDelIfWrongType(redis, kvDel, creditsKey, ["string"]);
    await safeDelIfWrongType(redis, kvDel, invoicesKey, ["list"]);

    const firstTime = await setNxWithExpire(redis, processedKey, "1", 60 * 60 * 24 * 30);

    if (!firstTime) {
      const cur = Number(await kvGet(creditsKey)) || 0;
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
    const lockOk = await setNxWithExpire(redis, lockKey, lockVal, 30);

    if (!lockOk) {
      return json(res, 429, { ok: false, error: "APPLY_IN_PROGRESS", oid });
    }

    try {
      const freshRaw = await kvGet(orderKey);
      const fresh = typeof freshRaw === "string" ? safeJsonParse(freshRaw) : freshRaw;

      if (!fresh) {
        return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND_AFTER_LOCK", oid });
      }

      if (fresh.status !== "paid") {
        return json(res, 409, {
          ok: false,
          error: "ORDER_NOT_PAID",
          oid,
          status: fresh.status,
        });
      }

      const creditsToAdd = Number(fresh.credits || init?.credits || 0);
      if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
        return json(res, 409, {
          ok: false,
          error: "INVALID_CREDITS",
          oid,
          credits: fresh.credits,
        });
      }

      const newTotal = await kvIncr(creditsKey, creditsToAdd);

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

      await lpushJson(redis, invoicesKey, invoice);

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
      return json(res, 500, {
        ok: false,
        error: "APPLY_FAILED",
        oid,
        detail: String(e?.message || e),
      });
    } finally {
      await kvDel(lockKey);
    }
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "KV_INIT_FAILED",
      detail: String(e?.message || e),
    });
  }
}
