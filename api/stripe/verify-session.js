const Stripe = require("stripe");

module.exports = async (req, res) => {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });
    }

    const stripe = new Stripe(secret);

    const sid = String(req.query.session_id || "").trim();
    if (!sid) return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });

    // Checkout Session çek
    const session = await stripe.checkout.sessions.retrieve(sid);

    // paid mi?
    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({
        ok: false,
        error: "NOT_PAID",
        payment_status: session && session.payment_status,
      });
    }

    // amount_total (kuruş) -> kredi map
    const amount = Number(session.amount_total || 0); // ör: 39900
    let credits = 0;

    // ⚠️ Burayı senin paket/kredi tablonla eşleştir
    if (amount === 19900) credits = 100;
    else if (amount === 39900) credits = 250;
    else if (amount === 89900) credits = 700;
    else if (amount === 299900) credits = 3000;

    const order_id = `stripe_${sid}`; // idempotency için

    return res.status(200).json({
      ok: true,
      order_id,
      credits,
      amount_total: amount,
      currency: session.currency,
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({
      ok: false,
      error: "VERIFY_FAILED",
      message: String(e && e.message ? e.message : e),
    });
  }
};
