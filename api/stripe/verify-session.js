// api/stripe/verify-session.js
const Stripe = require("stripe");
const { getRedis } = require("../_kv");

// -------------------------------------------------------
// priceId -> kredi eşlemesi
// -------------------------------------------------------
function creditsFromPrice(priceId) {
  switch (String(priceId || "")) {
    case process.env.STRIPE_PRICE_199:
      return 10;
    case process.env.STRIPE_PRICE_399:
      return 30;
    case process.env.STRIPE_PRICE_899:
      return 100;
    case process.env.STRIPE_PRICE_2999:
      return 500;
    default:
      return 0;
  }
}

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session_id =
      (req.method === "POST" && req.body?.session_id) ||
      req.query?.session_id ||
      null;

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "MISSING_SESSION_ID" });
    }

    // -------------------------------------------------------
    // Stripe session al (line_items + price expand)
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items.data.price", "customer_details"]
    });

    // Ödeme tamam mı?
    if (session.payment_status !== "paid" || session.status !== "complete") {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_COMPLETED",
        payment_status: session.payment_status,
        session_status: session.status
      });
    }

    // -------------------------------------------------------
    // email tespiti (öncelik: customer_details.email)
    // -------------------------------------------------------
    const email =
      (session.customer_details && session.customer_details.email) ||
      (session.metadata && session.metadata.email) ||
      null;

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_NOT_FOUND" });
    }

    const user = String(email).trim().toLowerCase();

    // -------------------------------------------------------
    // priceId tespiti (line_items > metadata fallback)
    // -------------------------------------------------------
    const li = session.line_items?.data?.[0];
    const priceId =
      (li && li.price && li.price.id) ||
      (session.metadata && (session.metadata.price_id || session.metadata.priceId)) ||
      null;

    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_NOT_FOUND" });
    }

    const inc = creditsFromPrice(priceId);
    if (!Number.isFinite(inc) || inc <= 0) {
      return res.status(400).json({
        ok: false,
        error: "CREDITS_NOT_MAPPED",
        price_id: String(priceId)
      });
    }

    // -------------------------------------------------------
    // KREDİ YAZ (idempotent) — aynı session.id tekrar gelirse 2. kez yazmaz
    // -------------------------------------------------------
    const redis = getRedis();

    const orderId = String(session.id);
    const orderKey = `order:${orderId}`;
    const creditsKey = `credits:${user}`;

    // zaten yazıldı mı?
    const already = await redis.get(orderKey);
    if (already) {
      const current = await redis.get(creditsKey);
      return res.status(200).json({
        ok: true,
        already_applied: true,
        email: user,
        order_id: orderId,
        price_id: String(priceId),
        added: 0,
        credits: Number(current || 0)
      });
    }

    // order işaretle (TTL 60 gün) + kredi ekle
    await redis.set(orderKey, "1", { ex: 60 * 60 * 24 * 60 });
    const newCredits = await redis.incrby(creditsKey, inc);

    return res.status(200).json({
      ok: true,
      already_applied: false,
      email: user,
      order_id: orderId,
      price_id: String(priceId),
      added: inc,
      credits: Number(newCredits) || 0
    });
  } catch (err) {
    console.error("verify-session error:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(err?.message || err)
    });
  }
};
