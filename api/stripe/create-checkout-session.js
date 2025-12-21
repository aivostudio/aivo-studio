const Stripe = require("stripe");

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  // Deploy’da env var yoksa direkt anlaşılır hata verelim
  console.error("Missing STRIPE_SECRET_KEY env var");
}

const stripe = new Stripe(stripeSecret || "sk_test_missing");

const PRICE_BY_PLAN = {
  "Başlangıç Paket": "price_XXXXX",
  "Standart Paket": "price_YYYYY",
  "Pro Paket": "price_ZZZZZ",
  "Studio Paket": "price_AAAAA",
};

function safeJsonParse(body) {
  if (!body) return {};
  if (typeof body === "object") return body; // bazı ortamlarda zaten objedir
  try {
    return JSON.parse(body);
  } catch (e) {
    return {};
  }
}

module.exports = async (req, res) => {
  // Sadece POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Env var kontrol
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error: "Server config missing: STRIPE_SECRET_KEY",
    });
  }

  try {
    // Body güvenli okuma
    const body = safeJsonParse(req.body);
    const plan = String((body && body.plan) || "").trim();
    const priceId = PRICE_BY_PLAN[plan];

    if (!plan) {
      return res.status(400).json({ error: "Plan boş geldi" });
    }

   if (!plan || !PRICE_MAP[plan]) {
  return res.status(400).json({
    error: "Geçersiz plan",
    plan,
    allowedPlans: Object.keys(PRICE_MAP),
  });
}


    const origin = req.headers.origin || "https://aivo.tr";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout.html?cancelled=1`,
      metadata: { plan },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Stripe hatasını daha “okunur” loglayalım
    const msg =
      (err && err.raw && err.raw.message) ||
      (err && err.message) ||
      "Stripe session oluşturulamadı";

    console.error("Stripe error:", msg);
    return res.status(500).json({ error: msg });
  }
};
