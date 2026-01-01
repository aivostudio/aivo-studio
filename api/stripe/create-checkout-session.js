const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS (local + vercel dev için güvenli)
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    // -------------------------------------------------------
    // BODY
    // -------------------------------------------------------
    const { priceId, email } = req.body || {};

    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_REQUIRED" });
    }

    // -------------------------------------------------------
// SUCCESS / CANCEL URL (request tabanlı - kesin çözüm)
// -------------------------------------------------------
const protoRaw = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
const hostRaw  = (req.headers["x-forwarded-host"] || req.headers["host"] || "localhost:3000")
  .split(",")[0]
  .trim();

const BASE_URL = `${protoRaw}://${hostRaw}`;

const successUrl = `${BASE_URL}/studio.html?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl  = `${BASE_URL}/studio.html?page=checkout`;


    // -------------------------------------------------------
    // STRIPE SESSION CREATE
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      payment_method_types: ["card"],

      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],

      customer_email: email || undefined,

      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        source: "aivo-studio",
        type: "credit_purchase"
      }
    });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (err) {
    console.error("STRIPE CREATE SESSION ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "STRIPE_SESSION_CREATE_FAILED"
    });
  }
};
