// /api/stripe/verify-session.js
import Stripe from "stripe";
import { kv } from "@vercel/kv";

// TEK KAYNAK: pack -> credits (+ priceId fallback)
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
  // 1) metadata.pack en güvenlisi
  const metaPack = String(session?.metadata?.pack || "").trim();
  if (PACKS[metaPack]) return metaPack;

  // 2) line_items -> priceId ile çöz
  const priceId = String(lineItems?.data?.[0]?.price?.id || "").trim();
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

    // Session + line items
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id, { limit: 1 });

    // Stripe payment status
    const payment_status = String(session?.payment_status || "");
    const paid = payment_status === "paid";

    // Pack resolve
    const pack = resolvePackFromSession(session, lineItems);
    if (!pack) {
      return res.status(400).json({
        ok: false,
        error: "PACK_RESOLVE_FAILED",
        detail: "metadata.pack missing and priceId not matched to env vars",
      });
    }

    // Credits
    const credits = Number(PACKS[pack].credits || 0);

    // Email resolve (metadata.user_email > customer_email)
    const user_email =
      String(session?.metadata?.user_email || session?.customer_email || "")
        .trim()
        .toLowerCase();

    if (!user_email || !user_email.includes("@")) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_MISSING_IN_SESSION" });
    }

    const order_id = `stripe_${session_id}`;

    // Paid değilse kredi yazma yok
    if (!paid) {
      return res.status(200).json({
        ok: true,
        paid: false,
        applied: false,
        order_id,
        pack,
        credits,
        user_email,
        payment_status,
        amount_total: session?.amount_total,
        currency: session?.currency,
      });
    }

    // ✅ Idempotency
    const idemKey = `aivo:stripe:applied:${session_id}`;
    const wasApplied = await kv.get(idemKey);

    if (wasApplied) {
      // Already applied => frontend "başarısız" sanmasın
      return res.status(200).json({
        ok: true,
        paid: true,
        applied: true,
        already_applied: true,
        order_id,
        pack,
        credits,
        user_email,
        payment_status,
        amount_total: session?.amount_total,
        currency: session?.currency,
      });
    }

    // Kilidi önce yaz (race riskini azaltır)
    await kv.set(idemKey, "1", { ex: 60 * 60 * 24 * 30 });

    // ✅ Kredi ekleme: /api/credits/add
    const origin = originFromReq(req);

    const addRes = await fetch(`${origin}/api/credits/add`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // internal bypass için (credits/add bunu kontrol edecek)
        "x-aivo-internal": process.env.AIVO_INTERNAL_KEY || "",
      },
      body: JSON.stringify({
        user_email,
        credits,
        order_id,
        source: "stripe",
        pack,
        session_id,
      }),
    });

    const addText = await addRes.text();
    let addJson = null;
    try {
      addJson = JSON.parse(addText);
    } catch (e) {
      addJson = { ok: false, raw: addText };
    }

    if (!addRes.ok || !addJson?.ok) {
      // kredi ekleme başarısızsa idem kilidini geri al
      await kv.del(idemKey);

      return res.status(500).json({
        ok: false,
        error: "CREDITS_ADD_FAILED",
        status: addRes.status,
        detail: addJson,
      });
    }

    return res.status(200).json({
      ok: true,
      paid: true,
      applied: true,
      order_id,
      pack,
      credits,
      user_email,
      payment_status,
      amount_total: session?.amount_total,
      currency: session?.currency,
      credits_result: addJson,
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
