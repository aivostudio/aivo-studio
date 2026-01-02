import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  "199": process.env.STRIPE_PRICE_199,
  "399": process.env.STRIPE_PRICE_399,
  "899": process.env.STRIPE_PRICE_899,
  "2999": process.env.STRIPE_PRICE_2999,
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const body = req.body || {};
    const plan = String(body.plan || "").trim();   // ✅ plan’i buradan al
    const priceId = PRICE_MAP[plan];

    // ✅ Debug (geçici) — priceId boş mu anlayacağız
    if (!plan) {
      return res.status(400).json({ ok: false, error: "PLAN_REQUIRED", got: body });
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/checkout?canceled=1`,
    });

    return res.status(200).json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("stripe create session error", e);
    return res.status(500).json({ ok: false, error: "STRIPE_SESSION_FAILED" });
  }
}
