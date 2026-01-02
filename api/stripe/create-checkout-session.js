// api/stripe/create-checkout-session.js
const Stripe = require("stripe");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Frontend'den beklenen: { plan: "starter" | "standard" | "pro" | "studio" }
    const { plan } = req.body || {};
    const pack = String(plan || "").trim().toLowerCase();

    // ✅ TEK KAYNAK: plan -> Stripe price_id ve plan -> credits
    // Burayı SENİN gerçek paketlerine göre düzenle.
    const PRICE_BY_PACK = {
      starter: process.env.STRIPE_PRICE_STARTER,
      standard: process.env.STRIPE_PRICE_STANDARD,
      pro: process.env.STRIPE_PRICE_PRO,
      studio: process.env.STRIPE_PRICE_STUDIO,
    };

    const CREDITS_BY_PACK = {
      starter: 60,
      standard: 500,
      pro: 1500,
      studio: 2500,
    };

    const priceId = PRICE_BY_PACK[pack];
    const credits = CREDITS_BY_PACK[pack];

    if (!pack || !priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        detail: "Geçersiz plan veya price env eksik",
        pack,
      });
    }

    if (!Number.isFinite(Number(credits)) || Number(credits) <= 0) {
      return res.status(400).json({
        ok: false,
        error: "CREDITS_MAP_INVALID",
        pack,
      });
    }

    // origin bul (Vercel / lokal)
    const origin =
      (req.headers["x-forwarded-proto"] ? req.headers["x-forwarded-proto"] + "://" : "https://") +
      (req.headers["x-forwarded-host"] || req.headers.host);

    // ✅ success_url: her zaman studio.html'e dönsün
    const successUrl = `${origin}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/checkout.html?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ Kritik: verify-session map'e bakmasın diye metadata basıyoruz
      metadata: {
        aivo_pack: pack,
        aivo_credits: String(credits),
      },
    });

    return res.status(200).json({
      ok: true,
      url: session.url,
      session_id: session.id,
      pack,
      credits,
    });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
