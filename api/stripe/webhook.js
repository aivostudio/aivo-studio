// /api/stripe/webhook.js  (Next.js API Route örneği)
// ÖNEMLİ: Stripe webhook için raw body şart.

import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("[WEBHOOK] ❌ signature/construct fail:", err?.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ LOG: event id/type
  console.log("[WEBHOOK] ✅ received", { id: event.id, type: event.type });

  // Sadece checkout.session.completed üzerinden ilerleyelim
  if (event.type !== "checkout.session.completed") {
    console.log("[WEBHOOK] (skip) type:", event.type);
    return res.status(200).json({ ok: true, skipped: true });
  }

  const session = event.data.object;

  const payment_status = session.payment_status; // 'paid' vs
  const metaEmail = session?.metadata?.email;
  const customerEmail = session?.customer_email;
  const pack = session?.metadata?.pack;
  const creditsRaw = session?.metadata?.credits;

  // credits parse
  const credits = Number(creditsRaw || 0);

  // email normalize
  const email = (metaEmail || customerEmail || "").trim().toLowerCase();
  const key = email ? `credits:${email}` : null;

  // ✅ LOG: temel alanlar
  console.log("[WEBHOOK] session fields", {
    payment_status,
    pack,
    credits,
    metaEmail,
    customerEmail,
    email,
    key,
    session_id: session.id,
  });

  if (payment_status !== "paid") {
    console.log("[WEBHOOK] (skip) not paid:", payment_status);
    return res.status(200).json({ ok: true, notPaid: true });
  }

  if (!email || !key) {
    console.log("[WEBHOOK] ❌ missing email => cannot write credits", {
      metaEmail,
      customerEmail,
    });
    return res.status(200).json({ ok: false, missingEmail: true });
  }

  if (!Number.isFinite(credits) || credits <= 0) {
    console.log("[WEBHOOK] ❌ invalid credits in metadata:", creditsRaw);
    return res.status(200).json({ ok: false, invalidCredits: true });
  }

  // --- KV erişimi (senin projendeki KV helper'ına göre uyarla) ---
  // Aşağıdaki KV client'ını senin mevcut KV'inle değiştir:
  const kv = globalThis.kv || null; // <-- örnek placeholder

  try {
    // ✅ LOG: before/after
    const before = await kv.get(key);
    console.log("[WEBHOOK] KV before", { key, before });

    const afterIncr = await kv.incrby(key, credits);

    const after = await kv.get(key);
    console.log("[WEBHOOK] KV after", { key, afterIncr, after });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.log("[WEBHOOK] ❌ KV write fail:", err?.message, { key, credits });
    return res.status(500).json({ ok: false });
  }
}
