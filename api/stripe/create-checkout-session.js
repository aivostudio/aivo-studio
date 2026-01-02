// /api/stripe/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// TEK KAYNAK: Pack -> (Stripe Price ID, Credits)
// 🔴 BURADAKİ credits değerlerini SENİN GERÇEK PAKET TABLONA göre ayarla.
const PACKS = {
  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", credits: 30  },  // örnek
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", credits: 60  },  // senin dediğin: 399 => 60 kredi
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", credits: 250 },  // örnek
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", credits: 500 },  // senin istediğin: 2999 => 500 kredi
};

function originFromReq(req) {
  // Vercel/Proxy uyumlu origin üret
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const { pack } = req.body || {};
    const packCode = String(pack || "").trim(); // "199" | "399" | "899" | "2999"

    if (!PACKS[packCode]) {
      return res.status(400).json({ ok: false, error: "PACK_NOT_ALLOWED", detail: `pack=${packCode}` });
    }

    const { priceId } = PACKS[packCode];
    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_REQUIRED", detail: `missing env for pack=${packCode}` });
    }

    const origin = originFromReq(req);

    // success_url: studio'ya dön + session_id taşınsın
    const successUrl = `${origin}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/checkout.html?canceled=1&pack=${encodeURIComponent(packCode)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Stripe tarafında da pack’ı tut (debug + doğrulama için faydalı)
      metadata: { pack: packCode },
    });

    return res.status(200).json({
      ok: true,
      session_id: session.id,
      url: session.url,
      pack: packCode,
    });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
