// api/stripe/verify-session.js
const Stripe = require("stripe");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { session_id } = req.body || {};
    const sid = String(session_id || "").trim();

    if (!sid) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const session = await stripe.checkout.sessions.retrieve(sid);

    // ödeme kontrolü
    // paid değilse kredi basma
    if (session.payment_status !== "paid") {
      return res.status(200).json({
        ok: false,
        error: "NOT_PAID",
        payment_status: session.payment_status,
      });
    }

    // ✅ Metadata’dan oku (map yok!)
    const pack = String((session.metadata && session.metadata.aivo_pack) || "").trim();
    const credits = Number((session.metadata && session.metadata.aivo_credits) || 0);

    if (!pack || !Number.isFinite(credits) || credits <= 0) {
      return res.status(500).json({
        ok: false,
        error: "MISSING_METADATA",
        detail: "Checkout session metadata pack/credits yok",
        pack,
        credits,
      });
    }

    // order_id: idempotency için iyi bir anahtar
    const order_id = String(session.payment_intent || session.id);

    return res.status(200).json({
      ok: true,
      order_id,
      pack,
      credits,
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
