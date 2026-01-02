// /api/stripe/verify-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// create-checkout-session ile AYNI tablo olmalı
const PACKS = {
  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", pack: "starter",  credits: 30  },
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", pack: "standard", credits: 60  },
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", pack: "pro",      credits: 250 },
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", pack: "studio",   credits: 500 },
};

function findPackByPriceId(priceId) {
  const entries = Object.entries(PACKS);
  for (const [code, cfg] of entries) {
    if (cfg.priceId && cfg.priceId === priceId) return { code, ...cfg };
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const method = req.method || "GET";
    const sid =
      method === "GET"
        ? String(req.query.session_id || "").trim()
        : String((req.body && req.body.session_id) || "").trim();

    if (!sid) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const session = await stripe.checkout.sessions.retrieve(sid, {
      expand: ["line_items.data.price"],
    });

    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ ok: false, error: "NOT_PAID" });
    }

    const li = session.line_items?.data?.[0];
    const priceId = li?.price?.id || "";

    const matched = findPackByPriceId(priceId);

    // Stripe metadata pack varsa onu da yardımcı bilgi olarak kullan
    const metaPack = String(session.metadata?.pack || "").trim();

    if (!matched) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_NOT_MATCHED",
        detail: { priceId, metaPack },
      });
    }

    // order_id: idempotency için stable bir şey dön
    const order_id = `stripe_${sid}`;

    return res.status(200).json({
      ok: true,
      order_id,
      pack: matched.pack,          // "starter/standard/pro/studio"
      pack_code: matched.code,     // "199/399/899/2999"
      credits: matched.credits,    // ✅ doğru kredi
      price_id: priceId,
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
