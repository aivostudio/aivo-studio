// /api/stripe/verify-session.js
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Upstash Redis (Vercel KV / Upstash)
const redis = Redis.fromEnv();

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

// Güvenli sayı parse
function toInt(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export default async function handler(req, res) {
  try {
    // Sadece GET kabul edelim (405 hatası buradan geliyordu)
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const session_id = String(req.query?.session_id || "").trim();
    if (!session_id) {
      return json(res, 400, { ok: false, error: "Missing session_id" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return json(res, 500, { ok: false, error: "Missing STRIPE_SECRET_KEY" });
    }

    // Stripe session çek
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["customer", "payment_intent"],
    });

    // Ödeme durumu
    const paid =
      session?.payment_status === "paid" ||
      session?.status === "complete";

    if (!paid) {
      return json(res, 200, {
        ok: false,
        paid: false,
        payment_status: session?.payment_status || null,
        status: session?.status || null,
        error: "Payment not completed",
      });
    }

    // Email bulma (öncelik sırası)
    const email =
      (session?.customer_details?.email || "").trim().toLowerCase() ||
      (session?.metadata?.email || "").trim().toLowerCase() ||
      "";

    if (!email) {
      return json(res, 200, { ok: false, paid: true, error: "Missing customer email" });
    }

    // Paket/kredi bilgisi (metadata’dan)
    const pack = String(session?.metadata?.pack || "").trim(); // örn: "2999"
    const creditsToAdd = toInt(session?.metadata?.credits, 0);

    if (!creditsToAdd || creditsToAdd <= 0) {
      return json(res, 200, {
        ok: false,
        paid: true,
        email,
        error: "Missing/invalid credits in session metadata",
      });
    }

    // ✅ İdempotent anahtar: aynı session bir daha işlenmesin
    const processedKey = `stripe_processed:${session_id}`;
    const already = await redis.get(processedKey);

    if (already) {
      // Zaten işlenmiş -> sadece mevcut krediyi döndür
      const currentCreditsRaw = await redis.get(`credits:${email}`);
      const currentCredits = toInt(currentCreditsRaw, 0);

      return json(res, 200, {
        ok: true,
        paid: true,
        email,
        pack,
        added: 0,
        credits: currentCredits,
        alreadyProcessed: true,
      });
    }

    // ✅ Atomik akış: önce processedKey koy, sonra kredi ekle
    // (Küçük yarış durumlarında çift eklemeyi engeller)
    await redis.set(processedKey, "1", { ex: 60 * 60 * 24 * 30 }); // 30 gün

    // Kredi ekle
    const newCredits = await redis.incrby(`credits:${email}`, creditsToAdd);

    // Fatura kaydı (LIST)
    const inv = {
      id: `inv_${Date.now()}`,
      provider: "stripe",
      type: "purchase",
      status: "paid",
      email,
      session_id,
      pack,
      credits: creditsToAdd,
      amount_total: session?.amount_total ?? null,
      currency: session?.currency ?? null,
      ts: new Date().toISOString(),
    };

    const invoicesKey = `invoices:${email}`;
    await redis.lpush(invoicesKey, JSON.stringify(inv));
    await redis.ltrim(invoicesKey, 0, 199); // son 200 kayıt

    return json(res, 200, {
      ok: true,
      paid: true,
      email,
      pack,
      added: creditsToAdd,
      credits: toInt(newCredits, 0),
      invoice: inv,
      alreadyProcessed: false,
    });
  } catch (err) {
    // 500’leri görünür yapalım
    console.error("[verify-session] error:", err);
    return json(res, 500, {
      ok: false,
      error: "Server error",
      detail: String(err?.message || err),
    });
  }
}
