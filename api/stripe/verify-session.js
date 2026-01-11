// /api/stripe/verify-session.js
/**
 * =========================================================
 * AIVO — STRIPE VERIFY SESSION (FAZ 1 / BACKEND ONLY)
 * =========================================================
 *
 * AMAÇ (FAZ 1):
 * - UI / AUTH / Topbar JS’e dokunmadan, Stripe ödeme sonrası krediyi ve faturayı
 *   server tarafında doğru, tutarlı ve idempotent (tekrar eklemeyen) şekilde yazmak.
 *
 * SINGLE SOURCE OF TRUTH:
 * - credits ve invoices yalnızca KV (Redis/Upstash) üzerinde tutulur.
 * - Frontend kredi göstermek için /api/credits/get?email=... okur.
 *
 * NET RESPONSE KONTRATI (asla değişmeyecek):
 * - Başarılı işlem:
 *   {
 *     ok: true,
 *     added: <bu işlemde eklenen kredi>,
 *     credits: <yeni toplam kredi>,
 *     invoice: { ... }    // minimum stabil alanlar
 *   }
 * - Aynı session_id tekrar doğrulanırsa (refresh / geri gelme / tekrar çağrı):
 *   ok: true, added: 0, credits: <mevcut>, invoice: <ilk kaydedilen>
 *
 * İDEMPOTENCY (en kritik nokta):
 * - stripe:session:{sessionId} guard key’i yazılır.
 * - Guard varsa tekrar kredi eklenmez (double charge/double credit engeli).
 *
 * KV KEY STANDARD (write == read):
 * - credits:{email}              -> "number"
 * - invoices:{email}             -> "[{invoice...}, ...]" (JSON array, append-only)
 * - stripe:session:{sessionId}   -> "{email, added, credits, invoice, processedAt}"
 *
 * STRIPE DOĞRULAMA:
 * - checkout session retrieve edilir.
 * - payment_status === "paid" zorunlu.
 * - email ve credits, create-checkout-session metadata’sından alınır:
 *   metadata.user_email + metadata.credits + metadata.pack
 *
 * NOTLAR:
 * - Bu fazda webhook zorunlu değil; verify-session çağrısı yeterli.
 * - Daha sonra FAZ 2’de studio return akışında tek doğrulama bloğu ile çağrılacak.
 */

import Stripe from "stripe";
import { getRedis } from "../_kv";

function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

function toInt(n, def = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return def;
  return Math.floor(x);
}

export default async function handler(req, res) {
  try {
    // 1) Method guard
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    // 2) Env guard
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    // 3) Input
    const body = req.body || {};
    const sessionId = String(body.session_id || body.sessionId || "").trim();
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const redis = getRedis();

    // 4) Idempotency guard check (en başta!)
    const guardKey = `stripe:session:${sessionId}`;
    const existingGuardRaw = await redis.get(guardKey);
    if (existingGuardRaw) {
      const g = safeJsonParse(existingGuardRaw, null);

      const email = String(g?.email || "").toLowerCase();
      const rawCredits = email ? await redis.get(`credits:${email}`) : 0;
      const credits = toInt(rawCredits, 0);

      return res.status(200).json({
        ok: true,
        added: 0,
        credits,
        invoice: g?.invoice || null,
      });
    }

    // 5) Stripe session retrieve
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }

    // 6) Payment doğrulama
    const paymentStatus = String(session.payment_status || "");
    if (paymentStatus !== "paid") {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_PAID",
        detail: { payment_status: paymentStatus, status: session.status || null },
      });
    }

    // 7) Metadata -> email + credits
    const meta = session.metadata || {};
    const email = String(meta.user_email || meta.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "EMAIL_MISSING_IN_METADATA" });
    }

    const added = toInt(meta.credits, 0);
    if (added <= 0) {
      return res.status(400).json({ ok: false, error: "CREDITS_INVALID_IN_METADATA" });
    }

    const pack = String(meta.pack || "").trim();

    // 8) Invoice (minimum stabil alanlar)
    const invoice = {
      id: String(session.payment_intent || session.id),
      sessionId: session.id,
      paymentIntent: session.payment_intent || null,
      pack: pack || null,
      credits: added,
      amount_total: session.amount_total ?? null, // küçük birim (TRY=kurus)
      currency: session.currency || null,
      createdAt: session.created ?? Math.floor(Date.now() / 1000),
    };

    // 9) KV keys
    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;

    // 10) Read current credits
    const rawCredits = await redis.get(creditsKey);
    const current = toInt(rawCredits, 0);
    const newTotal = current + added;

    // 11) Append invoice (listeyi bozma)
    const rawInv = await redis.get(invoicesKey);
    const list = safeJsonParse(rawInv, []);
    const invoices = Array.isArray(list) ? list : [];
    invoices.unshift(invoice);

    // 12) Write credits + invoices
    await redis.set(creditsKey, String(newTotal));
    await redis.set(invoicesKey, JSON.stringify(invoices));

    // 13) Write idempotency guard (en son, başarılı yazımdan sonra)
    await redis.set(
      guardKey,
      JSON.stringify({
        email,
        added,
        credits: newTotal,
        invoice,
        processedAt: Date.now(),
      })
    );

    // 14) Return net kontrat
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
