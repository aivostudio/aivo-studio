// /api/stripe/verify-session.js
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Upstash Redis (KV_REST_API_URL/TOKEN veya UPSTASH_REDIS_REST_URL/TOKEN)
// Not: Sizde KV_* da var UPSTASH_* da var. Öncelik KV_* olsun.
const redis = Redis.fromEnv();

function pickSessionId(req) {
  const bodyId = req?.body?.session_id || req?.body?.sessionId;
  const queryId = req?.query?.session_id || req?.query?.sessionId;
  const sid = String(bodyId || queryId || "").trim();
  return sid;
}

function pickEmailFromSession(sess) {
  const meta = sess?.metadata || {};
  const e1 = (sess?.customer_details?.email || "").trim().toLowerCase();
  const e2 = (sess?.customer_email || "").trim().toLowerCase();
  const e3 = (meta.email || meta.user_email || "").trim().toLowerCase();
  const email = e1 || e2 || e3;
  if (!email || !email.includes("@")) return "";
  return email;
}

function pickCreditsDelta(sess) {
  const meta = sess?.metadata || {};
  const raw = meta.credits ?? meta.credit ?? meta.credit_amount;
  const n = parseInt(String(raw || "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

async function ensureStringIntKey(key) {
  // INCRBY için key mutlaka string/integer olmalı
  const t = await redis.type(key); // "none" | "string" | "list" | "hash" | ...
  if (t === "none" || t === "string") return;

  // WRONGTYPE fix: eskiyi yedekle, yenisini 0 başlat
  const backup = `${key}:legacy:${Date.now()}`;
  try {
    // rename atomik; hedef yoksa çalışır
    await redis.rename(key, backup);
  } catch (e) {
    // rename bazı ortamlarda kapalı olabilir; o zaman del yap
    try { await redis.del(key); } catch {}
  }
  await redis.set(key, "0");
}

async function ensureJsonArrayKey(key) {
  // invoices:<email> için JSON array string tutacağız
  const t = await redis.type(key);
  if (t === "none") {
    await redis.set(key, "[]");
    return;
  }
  if (t === "string") {
    const cur = await redis.get(key);
    // string ama array değilse yedekleyip boş array yap
    try {
      const parsed = typeof cur === "string" ? JSON.parse(cur) : cur;
      if (Array.isArray(parsed)) return;
    } catch {}
    const backup = `${key}:legacy:${Date.now()}`;
    try { await redis.rename(key, backup); } catch { try { await redis.del(key); } catch {} }
    await redis.set(key, "[]");
    return;
  }

  // list/hash vb ise migrate
  const backup = `${key}:legacy:${Date.now()}`;
  try { await redis.rename(key, backup); } catch { try { await redis.del(key); } catch {} }
  await redis.set(key, "[]");
}

function makeInvoiceRecord({ sessionId, email, creditsDelta, sess }) {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}` +
    `-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  const short = String(sessionId).slice(-6).toUpperCase();
  const invoiceNo = `AIVO-${stamp}-${short}`;

  return {
    id: sessionId,
    no: invoiceNo,
    email,
    status: "paid",
    method: "card",
    credits: creditsDelta,
    amount_total: sess?.amount_total ?? null,
    currency: sess?.currency ?? null,
    created_at: now.toISOString(),
    pack: sess?.metadata?.pack || null,
  };
}

export default async function handler(req, res) {
  try {
    // GET de kabul et (yanlış çağrılar 405 üretmesin)
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const sessionId = pickSessionId(req);
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    // Stripe session çek
    let sess;
    try {
      sess = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      const msg = e?.raw?.message || e?.message || "STRIPE_RETRIEVE_FAILED";
      return res.status(400).json({ ok: false, error: msg });
    }

    const paid =
      sess?.payment_status === "paid" ||
      sess?.status === "complete";

    if (!paid) {
      return res.status(200).json({
        ok: true,
        paid: false,
        status: sess?.status || null,
        payment_status: sess?.payment_status || null,
      });
    }

    const email = pickEmailFromSession(sess);
    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_NOT_FOUND" });
    }

    const creditsDelta = pickCreditsDelta(sess);
    if (!creditsDelta) {
      return res.status(400).json({ ok: false, error: "CREDITS_METADATA_MISSING" });
    }

    // Idempotency
    const appliedKey = `orders:applied:${sessionId}`;
    const was = await redis.get(appliedKey);
    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;

    // Key type guard (WRONGTYPE fix)
    await ensureStringIntKey(creditsKey);
    await ensureJsonArrayKey(invoicesKey);

    if (was) {
      // zaten uygulanmış -> mevcut krediyi ve faturaları dön
      const creditsNowRaw = await redis.get(creditsKey);
      const creditsNow = parseInt(String(creditsNowRaw || "0"), 10) || 0;

      return res.status(200).json({
        ok: true,
        paid: true,
        already_applied: true,
        session_id: sessionId,
        email,
        credits_delta: 0,
        credits_after: creditsNow,
      });
    }

    // Apply: önce “applied” set (yarım uygulamayı önlemek için)
    await redis.set(appliedKey, "1");

    // Credits incr
    const creditsAfter = await redis.incrby(creditsKey, creditsDelta);

    // Invoice append (JSON array string)
    const cur = await redis.get(invoicesKey);
    let arr = [];
    try {
      arr = typeof cur === "string" ? JSON.parse(cur) : (cur || []);
      if (!Array.isArray(arr)) arr = [];
    } catch {
      arr = [];
    }

    const inv = makeInvoiceRecord({ sessionId, email, creditsDelta, sess });
    // Aynı session id varsa tekrar ekleme (ekstra güvenlik)
    if (!arr.some(x => x && x.id === sessionId)) {
      arr.unshift(inv);
      await redis.set(invoicesKey, JSON.stringify(arr));
    }

    return res.status(200).json({
      ok: true,
      paid: true,
      already_applied: false,
      session_id: sessionId,
      email,
      credits_delta: creditsDelta,
      credits_after: Number(creditsAfter) || 0,
      invoice_no: inv.no,
    });
  } catch (err) {
    const msg = err?.message || "VERIFY_FAILED";
    return res.status(500).json({ ok: false, error: msg });
  }
}
