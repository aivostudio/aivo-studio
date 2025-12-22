const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // Basit CORS (gerekirse)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing STRIPE_SECRET_KEY",
        message: "Vercel Environment Variables içine STRIPE_SECRET_KEY eklenmemiş.",
      });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // Plan -> Price + Credits (tek kaynak)
    const PLAN_MAP = {
      pro: {
        priceId: "price_1SgsjmGv7iiob0PflGw2uYza",
        credits: 100, // PRO kaç kredi verecekse burada
      },
    };

    const { plan, successUrl, cancelUrl } = req.body || {};
    const normalizedPlan = String(plan || "").trim().toLowerCase();

    if (!normalizedPlan || !PLAN_MAP[normalizedPlan]) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz plan",
        plan,
        normalizedPlan,
        allowedPlans: Object.keys(PLAN_MAP),
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        ok: false,
        error: "successUrl ve cancelUrl zorunlu",
      });
    }

    // Güvenlik: success/cancel URL’lerini allowlist ile sınırlamak iyi pratik
    // (Şimdilik en azından URL parse ederek doğrula)
    let success, cancel;
    try {
      success = new URL(successUrl);
      cancel = new URL(cancelUrl);
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Geçersiz URL" });
    }

    // success_url içine Stripe'ın session placeholder'ını ekle
    // Not: Stripe sadece literal "{CHECKOUT_SESSION_ID}" placeholder'ını tanır.
    // Eğer successUrl zaten parametre içeriyorsa & kullan
    const joiner = success.search ? "&" : "?";
    const successWithSession = `${success.toString()}${joiner}session_id={CHECKOUT_SESSION_ID}&paid=1`;

    const { priceId, credits } = PLAN_MAP[normalizedPlan];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      // müşteri e-postası toplanacaksa:
      // customer_creation: "always",

      // kredi bilgisini Stripe tarafına yaz (verify-session buradan okuyacak)
      metadata: {
        plan: normalizedPlan,
        credits: String(credits),
      },

      success_url: successWithSession,
      cancel_url: cancel.toString(),
    });

    return res.status(200).json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      credits,
      plan: normalizedPlan,
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
