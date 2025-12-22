// api/stripe/verify-session.js
// Stripe Checkout session doğrulama (Vercel Serverless, CommonJS)

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
    }

    const stripe = new Stripe(secretKey);

    const session_id = req.query.session_id;
    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    // Session çek
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items", "payment_intent"],
    });

    // Ödeme durumu (Stripe: payment_status)
    const paymentStatus = session.payment_status; // "paid", "unpaid", "no_payment_required"
    const isPaid = paymentStatus === "paid";

    // Tutar
    const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
    const currency = session.currency || "try";

    // Krediyi metadata’dan alacağız (create-checkout-session içinde yazacağız)
    const credits = Number(session.metadata && session.metadata.credits ? session.metadata.credits : 0) || 0;

    // Fatura/Referans için basit alanlar
    const customerEmail = session.customer_details && session.customer_details.email
      ? session.customer_details.email
      : null;

    return res.status(200).json({
      ok: true,
      session_id,
      paid: isPaid,
      payment_status: paymentStatus,
      amount_total: amountTotal,
      currency,
      credits,
      customer_email: customerEmail,
      created: session.created || null,
      provider: "stripe",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : "Unknown error",
    });
  }
};
