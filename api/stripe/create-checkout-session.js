// /api/stripe/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

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

    // Başarılı ödeme sonrası Studio'ya dön (verify tarafını Studio’da ele alacaksın)
    const successUrl = `${origin}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/fiyatlandirma.html?status=cancel&pack=${encodeURIComponent(packCode)}#packs`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Kullanıcı email'i Stripe checkout'ta da görünsün (ops/fiş için iyi)
      customer_email: userEmail,

      // ✅ verify + kredi yazma için gerekli metadata
      metadata: {
