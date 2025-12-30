// api/stripe/create-checkout-session.js
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // Stripe key
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing STRIPE_SECRET_KEY",
      });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
    const keyMode = secretKey.startsWith("sk_live_") ? "LIVE" : "TEST";

    // PACK → TEK OTORİTE
    const PLAN_MAP = {
      "199": {
        priceId: "price_1SgsjmGv7iiob0PflGw2uYza",
        credits: 25,
      },
      "399": {
        priceId: "price_1Sk3LJGv7iiob0PfDPVVtzWj",
        credits: 60,
      },
      "899": {
        priceId: "price_1Sk3MgGv7iiob0PfDEbYOAoO",
        credits: 150,
      },
      "2999": {
        priceId: "price_1Sk3N3Gv7iiob0Pf7JggGiI7",
        credits: 500,
      },
    };

    const { pack, successUrl, cancelUrl } = req.body || {};
    const packKey = String(pack || "").trim();

    if (!PLAN_MAP[packKey]) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz paket",
        received: pack,
        allowed: Object.keys(PLAN_MAP),
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        ok: false,
        error: "successUrl ve cancelUrl zorunlu",
      });
    }

    const success = new URL(successUrl);
    const cancel = new URL(cancelUrl);
    const joiner = success.search ? "&" : "?";
    const successWithSession =
      `${success.toString()}${joiner}status=success&session_id={CHECKOUT_SESSION_ID}`;

    const { priceId, credits } = PLAN_MAP[packKey];

    // Stripe price check
    const priceObj = await stripe.prices.retrieve(priceId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        pack: packKey,
        credits: String(credits),
      },
      success_url: successWithSession,
      cancel_url: cancel.toString(),
    });

    return res.status(200).json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      debug: {
        keyMode,
        packKey,
        priceId,
        currency: priceObj.currency,
      },
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({
      ok: false,
      error: "Stripe error",
      message: err.message,
    });
  }
};
