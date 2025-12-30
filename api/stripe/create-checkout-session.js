// /api/stripe/create-checkout-session.js
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
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

    const keyMode = secretKey.startsWith("sk_live_") ? "LIVE" : "TEST";
    const stripe = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
    });

    // -------------------------------------------------------
    // PACK → Price + Credits (TEK OTORİTE)
    // -------------------------------------------------------
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

    // -------------------------------------------------------
    // Body
    // -------------------------------------------------------
    const { pack, successUrl, cancelUrl } = req.body || {};
    const packKey = String(pack || "").trim();

    if (!packKey || !PLAN_MAP[packKey]) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz paket",
        receivedPack: pack,
        allowedPacks: Object.keys(PLAN_MAP),
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        ok: false,
        error: "successUrl ve cancelUrl zorunlu",
      });
    }

    // -------------------------------------------------------
    // URL doğrulama
    // -------------------------------------------------------
    let success, cancel;
    try {
      success = new URL(successUrl);
      cancel = new URL(cancelUrl);
    } catch {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz URL",
      });
    }

    // -------------------------------------------------------
    // Success URL → session_id ekle
    // -------------------------------------------------------
    const joiner = success.search ? "&" : "?";
    const successWithSession =
      `${success.toString()}${joiner}status=success&session_id={CHECKOUT_SESSION_ID}`;

    const { priceId, credits } = PLAN_MAP[packKey];

    // -------------------------------------------------------
    // PRICE DOĞRULAMA (kritik teşhis noktası)
    // -------------------------------------------------------
    let priceObj;
    try {
      priceObj = await stripe.prices.retrieve(priceId);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "Stripe price not found",
        message: err?.message || String(err),
        debug: {
          packKey,
          priceId,
          keyMode,
        },
      });
    }

    // -------------------------------------------------------
    // Checkout Session
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        pack: packKey,
        credits: String(credits),
      },
      success_url: successWithSession,
      cancel_url: cancel.toString(),
    });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      pack: packKey,
      credits,
      debug: {
        keyMode,
        priceId,
        priceLivemode: priceObj.livemode,
        currency: priceObj.currency,
        unit_amount: priceObj.unit_amount,
      },
    });
  } catch (err) {
    console.error("Stripe fatal error:", err);
    return res.status(500).json({
      ok: false,
      error: "Stripe error",
      message: err?.message || String(err),
    });
  }
};
// /api/stripe/create-checkout-session.js
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
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

    const keyMode = secretKey.startsWith("sk_live_") ? "LIVE" : "TEST";
    const stripe = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
    });

    // -------------------------------------------------------
    // PACK → Price + Credits (TEK OTORİTE)
    // -------------------------------------------------------
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

    // -------------------------------------------------------
    // Body
    // -------------------------------------------------------
    const { pack, successUrl, cancelUrl } = req.body || {};
    const packKey = String(pack || "").trim();

    if (!packKey || !PLAN_MAP[packKey]) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz paket",
        receivedPack: pack,
        allowedPacks: Object.keys(PLAN_MAP),
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        ok: false,
        error: "successUrl ve cancelUrl zorunlu",
      });
    }

    // -------------------------------------------------------
    // URL doğrulama
    // -------------------------------------------------------
    let success, cancel;
    try {
      success = new URL(successUrl);
      cancel = new URL(cancelUrl);
    } catch {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz URL",
      });
    }

    // -------------------------------------------------------
    // Success URL → session_id ekle
    // -------------------------------------------------------
    const joiner = success.search ? "&" : "?";
    const successWithSession =
      `${success.toString()}${joiner}status=success&session_id={CHECKOUT_SESSION_ID}`;

    const { priceId, credits } = PLAN_MAP[packKey];

    // -------------------------------------------------------
    // PRICE DOĞRULAMA (kritik teşhis noktası)
    // -------------------------------------------------------
    let priceObj;
    try {
      priceObj = await stripe.prices.retrieve(priceId);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "Stripe price not found",
        message: err?.message || String(err),
        debug: {
          packKey,
          priceId,
          keyMode,
        },
      });
    }

    // -------------------------------------------------------
    // Checkout Session
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        pack: packKey,
        credits: String(credits),
      },
      success_url: successWithSession,
      cancel_url: cancel.toString(),
    });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      pack: packKey,
      credits,
      debug: {
        keyMode,
        priceId,
        priceLivemode: priceObj.livemode,
        currency: priceObj.currency,
        unit_amount: priceObj.unit_amount,
      },
    });
  } catch (err) {
    console.error("Stripe fatal error:", err);
    return res.status(500).json({
      ok: false,
      error: "Stripe error",
      message: err?.message || String(err),
    });
  }
};
