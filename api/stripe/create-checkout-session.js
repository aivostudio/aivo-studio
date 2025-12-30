// api/stripe/create-checkout-session.js

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS (Safari / preflight için doğru sırada)
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // -------------------------------------------------------
    // Stripe Secret Key
    // -------------------------------------------------------
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing STRIPE_SECRET_KEY",
        message:
          "Vercel Environment Variables içine STRIPE_SECRET_KEY eklenmemiş.",
      });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // -------------------------------------------------------
    // PACK → Price + Credits (tek kaynak)
    // -------------------------------------------------------
   const PLAN_MAP = {
  "199":  { priceId: "price_XXXX199",  credits: 25 },
  "399":  { priceId: "price_XXXX399",  credits: 60 },
  "899":  { priceId: "price_XXXX899",  credits: 150 },
  "2999": { priceId: "price_XXXX2999", credits: 500 },
};


    // Body
    const { pack, successUrl, cancelUrl } = req.body || {};
    const packKey = String(pack || "").trim(); // "199" | "399" | ...

    if (!packKey || !PACK_MAP[packKey]) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz paket",
        pack,
        packKey,
        allowedPacks: Object.keys(PACK_MAP),
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
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Geçersiz URL" });
    }

    // -------------------------------------------------------
    // SUCCESS URL → session_id + status=success
    // (checkout.html bunu okuyacak)
    // -------------------------------------------------------
    const joiner = success.search ? "&" : "?";
    const successWithSession =
      `${success.toString()}${joiner}status=success&session_id={CHECKOUT_SESSION_ID}`;

    const { priceId, credits } = PACK_MAP[packKey];

    // -------------------------------------------------------
    // Stripe Checkout Session
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      // ✅ Kredi yazma için gerekli metadata
      metadata: {
        pack: packKey,
        credits: String(credits),
      },

      success_url: successWithSession,
      cancel_url: cancel.toString(),
    });

    // -------------------------------------------------------
    // Response
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      pack: packKey,
      credits,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({
      ok: false,
      error: "Stripe error",
      message: err && err.message ? err.message : String(err),
    });
  }
};
