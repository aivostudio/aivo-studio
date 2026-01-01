// api/stripe/create-checkout-session.js
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    // -------------------------------------------------------
    // ENV
    // -------------------------------------------------------
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ ok: false, error: "MISSING_STRIPE_SECRET_KEY" });
    }

    const stripe = new Stripe(secret);

    // -------------------------------------------------------
    // BODY
    // Frontend buraya priceId + email + pack gönderebilir.
    // pack zorunlu değil ama verify-session'da pack kullanıyorsan göndermen iyi olur.
    // -------------------------------------------------------
    const body = req.body || {};
    const priceId = String(body.priceId || body.price_id || "").trim();
    const email = String(body.email || "").trim() || null;
    const pack = String(body.pack || "").trim() || null;

    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_REQUIRED" });
    }

    // -------------------------------------------------------
    // URL'ler (local dev)
    // -------------------------------------------------------
    const successUrl = "http://localhost:3000/studio.html?success=1&session_id={CHECKOUT_SESSION_ID}";
    const cancelUrl  = "http://localhost:3000/studio.html?page=checkout";

    // -------------------------------------------------------
    // CREATE SESSION
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

      // verify-session tarafında pack okuyorsan burada yaz.
      metadata: {
        ...(pack ? { pack } : {}),
        priceId
      }
    });

    // -------------------------------------------------------
    // ✅ KRİTİK: session_id + url DÖN
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      url: session.url,
      session_id: session.id
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
      message: String(err?.message || err)
    });
  }
};
