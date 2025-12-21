const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_BY_PLAN = {
  "Başlangıç Paket": "price_XXXXX",
  "Standart Paket": "price_YYYYY",
  "Pro Paket": "price_ZZZZZ",
  "Studio Paket": "price_AAAAA",
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan } = req.body || {};
    const priceId = PRICE_BY_PLAN[String(plan || "").trim()];

    if (!priceId) {
      return res.status(400).json({ error: "Geçersiz plan" });
    }

    const origin = req.headers.origin || "https://aivo.tr";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout.html?cancelled=1`,
      metadata: { plan: String(plan || "") },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Stripe session oluşturulamadı" });
  }
};
