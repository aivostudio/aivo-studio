import Stripe from "stripe";
import { kv } from "@vercel/kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { session_id } = req.body || {};
    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    // 🔒 IDEMPOTENCY KİLİDİ (STRING)
    const lockKey = `stripe_processed:${session_id}`;

    const alreadyProcessed = await kv.get(lockKey);
    if (alreadyProcessed === "1") {
      return res.status(200).json({
        ok: true,
        status: "already_processed",
      });
    }

    // Stripe doğrulama
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        error: "Payment not completed",
      });
    }

    const email = session.customer_details?.email;
    if (!email) {
      return res.status(400).json({ error: "Missing customer email" });
    }

    const credits = Number(session.metadata?.credits || 0);
    if (!credits || credits <= 0) {
      return res.status(400).json({ error: "Invalid credit amount" });
    }

    // 🔐 KİLİDİ YAZ (STRING)
    await kv.set(lockKey, "1");

    // 🎯 KREDİ EKLE (HASH KULLANMIYORUZ → STRING SAYI)
    const creditKey = `credits:${email}`;
    const currentCreditsRaw = await kv.get(creditKey);
    const currentCredits = Number(currentCreditsRaw || 0);
    const newCredits = currentCredits + credits;

    await kv.set(creditKey, String(newCredits));

    // 🧾 FATURA (HASH)
    const invoiceKey = `invoice:${session.id}`;
    await kv.hset(invoiceKey, {
      email,
      credits: String(credits),
      amount: String(session.amount_total || 0),
      currency: session.currency || "usd",
      created_at: String(Date.now()),
    });

    return res.status(200).json({
      ok: true,
      status: "success",
      credits_added: credits,
      total_credits: newCredits,
    });
  } catch (err) {
    console.error("[VERIFY SESSION ERROR]", err);
    return res.status(500).json({
      error: "verify_failed",
    });
  }
}
