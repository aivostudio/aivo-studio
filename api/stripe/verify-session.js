// api/stripe/verify-session.js
// Stripe Checkout session doğrulama (Vercel Serverless, CommonJS)

const Stripe = require("stripe");

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
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // -------------------------------------------------------
    // Stripe Secret Key
    // -------------------------------------------------------
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing STRIPE_SECRET_KEY",
      });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // session_id: POST body veya GET query
    const session_id =
      (req.method === "POST" && req.body && req.body.session_id)
        ? req.body.session_id
        : (req.query && req.query.session_id)
          ? req.query.session_id
          : null;

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    // -------------------------------------------------------
    // Retrieve session
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paymentStatus = session.payment_status; // paid | unpaid | no_payment_required
    const sessionStatus = session.status;         // complete | open | expired
    const paid = paymentStatus === "paid";
    const complete = sessionStatus === "complete";

    const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
    const currency = session.currency || "try";

    // ✅ metadata
    const pack = (session.metadata && session.metadata.pack) ? String(session.metadata.pack) : null;
    const credits = Number(session.metadata && session.metadata.credits ? session.metadata.credits : 0) || 0;

    const customerEmail =
      session.customer_details && session.customer_details.email
        ? session.customer_details.email
        : null;

    // Bizim kilit için tekil sipariş id (Stripe session id)
    const order_id = session.id;

    return res.status(200).json({
      ok: true,
      provider: "stripe",

      // kimlik
      session_id,
      order_id,

      // durum
      paid,
      complete,
      payment_status: paymentStatus,
      session_status: sessionStatus,

      // paket
      pack,
      credits,

      // ödeme bilgisi
      amount_total: amountTotal,
      currency,

      // müşteri
      customer_email: customerEmail,

      created: session.created || null,
    });
  } catch (err) {
    console.error("verify-session error:", err);
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : "Unknown error",
    });
  }
};
