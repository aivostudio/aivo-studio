// /api/stripe/verify-session.js
import Stripe from "stripe";

const PACKS = {
  "199":  { credits: 25,  priceId: process.env.STRIPE_PRICE_199  || "" },
  "399":  { credits: 60,  priceId: process.env.STRIPE_PRICE_399  || "" },
  "899":  { credits: 150, priceId: process.env.STRIPE_PRICE_899  || "" },
  "2999": { credits: 500, priceId: process.env.STRIPE_PRICE_2999 || "" },
};

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function normalizeSid(req) {
  const fromBody = req.body && (req.body.session_id || req.body.sessionId);
  const fromQuery = req.query && (req.query.session_id || req.query.sessionId);
  return String(fromBody || fromQuery || "").trim();
}

function resolvePackFromSession(session, lineItems) {
  const metaPack = String(session?.metadata?.pack || "").trim();
  if (PACKS[metaPack]) return metaPack;

  const priceId = String(lineItems?.data?.[0]?.price?.id || "").trim();
  if (priceId) {
    for (const code of Object.keys(PACKS)) {
      if (PACKS[code].priceId && PACKS[code].priceId === priceId) return code;
    }
  }
  return "";
}

async function safeJson(res) {
  try { return await res.json(); } catch (_) { return null; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const session_id = normalizeSid(req);
    if (!session_id) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id, { limit: 1 });

    const paid = session?.payment_status === "paid";
    const pack = resolvePackFromSession(session, lineItems);

    if (!pack) {
      return res.status(400).json({
        ok: false,
        error: "PACK_RESOLVE_FAILED",
        detail: "metadata.pack missing and priceId not matched to env vars",
      });
    }

    const credits = Number(PACKS[pack].credits || 0);
    const user_email = String(
      session?.metadata?.user_email || session?.customer_email || ""
    ).trim().toLowerCase();

    if (!user_email || !user_email.includes("@")) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_MISSING_IN_SESSION" });
    }

    const order_id = `stripe_${session_id}`;

    if (!paid) {
      return res.status(200).json({
        ok: true,
        paid: false,
        applied: false,
        order_id,
        pack,
        credits,
        user_email,
        amount_total: session?.amount_total,
        currency: session?.currency,
      });
    }

    const origin = originFromReq(req);

    // 1) KREDİ EKLE (credits/add senin mevcut şemana uyumlu payload)
    const addRes = await fetch(`${origin}/api/credits/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // ✅ mevcut credits/add.js (email/amount/order_id) ile uyum
        email: user_email,
        amount: credits,
        order_id,

        // ✅ yeni şema ile de uyum (zararsız)
        user_email,
        credits,
        source: "stripe",
        pack,
        session_id,
      }),
    });

    const addJson = await safeJson(addRes);

    if (!addRes.ok || !addJson?.ok) {
      return res.status(500).json({
        ok: false,
        error: "CREDITS_ADD_FAILED",
        status: addRes.status,
        detail: addJson || null,
      });
    }

    // 2) INVOICE / PURCHASE KAYDI (idempotent)
    const invRes = await fetch(`${origin}/api/purchases/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: user_email,
        order_id,
        provider: "stripe",
        status: "paid",
        pack,
        credits,
        session_id,
        amount_total: session?.amount_total || 0,
        currency: session?.currency || "try",
      }),
    });

    const invJson = await safeJson(invRes);

    // Invoice yazılamasa bile kredi yazıldı; bu yüzden verify ok dönebiliriz ama invoice_err verelim.
    const invoice_ok = !!invJson?.ok;

    return res.status(200).json({
      ok: true,
      paid: true,
      applied: true,
      order_id,
      pack,
      credits,
      user_email,
      amount_total: session?.amount_total,
      currency: session?.currency,
      credits_result: addJson,
      invoice_ok,
      invoice_result: invJson || null,
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
      message: e?.message || "UNKNOWN",
    });
  }
}
