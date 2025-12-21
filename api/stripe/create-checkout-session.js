import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_MAP = {
  starter: "price_1ABC...STARTER",
  pro: "price_1DEF...PRO",
  studio: "price_1GHI...STUDIO",
};


// 🔑 TEK GERÇEK MAP BURASI
const PLAN_PRICE_MAP = {
  starter: "price_STARTER_ID",
  pro: "price_PRO_ID",
  studio: "price_STUDIO_ID",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan, successUrl, cancelUrl } = req.body;

    // normalize
    const normalizedPlan = String(plan || "").toLowerCase();

    if (!PLAN_PRICE_MAP[normalizedPlan]) {
      return res.status(400).json({
        error: "Geçersiz plan",
        plan,
        normalizedPlan,
        allowedPlans: Object.keys(PLAN_PRICE_MAP),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: PLAN_PRICE_MAP[normalizedPlan],
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
    console.error(err);
    return res.status(500).json({ error: "Stripe error" });
  }
}
