// /api/stripe/verify-session.js
import Stripe from "stripe";
import { kv } from "../_kv.js";

function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "";
  return email;
}

function pickSessionId(req) {
  const q = req.query?.session_id || req.query?.sessionId || "";
  const b = req.body?.session_id || req.body?.sessionId || req.body?.id || "";
  const sid = String(b || q || "").trim();
  if (!sid || !sid.startsWith("cs_")) return "";
  return sid;
}

async function safeGetNumber(key) {
  const raw = await kv.get(key);
  const n = parseInt(String(raw ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

async function safeSetNumber(key, n) {
  const val = String(Math.max(0, Number(n) || 0));
  await kv.set(key, val);
  return parseInt(val, 10);
}

async function safeGetInvoices(key) {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (raw && typeof raw === "object" && Array.isArray(raw.items)) {
    return raw.items;
  }

  return [];
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const sessionId = pickSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      return res.status(400).json({
        ok: false,
        error: "SESSION_RETRIEVE_FAILED",
        message: e?.message || "NO_SUCH_SESSION",
      });
    }

    const paymentStatus = session?.payment_status || "";
    const paid = paymentStatus === "paid";

    // Email: customer_email > metadata.user_email
    const email =
      normalizeEmail(session?.customer_details?.email) ||
      normalizeEmail(session?.customer_email) ||
      normalizeEmail(session?.metadata?.user_email);

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_NOT_FOUND_ON_SESSION" });
    }

    // Pack/credits metadata (yoksa 0 alır)
    const pack = String(session?.metadata?.pack || "").trim() || "unknown";
    const creditsToAdd = parseInt(String(session?.metadata?.credits || "0"), 10) || 0;

    // Paid değilse sadece bilgi dön
    if (!paid) {
      return res.status(200).json({
        ok: true,
        paid: false,
        email,
        session_id: sessionId,
        payment_status: paymentStatus,
      });
    }

    // Idempotency
    const appliedKey = `orders:applied:${sessionId}`;
    const already = await kv.get(appliedKey);
    if (already) {
      // zaten uygulanmış -> kredi/fatura tekrar yazma
      return res.status(200).json({
        ok: true,
        paid: true,
        already_applied: true,
        email,
        session_id: sessionId,
      });
    }

    // Credits: safe numeric set (WRONGTYPE kaçın)
    const creditsKey = `credits:${email}`;
    const before = await safeGetNumber(creditsKey);
    const after = await safeSetNumber(creditsKey, before + Math.max(0, creditsToAdd));

    // Invoice: JSON array append (duplicate guard: same sessionId)
    const invoicesKey = `invoices:${email}`;
    const list = await safeGetInvoices(invoicesKey);

    const now = Date.now();
    const code = `AIVO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(now).slice(-4)}`;

    // aynı session ile double append olmasın
    const exists = list.some((x) => String(x?.session_id || "") === sessionId);
    if (!exists) {
      list.unshift({
        id: code,
        created: now,
        email,
        provider: "stripe",
        pack,
        credits: Math.max(0, creditsToAdd),
        amount_total: session?.amount_total ?? null,
        currency: session?.currency ?? null,
        payment_status: paymentStatus,
        session_id: sessionId,
      });
      await kv.set(invoicesKey, JSON.stringify(list));
    }

    // applied işaretle
    await kv.set(appliedKey, "1");

    return res.status(200).json({
      ok: true,
      paid: true,
      already_applied: false,
      email,
      session_id: sessionId,
      credits_added: Math.max(0, creditsToAdd),
      credits_before: before,
      credits_after: after,
      invoice_added: !exists,
      pack,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "VERIFY_SESSION_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
