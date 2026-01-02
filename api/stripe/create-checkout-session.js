// /api/stripe/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

/**
 * TEK KAYNAK: Pack -> (Stripe Price ID, Credits)
 * ✅ Senin gerçek tablo (senin dediğin):
 * 199  => 60
 * 399  => 60
 * 899  => 500
 * 2999 => 500
 */
const PACKS = {
  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", credits: 60  },
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", credits: 60  },
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", credits: 500 },
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", credits: 500 },
};

function originFromReq(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host =
    (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`;
}

// Vercel'de bazen req.body string gelir (Content-Type bozuksa) => parse fallback
function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch (_) { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const body = readBody(req);
    const packCode = String(body.pack || "").trim(); // "199" | "399" | "899" | "2999"

    if (!PACKS[packCode]) {
      return res.status(400).json({
        ok: false,
        error: "PACK_NOT_ALLOWED",
        detail: `pack=${packCode || "(empty)"}`,
      });
    }

    const { priceId, credits } = PACKS[packCode];

    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        detail: `missing env for pack=${packCode} (STRIPE_PRICE_${packCode})`,
      });
    }

    const origin = originFromReq(req);

    // ✅ finalize bloğunla uyumlu: stripe_success=1 + session_id
    const successUrl = `${origin}/studio.html?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/checkout.html?canceled=1&pack=${encodeURIComponent(packCode)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Debug / doğrulama için
      metadata: {
        pack: packCode,
        credits: String(credits),
      },
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
