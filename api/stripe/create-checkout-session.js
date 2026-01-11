// /api/stripe/verify-session.js
import Stripe from "stripe";
import { kv } from "@vercel/kv"; // Vercel KV / Upstash KV

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const sessionId =
      (req.query && req.query.session_id) ||
      (req.body && (req.body.session_id || req.body.sessionId)) ||
      "";

    const sid = String(sessionId).trim();
    if (!sid) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    // 1) Stripe doğrulama
    const session = await stripe.checkout.sessions.retrieve(sid);

    if (!session) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }

    // Stripe tarafında ödeme tamam mı?
    const paid = session.payment_status === "paid";
    if (!paid) {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_PAID",
        payment_status: session.payment_status,
        status: session.status,
      });
    }

    // 2) Idempotent guard
    const fulfilledKey = `stripe:fulfilled:${sid}`;
    const already = await kv.get(fulfilledKey);
    if (already) {
      // İstersen burada mevcut bakiyeyi de döndür
      return res.status(200).json({ ok: true, already: true });
    }

    // 3) Metadata
    const md = session.metadata || {};
    const email = String(md.user_email || "").trim().toLowerCase();
    const credits = Number(md.credits || 0);

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "METADATA_EMAIL_MISSING" });
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      return res.status(400).json({ ok: false, error: "METADATA_CREDITS_INVALID" });
    }

    // 4) Kredi ekleme (KV)
    // Not: Senin /api/credits/get hangi key’i okuyorsa buna eşitleyebilirsin.
    const creditsKey = `credits:${email}`;

    // Atomic increment + fulfilled işaretle
    // (pipeline kullanmadan iki ayrı komut; serverless’de bile pratikte yeterli,
    // ama istersen kv.multi() ile pipeline’a çevirebiliriz.)
    const newBalance = await kv.incrby(creditsKey, credits);

    // Fulfilled marker (yeniden çağrılırsa kredi eklenmesin)
    await kv.set(fulfilledKey, {
      email,
      credits,
      at: Date.now(),
      session_id: sid,
    });

    return res.status(200).json({
      ok: true,
      already: false,
      email,
      added: credits,
      balance: newBalance,
    });
  } catch (err) {
    const message = err?.raw?.message || err?.message || "UNKNOWN_ERROR";
    const code = err?.raw?.code || err?.code || "ERR";
    return res.status(500).json({
      ok: false,
      error: "VERIFY_SESSION_FAILED",
      code,
      message,
    });
  }
}
