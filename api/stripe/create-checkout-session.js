// /api/stripe/create-checkout-session.js
import Stripe from "stripe";

// Pack -> (Stripe Price ID, Credits)
const PACKS = {
  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", credits: 25  },
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", credits: 60  },
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", credits: 150 },
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", credits: 500 },
};

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function pickPackCode(body) {
  const raw = (body && (body.pack ?? body.plan ?? body.amount ?? body.price)) ?? "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.replace(/[^\d]/g, "");
}

function pickUserEmail(body) {
  const raw = (body && (body.user_email ?? body.email ?? body.userEmail)) ?? "";
  const email = String(raw).trim().toLowerCase();
  if (!email) return "";
  if (!email.includes("@")) return ""; // basit validasyon
  return email;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    // Stripe instance'ı handler içinde oluştur (env check sonrası)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const packCode = pickPackCode(req.body || {});
    if (!PACKS[packCode]) {
      return res.status(400).json({
        ok: false,
        error: "PACK_NOT_ALLOWED",
        detail: `pack=${packCode || "(empty)"}`
      });
    }

    const userEmail = pickUserEmail(req.body || {});
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_REQUIRED" });
    }

    const { priceId, credits } = PACKS[packCode];
    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        detail: `missing env STRIPE_PRICE_${packCode}`
      });
    }

    const origin = originFromReq(req);

    const successUrl = `${origin}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/fiyatlandirma.html?status=cancel&pack=${encodeURIComponent(packCode)}#packs`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      customer_email: userEmail,

      // ✅ verify + kredi yazma için metadata
      metadata: {
        user_email: userEmail,
        pack: packCode,
        credits: String(credits),
      },
    });

    if (!session?.url) {
      return res.status(500).json({ ok: false, error: "SESSION_URL_MISSING" });
    }

    return res.status(200).json({ ok: true, url: session.url, id: session.id });
  } catch (err) {
    // Stripe hatasını JSON ile döndür (frontend artık null görmesin)
    const message = err?.raw?.message || err?.message || "UNKNOWN_ERROR";
    const code = err?.raw?.code || err?.code || "ERR";
    return res.status(500).json({
      ok: false,
      error: "CHECKOUT_SESSION_CREATE_FAILED",
      code,
      message,
    });
  }
}
