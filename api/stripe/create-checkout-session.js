// api/stripe/verify-session.js
const Stripe = require("stripe");
const { getRedis } = require("../_kv");

function creditsFromPriceId(priceId) {
  if (!priceId) return 0;

  // ENV'deki Stripe Price ID'leri ile eşleştiriyoruz
  switch (priceId) {
    case process.env.STRIPE_PRICE_199:
      return 10;
    case process.env.STRIPE_PRICE_399:
      return 30;
    case process.env.STRIPE_PRICE_899:
      return 100;
    case process.env.STRIPE_PRICE_2999:
      return 500;
    default:
      return 0;
  }
}

function creditsFromPack(pack) {
  // pack bazen "199" / "399" gibi gelir (metadata.pack)
  const p = String(pack || "").trim();
  if (p === "199") return 10;
  if (p === "399") return 30;
  if (p === "899") return 100;
  if (p === "2999") return 500;
  return 0;
}

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
        session_status: session.status,
      });
    }

    // -------------------------------------------------------
    // Email bul (kritik)
    // -------------------------------------------------------
    const meta = session.metadata || {};

    const emailRaw =
      session.customer_details?.email ||
      session.customer_email ||
      meta.email ||
      meta.user ||
      null;

    const email = String(emailRaw || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "EMAIL_NOT_FOUND",
        message:
          "Stripe session içinde email bulunamadı. create-checkout-session'da metadata.email eklenmeli veya Stripe customer_details.email gelmeli.",
      });
    }

    // -------------------------------------------------------
    // Paket / Price tespit et
    // -------------------------------------------------------
    const pack = meta.pack ? String(meta.pack).trim() : null;

    let priceId = meta.price_id ? String(meta.price_id).trim() : null;

    // price_id yoksa line_items'tan çek (daha sağlam)
    if (!priceId) {
      const items = await stripe.checkout.sessions.listLineItems(session_id, { limit: 10 });
      const first = items?.data?.[0];
      const p = first?.price?.id || first?.price;
      if (p) priceId = String(p).trim();
    }

    // Kredi miktarı
    let creditsToAdd = 0;

    // Önce pack'e göre dene (metadata.pack geldiyse)
    if (pack) creditsToAdd = creditsFromPack(pack);

    // pack yoksa veya pack'ten kredi 0 çıktıysa priceId üzerinden dene
    if (!creditsToAdd) creditsToAdd = creditsFromPriceId(priceId);

    if (!creditsToAdd) {
      return res.status(400).json({
        ok: false,
        error: "CREDITS_NOT_RESOLVED",
        message:
          "Kredi miktarı bulunamadı. metadata.pack veya line_items price.id, ENV STRIPE_PRICE_* ile eşleşmeli.",
        pack: pack || null,
        priceId: priceId || null,
      });
    }

    // -------------------------------------------------------
    // Upstash Redis - idempotent kredi yaz
    // -------------------------------------------------------
    const redis = getRedis();

    // Stripe order/session id = tekil anahtar
    const oid = String(session.id);
    const orderKey = `aivo:order:stripe:${oid}`; // bu varsa tekrar yazma
    const creditsKey = `aivo:credits:${email}`;

    // set NX: ilk kez geliyorsa kur, değilse already_applied
    // Upstash client: redis.set(key, value, { nx: true, ex: seconds })
    const setOk = await redis.set(orderKey, "1", { nx: true, ex: 60 * 60 * 24 * 60 }); // 60 gün

    if (!setOk) {
      // Daha önce yazılmış
      const current = await redis.get(creditsKey);
      return res.status(200).json({
        ok: true,
        already_applied: true,
        email,
        order_id: oid,
        pack: pack || null,
        priceId: priceId || null,
        added: 0,
        credits: Number(current || 0) || 0,
      });
    }

    // İlk kez: kredi ekle
    const newCredits = await redis.incrby(creditsKey, creditsToAdd);

    return res.status(200).json({
      ok: true,
      already_applied: false,
      email,
      order_id: oid,
      pack: pack || null,
      priceId: priceId || null,
      added: creditsToAdd,
      credits: Number(newCredits || 0) || 0,
    });
  } catch (err) {
    console.error("verify-session error:", err);
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
      message: String(err?.message || err),
    });
  }
};
