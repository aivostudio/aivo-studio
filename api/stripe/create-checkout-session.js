import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔑 TEK VE GERÇEK PRICE MAP
const PRICE_MAP = {
  pro: "price_1SgsjmGv7iiobOPfIGw2uYza",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan, successUrl, cancelUrl } = req.body || {};

    const normalizedPlan = String(plan || "").trim().toLowerCase();

    if (!PRICE_MAP[normalizedPlan]) {
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
      line_items: [
        {
          price: PRICE_MAP[normalizedPlan],
          quantity: 1,
        },
      ],
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
      message: err.message,
    });
  }
}
