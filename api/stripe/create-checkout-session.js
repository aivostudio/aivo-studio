const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// UI'dan gelen plan -> Stripe Price ID eşlemesi
const PRICE_MAP = {
  "199": process.env.STRIPE_PRICE_199,
  "399": process.env.STRIPE_PRICE_399,
  "899": process.env.STRIPE_PRICE_899,
  "2999": process.env.STRIPE_PRICE_2999,
};

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const body = req.body || {};
    const plan = String(body.plan || "").trim();
    const priceId = PRICE_MAP[plan];

    // 🔒 Güvenlik / Debug
    if (!plan) {
      return res.status(400).json({
        ok: false,
        error: "PLAN_REQUIRED",
        got: body,
      });
    }

    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        plan,
        knownPlans: Object.keys(PRICE_MAP),
      });
    }

    const base = process.env.SITE_URL || "https://aivo.tr";

    // ✅ Başarılı / iptal dönüşleri DOĞRUDAN Studio’ya
    const successUrl =
      `${base}/studio.html?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      `${base}/studio.html?stripe_canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.status(200).json({
      ok: true,
      sessionId: session.id,
      url: session.url, // frontend isterse direkt redirect edebilir
    });
  } catch (err) {
    console.error("Stripe create-checkout-session error:", err);
    return res.status(500).json({
      ok: false,
      error: "STRIPE_SESSION_FAILED",
    });
  }
};
