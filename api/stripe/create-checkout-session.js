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
    // BODY SAFE PARSE
    // -------------------------------------------------------
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    body = body && typeof body === "object" ? body : {};

    const raw = (body.plan || body.pack || body.price || "").toString().trim();
    const pack = raw.replace(/[^0-9]/g, "");

    const ALLOWED = ["199", "399", "899", "2999"];
    if (!ALLOWED.includes(pack)) {
      return res.status(400).json({
        ok: false,
        error: "GECERSIZ_PAKET",
        got: raw,
        normalized: pack
      });
    }

    // -------------------------------------------------------
    // STRIPE
    // -------------------------------------------------------
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });
    }

    const stripe = new Stripe(secretKey);

    const PRICE_MAP = {
      "199":  process.env.STRIPE_PRICE_199,
      "399":  process.env.STRIPE_PRICE_399,
      "899":  process.env.STRIPE_PRICE_899,
      "2999": process.env.STRIPE_PRICE_2999
    };

    const priceId = PRICE_MAP[pack];
    if (!priceId) {
      return res.status(500).json({
        ok: false,
        error: "STRIPE_PRICE_ID_MISSING",
        pack
      });
    }

   // -------------------------------------------------------
// KANONIK DÖNÜŞ ADRESİ
// -------------------------------------------------------
const CANONICAL_ORIGIN = "https://www.aivo.tr";

const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: priceId, quantity: 1 }],

  // ✅ EN SAĞLAM: Stripe otomatik session id basar
  // ödeme tamamlanınca studio.html?stripe=success&session_id=cs_... ile döner
  success_url: `${CANONICAL_ORIGIN}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:  `${CANONICAL_ORIGIN}/studio.html?stripe=cancel`,

  // verify-session buradan pack'i okuyacak
  metadata: { pack }
});


    // -------------------------------------------------------
    // ✅ KRİTİK: session_id client'a dönmeli (localStorage'a yazılacak)
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      url: session.url,
      session_id: session.id,
      pack
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({
      ok: false,
      error: "STRIPE_SESSION_CREATE_FAILED",
      detail: err && err.message ? err.message : String(err)
    });
  }
};
