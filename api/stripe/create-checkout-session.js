// /api/stripe/create-checkout-session.js
import Stripe from "stripe";

/**
 * PackCode -> { Stripe Price ID, Credits }
 * PackCode burada fiyat etiketi gibi duruyor (199/399/899/2999).
 */
const PACKS = {
  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", credits: 25  },
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", credits: 60  },
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", credits: 150 },
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", credits: 500 },
};

function originFromReq(req) {
  // Vercel/Proxy arkasında doğru origin yakalamak için:
  const proto =
    (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();

  const host =
    (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();

  // Güvenlik: host boşsa fallback
  if (!host) return "https://aivo.tr";

  return `${proto}://${host}`;
}

function pickPackCode(body) {
  const raw = (body && (body.pack ?? body.plan ?? body.amount ?? body.price ?? body.packCode)) ?? "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.replace(/[^\d]/g, ""); // sadece rakam
}

function pickUserEmail(body) {
  const raw = (body && (body.user_email ?? body.email ?? body.userEmail ?? body.userEmailAddress)) ?? "";
  const email = String(raw).trim().toLowerCase();
  if (!email) return "";
  if (!email.includes("@")) return "";
  // çok basit bir güvenlik: boşluk vb. olmasın
  if (/\s/.test(email)) return "";
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
    const pack = PACKS[packCode];

    if (!pack) {
      return res.status(400).json({
        ok: false,
        error: "PACK_NOT_ALLOWED",
        detail: `pack=${packCode || "(empty)"}`,
        allowed: Object.keys(PACKS),
      });
    }

    const userEmail = pickUserEmail(req.body || {});
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_REQUIRED" });
    }

    const { priceId, credits } = pack;
    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        detail: `missing env STRIPE_PRICE_${packCode}`,
      });
    }

    const origin = originFromReq(req);

    /**
     * Success URL:
     * - session_id kesin taşınsın
     * - Studio notifications ekranı bunu parse edip verify-session çağıracak
     */
    const successUrl =
      `${origin}/studio.html?page=dashboard&stab=notifications` +
      `&stripe=success&session_id={CHECKOUT_SESSION_ID}`;

    /**
     * Cancel URL:
     * - Pricing hub'a geri dön
     */
    const cancelUrl =
      `${origin}/fiyatlandirma.html?status=cancel&pack=${encodeURIComponent(packCode)}#packs`;

    /**
     * Notlar:
     * - customer_email kullanımı OK.
     * - metadata: verify-session kredi + invoice için TEK kaynak.
     *   Burada hem "email" hem "user_email" yazıyorum (geri uyum + kolay tespit).
     */
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: successUrl,
      cancel_url: cancelUrl,

      customer_email: userEmail,

      metadata: {
        email: userEmail,          // ✅ verify tarafı için kolay
        user_email: userEmail,     // (geri uyum)
        pack: packCode,
        credits: String(credits),
        origin,                    // debug amaçlı (istersen kaldır)
      },
    });

    if (!session?.url || !session?.id) {
      return res.status(500).json({
        ok: false,
        error: "SESSION_CREATE_INCOMPLETE",
        detail: { hasUrl: !!session?.url, hasId: !!session?.id },
      });
    }

    return res.status(200).json({
      ok: true,
      url: session.url,
      id: session.id,
      pack: packCode,
      credits,
      success_url: successUrl, // debug (istersen kaldır)
    });
  } catch (err) {
    // Stripe hatasını daha okunur dön
    const message = err?.raw?.message || err?.message || "UNKNOWN_ERROR";
    const code = err?.raw?.code || err?.code || "ERR";
    const type = err?.type || err?.raw?.type;

    // Bazı sık görülen Stripe durumları için daha anlaşılır error
    const isPriceMissing =
      code === "resource_missing" && /No such price/i.test(message);

    return res.status(500).json({
      ok: false,
      error: "CHECKOUT_SESSION_CREATE_FAILED",
      code,
      type,
      message,
      hint: isPriceMissing
        ? "STRIPE_PRICE_* env yanlış veya ilgili Price ID bu Stripe hesabında yok."
        : undefined,
    });
  }
}
