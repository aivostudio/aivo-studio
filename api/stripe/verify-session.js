// api/stripe/verify-session.js
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session_id =
      (req.method === "POST" && req.body?.session_id) ||
      req.query?.session_id ||
      null;

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "MISSING_SESSION_ID" });
    }

    // -------------------------------------------------------
    // Stripe session al
    // -------------------------------------------------------
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Ödeme tamam mı?
    if (session.payment_status !== "paid" || session.status !== "complete") {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_COMPLETED",
        payment_status: session.payment_status,
        session_status: session.status
      });
    }

    // -------------------------------------------------------
    // Paket bilgisi (SADECE PACK DÖNÜYORUZ)
    // -------------------------------------------------------
    const meta = session.metadata || {};
    const pack = meta.pack ? String(meta.pack) : null;

    if (!pack) {
      return res.status(400).json({
        ok: false,
        error: "PACK_NOT_FOUND"
      });
    }

    // -------------------------------------------------------
    // BAŞARILI – FRONTEND STORE HALLEDECEK
    // -------------------------------------------------------
    return res.status(200).json({
      ok: true,
      order_id: session.id,
      pack: pack
    });

  } catch (err) {
    console.error("verify-session error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "UNKNOWN_ERROR"
    });
  }
};
