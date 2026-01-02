// /api/stripe/verify-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// TEK KAYNAK: pack -> credits
const PACKS = {
  "199":  { credits: 30,  priceId: process.env.STRIPE_PRICE_199  || "" },
  "399":  { credits: 60,  priceId: process.env.STRIPE_PRICE_399  || "" },
  "899":  { credits: 250, priceId: process.env.STRIPE_PRICE_899  || "" },
  "2999": { credits: 500, priceId: process.env.STRIPE_PRICE_2999 || "" },
};

function normalizeSid(req) {
  // POST body veya GET query destekle
  const fromBody = req.body && req.body.session_id;
  const fromQuery = req.query && req.query.session_id;
  const sid = String(fromBody || fromQuery || "").trim();
  return sid;
}

function resolvePackFromSession(session, lineItems) {
  // 1) metadata.pack en güvenlisi
  const metaPack = String(session?.metadata?.pack || "").trim();
  if (PACKS[metaPack]) return metaPack;

  // 2) line_items priceId ile çöz
  const priceId =
    String(lineItems?.data?.[0]?.price?.id || "").trim();

  if (priceId) {
    for (const code of Object.keys(PACKS)) {
      if (PACKS[code].priceId && PACKS[code].priceId === priceId) return code;
    }
  }

  return "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const session_id = normalizeSid(req);
    if (!session_id) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    // Session’ı çek
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Line items (priceId fallback için)
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id, { limit: 1 });

    const pack = resolvePackFromSession(session, lineItems);
    if (!pack) {
      return res.status(400).json({
        ok: false,
        error: "PACK_RESOLVE_FAILED",
        detail: "metadata.pack missing and priceId not matched to env vars"
      });
    }

    const credits = Number(PACKS[pack].credits || 0);

    // order_id olarak session_id kullanmak yeterli (idempotency için stabil)
    return res.status(200).json({
      ok: true,
      order_id: `stripe_${session_id}`,
      pack,        // "199" | "399" | "899" | "2999"
      credits,     // 30 | 60 | 250 | 500
      paid: session.payment_status === "paid",
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
