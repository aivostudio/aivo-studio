// /api/stripe/webhook.js
// Stripe webhook – email-key tek otorite + KV write

import Stripe from "stripe";
import kvMod from "./_kv.js";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---- RAW BODY ----
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// ---- KV HELPERS (TEK OTORİTE) ----
const kvWrap = kvMod?.default || kvMod || {};
const kvGet = kvWrap.kvGet;
const kvSet = kvWrap.kvSet;

// ---- HANDLER ----
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
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
    console.log("[WEBHOOK] ❌ signature error:", err?.message);
    return res.status(400).send("Invalid signature");
  }

  console.log("[WEBHOOK] received", event.type, event.id);

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ ok: true, skipped: true });
  }

  if (typeof kvGet !== "function" || typeof kvSet !== "function") {
    console.log("[WEBHOOK] ❌ KV helpers missing");
    return res.status(500).json({ ok: false });
  }

  const session = event.data.object;

  const payment_status = session.payment_status;
  if (payment_status !== "paid") {
    return res.status(200).json({ ok: true, notPaid: true });
  }

  const email = (
    session?.metadata?.email ||
    session?.customer_email ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    console.log("[WEBHOOK] ❌ email missing");
    return res.status(200).json({ ok: false, missingEmail: true });
  }

  const credits = Number(session?.metadata?.credits || 0);
  if (!Number.isFinite(credits) || credits <= 0) {
    console.log("[WEBHOOK] ❌ invalid credits", session?.metadata?.credits);
    return res.status(200).json({ ok: false, invalidCredits: true });
  }

  const key = `credits:${email}`;

  try {
    const beforeRaw = await kvGet(key).catch(() => null);
    const before = Number(beforeRaw || 0);

    const next = before + credits;

    await kvSet(key, String(next));

    const afterRaw = await kvGet(key).catch(() => null);
    const after = Number(afterRaw || 0);

    console.log("[WEBHOOK] ✅ credits written", {
      email,
      before,
      credits,
      after,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.log("[WEBHOOK] ❌ KV write fail:", err?.message);
    return res.status(500).json({ ok: false });
  }
}
