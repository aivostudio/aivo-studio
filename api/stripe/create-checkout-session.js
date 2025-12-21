/**
 * Vercel Serverless Function
 * Path: /api/stripe/create-checkout-session.js
 *
 * GEREKENLER:
 * - Vercel Env: STRIPE_SECRET_KEY
 * - package.json: "stripe" dependency
 */

const Stripe = require("stripe");

// Stripe init (apiVersion vermeden de çalışır; istersen sabitleyebiliriz)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan -> Stripe Price ID eşlemesi (BURAYI gerçek price_... ile doldur)
const PRICE_BY_PLAN = {
  "Başlangıç Paket": "price_XXXXX",
  "Standart Paket": "price_YYYYY",
  "Pro Paket": "price_ZZZZZ",
  "Studio Paket": "price_AAAAA",
};

// Origin'i sağlam hesapla (Vercel'de bazen req.headers.origin boş gelebiliyor)
function getOrigin(req) {
  const origin = req.headers.origin;
  if (origin) return origin;

  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.connection && req.connection.encrypted ? "https" : "http") ||
    "https";

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return `${proto}://${host}`;

  // En kötü fallback
  return "https://aivo.tr";
}

// Basit CORS + preflight (gerekli olmayabilir ama sorunsuz yapar)
function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  const origin = getOrigin(req);
  setCors(res, origin);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Secret key yoksa erken ve net hata
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error:
        "Server config error: STRIPE_SECRET_KEY tanımlı değil (Vercel Env ayarla).",
    });
  }

  try {
    const { plan } = req.body || {};
    const normalizedPlan = String(plan || "").trim();

    const priceId = PRICE_BY_PLAN[normalizedPlan];
    if (!priceId) {
      return res.status(400).json({ error: "Geçersiz plan" });
    }

    // İstersen metadata ek bilgi
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      // Checkout sonrası dönüş
      success_url: `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout.html?cancelled=1`,

      metadata: { plan: normalizedPlan },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[stripe] create session error:", err);

    // Stripe hata mesajını mümkün olduğunca kullanıcıya “güvenli” aktar
    const msg =
      (err && err.raw && err.raw.message) ||
      (err && err.message) ||
      "Stripe session oluşturulamadı";

    return res.status(500).json({ error: msg });
  }
};
