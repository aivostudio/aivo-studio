const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      error: "Missing STRIPE_SECRET_KEY",
      message: "Vercel Environment Variables içine STRIPE_SECRET_KEY eklenmemiş.",
    });
  }

  // Stripe client (apiVersion opsiyonel ama önerilir)
  const stripe = new Stripe(secretKey, {
    apiVersion: "2024-06-20",
  });

  // Plan -> Stripe Price ID
  const PRICE_MAP = {
    pro: "price_1SgsjmGv7iiob0PflGw2uYza",
  };

  try {
    const { plan, successUrl, cancelUrl } = req.body || {};
    const normalizedPlan = String(plan || "").trim().toLowerCase();

    if (!normalizedPlan || !PRICE_MAP[normalizedPlan]) {
      return res.status(400).json({
        error: "Geçersiz plan",
        plan,
        normalizedPlan,
        allowedPlans: Object.keys(PRICE_MAP),
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        error: "successUrl ve cancelUrl zorunlu",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: PRICE_MAP[normalizedPlan], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({
      error: "Stripe error",
      message: err && err.message ? err.message : String(err),
    });
  }
};
