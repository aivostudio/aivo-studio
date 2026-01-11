// /api/stripe/verify-session.js
/**
 * =========================================================
 * AIVO — STRIPE VERIFY SESSION (FAZ 1 / BACKEND ONLY)
 * =========================================================
 * - Server source of truth: KV
 * - Idempotent: stripe:session:{sessionId} guard ile tekrar kredi eklemez
 * - Net kontrat:
 *   { ok:true, added:number, credits:number, invoice:{...} }
 * - Aynı session tekrar gelirse:
 *   { ok:true, added:0, credits:<mevcut>, invoice:<ilk> }
 */

const Stripe = require("stripe");
const { getRedis } = require("../_kv");

function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

function toInt(n, def = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return def;
  return Math.floor(x);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const body = req.body || {};
    const sessionId = String(body.session_id || body.sessionId || "").trim();
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const redis = getRedis();

    // 1) Idempotency guard
    const guardKey = `stripe:session:${sessionId}`;
    const existingGuardRaw = await redis.get(guardKey);
    if (existingGuardRaw) {
      const g = safeJsonParse(existingGuardRaw, null);
      const email = String(g?.email || "").toLowerCase();

      const rawCredits = email ? await redis.get(`credits:${email}`) : 0;
      const credits = toInt(rawCredits, 0);

      return res.status(200).json({
        ok: true,
        added: 0,
        credits,
        invoice: g?.invoice || null,
      });
    }

    // 2) Stripe retrieve
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }

    // 3) Paid check
    const paymentStatus = String(session.payment_status || "");
    if (paymentStatus !== "paid") {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_PAID",
        detail: { payment_status: paymentStatus, status: session.status || null },
      });
    }

    // 4) Metadata
    const meta = session.metadata || {};
    const email = String(meta.user_email || meta.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "EMAIL_MISSING_IN_METADATA" });
    }

    const added = toInt(meta.credits, 0);
    if (added <= 0) {
      return res.status(400).json({ ok: false, error: "CREDITS_INVALID_IN_METADATA" });
    }

    const pack = String(meta.pack || "").trim();

    // 5) Invoice object
    const invoice = {
      id: String(session.payment_intent || session.id),
      sessionId: session.id,
      paymentIntent: session.payment_intent || null,
      pack: pack || null,
      credits: added,
      amount_total: session.amount_total ?? null,
      currency: session.currency || null,
      createdAt: session.created ?? Math.floor(Date.now() / 1000),
    };

    // 6) KV write
    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;

    const rawCredits = await redis.get(creditsKey);
    const current = toInt(rawCredits, 0);
    const newTotal = current + added;

    const rawInv = await redis.get(invoicesKey);
    const list = safeJsonParse(rawInv, []);
    const invoices = Array.isArray(list) ? list : [];
    invoices.unshift(invoice);

    await redis.set(creditsKey, String(newTotal));
    await redis.set(invoicesKey, JSON.stringify(invoices));

    // 7) Guard write (son adım)
    await redis.set(
      guardKey,
      JSON.stringify({
        email,
        added,
        credits: newTotal,
        invoice,
        processedAt: Date.now(),
      })
    );

    return res.status(200).json({
      ok: true,
      added,
      credits: newTotal,
      invoice,
    });
  } catch (err) {
    const message = err?.raw?.message || err?.message || "UNKNOWN_ERROR";
    const code = err?.raw?.code || err?.code || "ERR";
    return res.status(500).json({
      ok: false,
      error: "VERIFY_SESSION_FAILED",
      code,
      message,
    });
  }
};
