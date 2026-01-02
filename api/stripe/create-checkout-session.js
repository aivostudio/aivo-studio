// /api/stripe/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// TEK KAYNAK: Pack -> (Stripe Price ID, Credits)
const PACKS = {

  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", credits: 25  }, // ✅ 25
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", credits: 60  }, // ✅ 60
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", credits: 150 }, // ✅ 150
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", credits: 500 }, // ✅ 550
};

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function pickPackCode(body) {
  // frontend bazen pack yerine plan/amount/price gönderebilir
  const raw =
    (body && (body.pack ?? body.plan ?? body.amount ?? body.price)) ?? "";

  // "399", 399, "399.00" gibi her şeyi normalize et
  const s = String(raw).trim();
  if (!s) return "";

  // sadece sayı kalsın
  const digits = s.replace(/[^\d]/g, "");
  return digits;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const packCode = pickPackCode(req.body || {});

    if (!PACKS[packCode]) {
      return res.status(400).json({
        ok: false,
        error: "PACK_NOT_ALLOWED",
        detail: `pack=${packCode || "(empty)"}`
      });
    }

    const { priceId } = PACKS[packCode];
    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        detail: `missing env STRIPE_PRICE_${packCode}`
      });
    }

    const origin = originFromReq(req);

    const successUrl = `${origin}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/checkout.html?canceled=1&pack=${encodeURIComponent(packCode)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { pack: packCode }, // ✅ verify tarafı için en güvenlisi
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
