import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// PriceId -> Pack/Credits map (TEK OTORİTE)
// Buradaki kredi sayıları örnektir: senin paketlerine göre düzelt.
const PRICE_MAP = {
  [process.env.STRIPE_PRICE_199]:  { pack: "starter", credits: 60  },
  [process.env.STRIPE_PRICE_399]:  { pack: "standart", credits: 250 },
  [process.env.STRIPE_PRICE_899]:  { pack: "pro", credits: 500 },
  [process.env.STRIPE_PRICE_2999]: { pack: "studio", credits: 2500 },
};

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    // Frontend iki şekilde yollayabilir:
    // - { plan: "199" }  -> env'den price seçer
    // - { price_id: "price_..." } -> direkt kullanır
    const plan = String(body.plan || "").trim();           // "199" | "399" | ...
    const incomingPriceId = String(body.price_id || "").trim();

    // plan -> env price
    const planToEnv = {
      "199": process.env.STRIPE_PRICE_199,
      "399": process.env.STRIPE_PRICE_399,
      "899": process.env.STRIPE_PRICE_899,
      "2999": process.env.STRIPE_PRICE_2999,
    };

    const priceId = incomingPriceId || planToEnv[plan] || "";

    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_REQUIRED" });
    }

    const mapped = PRICE_MAP[priceId];
    if (!mapped) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_NOT_MAPPED" });
    }

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      // Studio'ya dönsün + session_id kesin gelsin
      success_url: `${baseUrl}/studio.html?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout.html?canceled=1`,
      // verify-session'ın doğrulayacağı tek kaynak: metadata
      metadata: {
        aivo_pack: mapped.pack,
        aivo_credits: String(mapped.credits),
      },
    });

    return res.status(200).json({ ok: true, url: session.url, session_id: session.id });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}
