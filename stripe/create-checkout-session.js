const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan → Stripe Price ID eşlemesi
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
    const { plan } = req.body;

    const priceId = PRICE_BY_PLAN[plan];
    if (!priceId) {
      return res.status(400).json({ error: "Geçersiz plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin}/checkout-success.html`,
      cancel_url: `${req.headers.origin}/checkout-cancel.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe session oluşturulamadı" });
  }
};
