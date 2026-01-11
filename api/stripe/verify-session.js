// /api/stripe/verify-session.js
import Stripe from "stripe";
import { getRedis } from "../_kv";

/**
 * =========================================================
 * AIVO — Stripe Verify Session (FAZ 1) — FINAL BASELINE
 * =========================================================
 *
 * HEDEF
 * - Backend TEK kontratla dönsün:
 *     { ok:true, added:number, credits:number, invoice:{...} }
 * - Server source of truth:
 *     credits:${email}  -> STRING (number as string)
 *     invoices:${email} -> STRING (JSON array)
 * - Idempotency:
 *     stripe:session:${session_id} -> "1"
 *     Aynı session 2. kez gelirse tekrar kredi eklemez (added=0 döner)
 *
 * NEDEN BU DOSYA KRİTİK?
 * - UI/Auth’a dokunmadan ödeme doğrulama + kredi yazma + fatura yazmayı tek noktada çözer.
 * - Daha önceki karışıklıkların %90’ı: kontrat belirsizliği + KV type karmaşasıydı.
 *
 * DİKKAT
 * - KV’de geçmişten kalma WRONGTYPE varsa (eski list/hash vs):
 *   Upstash’ta credits:<email> ve invoices:<email> key’lerini DEL ile temizle.
 */

function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const redis = getRedis();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const session_id = String(req.body?.session_id || "").trim();
    if (!session_id) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    // 1) Stripe'tan session çek
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    if (!session) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }

    // 2) Paid kontrolü
    const paid =
      session.payment_status === "paid" ||
      session.status === "complete";

    if (!paid) {
      return res.status(200).json({
        ok: false,
        error: "NOT_PAID",
        payment_status: session.payment_status || null,
        status: session.status || null,
      });
    }

    // 3) Email bul (öncelik: metadata -> customer_details -> customer_email)
    const meta = session.metadata || {};
    const email =
      String(meta.user_email || "").trim().toLowerCase() ||
      String(session.customer_details?.email || "").trim().toLowerCase() ||
      String(session.customer_email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "EMAIL_MISSING_ON_SESSION" });
    }

    // 4) Credits to add (metadata güvenilir)
    const creditsToAdd = Number(meta.credits || 0);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd < 0) {
      return res.status(400).json({ ok: false, error: "INVALID_CREDITS_METADATA" });
    }

    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;
    const idemKey = `stripe:session:${session_id}`;

    // 5) Idempotency (aynı session tekrar gelirse ekleme yapma)
    // Upstash set NX desteği: { nx:true, ex: seconds }
    let firstApply = false;
    try {
      const setRes = await redis.set(idemKey, "1", { nx: true, ex: 60 * 60 * 24 * 30 }); // 30 gün
      firstApply = !!setRes; // setRes truthy ise ilk kez yazıldı
    } catch (e) {
      // NX opsiyonunu desteklemeyen wrapper varsa fallback:
      const already = await redis.get(idemKey);
      if (already) firstApply = false;
      else {
        await redis.set(idemKey, "1");
        firstApply = true;
      }
    }

    // 6) Mevcut kredi oku (STRING)
    let currentCredits = 0;
    try {
      const raw = await redis.get(creditsKey);
      currentCredits = Number(raw) || 0;
    } catch (e) {
      // BURASI genelde WRONGTYPE’a düşer. Çözüm: KV’de credits:<email> DEL.
      return res.status(500).json({
        ok: false,
        error: "CREDITS_READ_FAILED",
        code: "WRONGTYPE_OR_READ",
        message: String(e?.message || e),
        hint: `Upstash: DEL ${creditsKey}`,
      });
    }

    // 7) Eğer ilk apply ise kredi ekle, değilse added=0
    const added = firstApply ? creditsToAdd : 0;
    const newTotal = firstApply ? (currentCredits + creditsToAdd) : currentCredits;

    if (firstApply) {
      try {
        await redis.set(creditsKey, String(newTotal));
      } catch (e) {
        return res.status(500).json({
          ok: false,
          error: "CREDITS_WRITE_FAILED",
          message: String(e?.message || e),
        });
      }
    }

    // 8) Invoice objesi üret
    const invoice = {
      id: `inv_${session_id}`,
      session_id,
      email,
      created: Date.now(),
      currency: session.currency || "try",
      amount_total: Number(session.amount_total || 0),
      pack: String(meta.pack || ""),
      credits: creditsToAdd,
      added, // idempotent ise 0 döner
      payment_intent: session.payment_intent?.id || null,
      origin: originFromReq(req),
    };

    // 9) invoices:${email} -> JSON array string (en yeni başa)
    try {
      const rawInv = await redis.get(invoicesKey);
      const arr = safeJsonParse(rawInv, []);
      const list = Array.isArray(arr) ? arr : [];

      // aynı session varsa tekrar ekleme (ekstra koruma)
      const exists = list.some((x) => x && x.session_id === session_id);
      const next = exists ? list : [invoice, ...list];

      // limit
      const trimmed = next.slice(0, 50);
      await redis.set(invoicesKey, JSON.stringify(trimmed));
    } catch (e) {
      // WRONGTYPE ise çözüm: DEL invoices:<email>
      return res.status(500).json({
        ok: false,
        error: "INVOICE_WRITE_FAILED",
        code: "WRONGTYPE_OR_WRITE",
        message: String(e?.message || e),
        hint: `Upstash: DEL ${invoicesKey}`,
      });
    }

    // 10) Tek kontrat
    return res.status(200).json({
      ok: true,
      added,
      credits: newTotal,
      invoice,
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
