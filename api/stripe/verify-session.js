// api/stripe/verify-session.js
const Stripe = require("stripe");
const fetch = require("node-fetch");

function creditsFromPrice(priceId) {
  switch (priceId) {
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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session_id =
      (req.method === "POST" && req.body?.session_id) ||
      req.query?.session_id ||
      null;

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "MISSING_SESSION_ID" });
    }

    // -------------------------------------------------------
    // Stripe session al
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items"]
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
    // KULLANICI + PRICE
    // -------------------------------------------------------
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      null;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "EMAIL_NOT_FOUND"
      });
    }

    const priceId =
      session.line_items?.data?.[0]?.price?.id || null;

    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_NOT_FOUND"
      });
    }

    const credits = creditsFromPrice(priceId);

    if (!credits || credits <= 0) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_CREDIT_AMOUNT"
      });
    }

    // -------------------------------------------------------
    // 🔥 KREDİ YAZ (IDEMPOTENT)
    // -------------------------------------------------------
    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const creditResp = await fetch(`${baseUrl}/api/credits/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        amount: credits,
        order_id: session.id
      })
    });

    const creditJson = await creditResp.json();

    if (!creditJson.ok) {
      return res.status(500).json({
        ok: false,
        error: "CREDIT_WRITE_FAILED",
        detail: creditJson
      });
    }

    // -------------------------------------------------------
    // BAŞARILI
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      order_id: session.id,
      email: email,
      added: credits,
      total_credits: creditJson.credits
    });

  } catch (err) {
    console.error("verify-session error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "UNKNOWN_ERROR"
    });
  }
};
