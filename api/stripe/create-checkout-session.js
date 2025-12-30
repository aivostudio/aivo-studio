// /api/stripe/create-checkout-session.js

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // CORS (preflight)
    // -------------------------------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST,OPTIONS");
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    // -------------------------------------------------------
    // Body parse (Vercel bazen string geçirir)
    // -------------------------------------------------------
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body && typeof body === "object" ? body : {};

    // -------------------------------------------------------
    // Plan normalize: plan | pack | price
    // -------------------------------------------------------
    const rawPlan =
      (body.plan ?? body.pack ?? body.price ?? "").toString().trim();

    // Sadece rakamları al (örn "199 ₺" -> "199")
    const normalized = rawPlan.replace(/[^\d]/g, "");

    const ALLOWED = ["199", "399", "899", "2999"];
    if (!ALLOWED.includes(normalized)) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz paket",
        got: rawPlan,
        normalized,
        allowed: ALLOWED
      });
    }

    // -------------------------------------------------------
    // Stripe init
    // -------------------------------------------------------
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Burada 2 seçenek var:
    // A) Price ID'ler ENV'de (önerilen)
    // B) “amount” ile price_data (sende ürün/price kurgusu yoksa)
    //
    // A) ENV price id yaklaşımı:
    const PRICE_MAP = {
      "199": process.env.STRIPE_PRICE_199,
      "399": process.env.STRIPE_PRICE_399,
      "899": process.env.STRIPE_PRICE_899,
      "2999": process.env.STRIPE_PRICE_2999
    };

    const priceId = PRICE_MAP[normalized];

    if (!priceId) {
      // ENV eksikse net hata dön
      return res.status(500).json({
        ok: false,
        error: "STRIPE_PRICE_ID_MISSING",
        pack: normalized
      });
    }

    // Success/Cancel URL (sende hangi route ise ona göre)
    // Örn: checkout sayfan aynı domain üzerinde
    const origin =
      (req.headers.origin && req.headers.origin.startsWith("http"))
        ? req.headers.origin
        : "https://www.aivo.tr";

    const success_url = `${origin}/checkout?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url  = `${origin}/checkout?status=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,

      // İstersen metadata ile pack taşı:
      metadata: { pack: normalized }
    });

    return res.status(200).json({ ok: true, url: session.url });

  } catch (err) {
    console.error("[Stripe] create-checkout-session error:", err);
    return res.status(500).json({
      ok: false,
      error: "STRIPE_SESSION_CREATE_FAILED",
      detail: err && err.message ? err.message : String(err)
    });
  }
};
