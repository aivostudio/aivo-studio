// /api/stripe/verify-session.js
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const redis = Redis.fromEnv();

function j(res, code, obj) {
  res
    .status(code)
    .setHeader("content-type", "application/json")
    .send(JSON.stringify(obj));
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function safeStr(v) {
  return String(v == null ? "" : v).trim();
}

async function safeType(key) {
  try {
    return await redis.type(key);
  } catch (_) {
    return null;
  }
}

async function ensureStringKey(key) {
  const t = await safeType(key);
  if (!t || t === "none" || t === "string") return true;
  await redis.del(key);
  return true;
}

async function ensureStringOrNone(key) {
  const t = await safeType(key);
  if (!t || t === "none" || t === "string") return true;
  await redis.del(key);
  return true;
}

export default async function handler(req, res) {
  console.log("[VERIFY] START", { method: req.method, url: req.url });

  if (req.method !== "POST") {
    return j(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const session_id = safeStr(body.session_id || body.sessionId);
    if (!session_id) {
      return j(res, 400, { ok: false, error: "missing_session_id" });
    }

    // Stripe session fetch
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("[VERIFY] SESSION", {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      metadata: session.metadata,
    });

    if (session.payment_status !== "paid") {
      return j(res, 200, {
        ok: false,
        paid: false,
        reason: "not_paid",
        payment_status: session.payment_status,
      });
    }

    // ✅ EMAIL FIX BURADA
    const email =
      safeStr(session.customer_details?.email) ||
      safeStr(session.metadata?.user_email) || // <-- KRİTİK FIX
      safeStr(session.metadata?.email);

    const credits = toInt(session.metadata?.credits);
    const pack = safeStr(session.metadata?.pack || session.metadata?.price);

    if (!email) {
      return j(res, 400, { ok: false, error: "missing_email" });
    }
    if (!credits) {
      return j(res, 400, { ok: false, error: "missing_credits_metadata" });
    }

    // Redis keys
    const lockKey = `aivo:stripe:lock:${session_id}`;
    const appliedKey = `aivo:stripe:verify:${session_id}`;
    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;

    // Self-heal WRONGTYPE
    await ensureStringOrNone(lockKey);
    await ensureStringOrNone(appliedKey);
    await ensureStringKey(creditsKey);
    await ensureStringKey(invoicesKey);

    // LOCK (10s)
    const lock = await redis.set(lockKey, "1", { nx: true, ex: 10 });
    if (!lock) {
      return j(res, 200, {
        ok: true,
        locked: true,
        message: "in_progress",
      });
    }

    // IDEMPOTENCY
    const applied = await redis.get(appliedKey);
    if (applied === "1") {
      const total = toInt(await redis.get(creditsKey));
      return j(res, 200, {
        ok: true,
        already_applied: true,
        email,
        credits_added: 0,
        total,
      });
    }

    // APPLY CREDITS
    const total = await redis.incrby(creditsKey, credits);

    await redis.set(appliedKey, "1", {
      ex: 60 * 60 * 24 * 30, // 30 gün
    });

    // INVOICE
    let invoices = [];
    try {
      const raw = await redis.get(invoicesKey);
      invoices = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(invoices)) invoices = [];
    } catch (_) {
      invoices = [];
    }

    const invoice = {
      order_id: `stripe_${session_id}`,
      provider: "stripe",
      type: "purchase",
      pack: pack || null,
      credits,
      created_at: new Date().toISOString(),
      status: "paid",
      stripe: { session_id },
    };

    invoices.unshift(invoice);
    await redis.set(invoicesKey, JSON.stringify(invoices));

    return j(res, 200, {
      ok: true,
      paid: true,
      email,
      credits_added: credits,
      total: toInt(total),
      invoice,
    });
  } catch (err) {
    console.error("[VERIFY] ERROR", err);
    return j(res, 500, {
      ok: false,
      error: "server_error",
      message: String(err?.message || err),
    });
  }
}
