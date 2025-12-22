// api/stripe/verify-session.js
// Stripe Checkout session doğrulama (Vercel Serverless, CommonJS)

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // Basit CORS (same-origin değilse gerekebilir)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });
    }

    const stripe = new Stripe(secretKey);

    // session_id: POST ise body’den, GET ise query’den al
    const session_id =
      (req.method === "POST" && req.body && req.body.session_id) ? req.body.session_id :
      (req.query && req.query.session_id) ? req.query.session_id :
      null;

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      // line_items çoğu zaman gerekmez; ağır olabilir
      expand: ["payment_intent"],
    });

    // Stripe Checkout doğrulaması
    const paymentStatus = session.payment_status; // paid | unpaid | no_payment_required
    const sessionStatus = session.status;         // complete | open | expired (genelde)
    const isPaid = paymentStatus === "paid";
    const isComplete = sessionStatus === "complete";

    // Tutar
    const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
    const currency = session.currency || "try";

    // Krediyi metadata’dan oku (create-checkout-session içinde set edilmeli)
    const credits =
      Number(session.metadata && session.metadata.credits ? session.metadata.credits : 0) || 0;

    const customerEmail =
      session.customer_details && session.customer_details.email
        ? session.customer_details.email
        : null;

    return res.status(200).json({
      ok: true,
      session_id,
      paid: isPaid,
      complete: isComplete,
      payment_status: paymentStatus,
      session_status: sessionStatus,
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
