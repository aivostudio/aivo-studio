// api/stripe/webhook.js
// Stripe webhook (raw body) + Upstash KV (api/_kv.js) ile kredi ekleme

import Stripe from "stripe";
import kvMod from "../_kv.js";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// RAW BODY
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// KV helpers (TEK OTORİTE)
const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;
const kvIncr = kv.kvIncr;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // Secret kontrol (yoksa Stripe constructEvent patlar)
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.log("[WEBHOOK] ❌ STRIPE_WEBHOOK_SECRET missing");
    return res.status(500).send("STRIPE_WEBHOOK_SECRET missing");
  }

  if (typeof kvGet !== "function" || typeof kvIncr !== "function") {
    console.log("[WEBHOOK] ❌ KV helpers missing (kvGet/kvIncr)");
    return res.status(500).send("KV helpers missing");
  }

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
    return res.status(400).send("Invalid signature");
  }

  console.log("[WEBHOOK] ✅ received", { id: event.id, type: event.type });

  // Sadece bunu işliyoruz
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const session = event.data.object;

  // Stripe checkout tamam ama paid değilse kredi ekleme
  const payment_status = session?.payment_status;
  if (payment_status !== "paid") {
    console.log("[WEBHOOK] (skip) not paid:", payment_status);
    return res.status(200).json({ ok: true, notPaid: true });
  }

  // Email (metadata > customer_email)
  const email = String(
    session?.metadata?.email || session?.customer_email || ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    console.log("[WEBHOOK] ❌ missing email", {
      metaEmail: session?.metadata?.email,
      customerEmail: session?.customer_email,
    });
    return res.status(200).json({ ok: false, missingEmail: true });
  }

  // Credits (metadata)
  const credits = Number(session?.metadata?.credits || 0);
  if (!Number.isFinite(credits) || credits <= 0) {
    console.log("[WEBHOOK] ❌ invalid credits", session?.metadata?.credits);
    return res.status(200).json({ ok: false, invalidCredits: true });
  }

  const key = `credits:${email}`;

  try {
    const before = Number((await kvGet(key).catch(() => 0)) || 0);

    // ✅ atomik ekleme
    const after = await kvIncr(key, credits);

    console.log("[WEBHOOK] ✅ credits added", {
      email,
      key,
      before,
      add: credits,
      after,
      session_id: session?.id,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.log("[WEBHOOK] ❌ KV write fail:", err?.message, { key, credits });
    return res.status(500).json({ ok: false });
  }
}
