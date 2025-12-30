// api/stripe/verify-session.js
const Stripe = require("stripe");

/**
 * ⚠️ BU ÖRNEKTE:
 * - addCreditsToUser(email, credits)
 * - isOrderProcessed(orderId)
 * - markOrderProcessed(orderId)
 * fonksiyonlarını SENİN sistemine göre dolduracaksın.
 */

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session_id =
      req.body?.session_id || req.query?.session_id || null;

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    // 1️⃣ Stripe session al
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid" || session.status !== "complete") {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_COMPLETED",
        payment_status: session.payment_status,
        session_status: session.status
      });
    }

    const orderId = session.id;

    // 2️⃣ IDMPOTENCY – bu sipariş daha önce işlendi mi?
    if (await isOrderProcessed(orderId)) {
      return res.status(200).json({
        ok: true,
        already_processed: true
      });
    }

    // 3️⃣ Paket → kredi eşlemesi
    const pack = session.metadata?.pack;
    const CREDIT_MAP = {
      "199": 10,
      "399": 25,
      "899": 60,
      "2999": 250
    };

    const creditsToAdd = CREDIT_MAP[pack];
    if (!creditsToAdd) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PACK",
        pack
      });
    }

    // 4️⃣ Kullanıcıyı bul
    const email = session.customer_details?.email;
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "CUSTOMER_EMAIL_MISSING"
      });
    }

    // 5️⃣ KREDİ EKLE (BURASI SENİN SİSTEMİN)
    await addCreditsToUser(email, creditsToAdd);

    // 6️⃣ Siparişi kilitle
    await markOrderProcessed(orderId);

    return res.status(200).json({
      ok: true,
      credits_added: creditsToAdd,
      email,
      orderId
    });

  } catch (err) {
    console.error("verify-session error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "UNKNOWN_ERROR"
    });
  }
};

/* =========================================================
   🔧 SANA AİT OLACAK YERLER
   ========================================================= */

async function isOrderProcessed(orderId) {
  // DB / KV / Redis / file
  return false;
}

async function markOrderProcessed(orderId) {
  // DB / KV / Redis / file
}

async function addCreditsToUser(email, credits) {
  // Kullanıcı tablosunda credit += credits
}
