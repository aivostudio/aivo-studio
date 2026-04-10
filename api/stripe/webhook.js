// api/stripe/webhook.js
// Stripe webhook (Next.js API route) - RAW body şarttır.
// KV yazımı: api/_kv.js üzerinden (Upstash/Vercel KV)

import Stripe from "stripe";
import kvMod from "../_kv.js";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function normEmail(s) {
  const email = String(s || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing Stripe-Signature header");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET env");
  }

  // KV helpers (senin mevcut helper'ın)
  const kv = kvMod?.default || kvMod || {};
  const kvGet = kv.kvGet;
  const kvSet = kv.kvSet;
  const kvIncr = kv.kvIncr;

  if (typeof kvGet !== "function" || typeof kvSet !== "function" || typeof kvIncr !== "function") {
    return res.status(500).send("KV helpers missing (kvGet/kvSet/kvIncr)");
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("[WEBHOOK] signature/construct fail:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message || "UNKNOWN"}`);
  }

  // Sadece bunu işliyoruz
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ ok: true, skipped: true, type: event.type });
  }

  // Idempotency: aynı event 2 kere gelirse kredi 2 kere yazılmasın
  const dedupeKey = `stripe:event:${event.id}`;
  try {
    const seen = await kvGet(dedupeKey);
    if (seen) {
      return res.status(200).json({ ok: true, deduped: true });
    }
  } catch (_) {
    // dedupe kontrolü patlarsa devam (kredi yazımı daha kritik)
  }

  const session = event.data.object;

  const paymentStatus = String(session?.payment_status || "");
  if (paymentStatus !== "paid") {
    // Bazı durumlarda completed ama paid değil -> yazma
    return res.status(200).json({ ok: true, notPaid: true, payment_status: paymentStatus });
  }

  const credits = Number(session?.metadata?.credits || 0);
  const email = normEmail(session?.metadata?.email || session?.customer_email);

  if (!email) return res.status(200).json({ ok: false, missingEmail: true });
  if (!Number.isFinite(credits) || credits <= 0) {
    return res.status(200).json({ ok: false, invalidCredits: true, creditsRaw: session?.metadata?.credits });
  }

  const creditsKey = `credits:${email}`;

  try {
    // önce dedupe yaz (7 gün) -> sonra kredi artır
    await kvSet(dedupeKey, "1", { ex: 60 * 60 * 24 * 7 });

    const before = await kvGet(creditsKey);
    const afterIncr = await kvIncr(creditsKey, credits);
    const after = await kvGet(creditsKey);

    console.log("[WEBHOOK] credits updated", {
      email,
      creditsKey,
      credits,
      before,
      afterIncr,
      after,
      session_id: session?.id,
      event_id: event?.id,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.log("[WEBHOOK] KV write fail:", err?.message, { creditsKey, credits });
    return res.status(500).json({ ok: false, error: "KV_WRITE_FAIL", message: err?.message || "UNKNOWN" });
  }
}
