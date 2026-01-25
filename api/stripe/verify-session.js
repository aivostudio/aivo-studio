// /api/stripe/verify-session.js
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();

function json(res, code, obj) {
  // ✅ cache kapat (Safari dahil)
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // ✅ opsiyonel: frontend isterse header'dan da okuyabilsin
  if (obj && typeof obj.credits === "number") {
    res.setHeader("x-aivo-credits", String(obj.credits));
  }

  res.status(code).setHeader("content-type", "application/json").end(JSON.stringify(obj));
}

function isJson(req) {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  return ct.includes("application/json");
}

function safeStr(v) {
  return String(v == null ? "" : v).trim();
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

async function safeDelIfWrongType(redis, key, allowedTypes) {
  try {
    const t = await redis.type(key);
    if (t && t !== "none" && !allowedTypes.includes(t)) {
      await redis.del(key);
    }
  } catch (_) {}
}

export default async function handler(req, res) {
  // 1) METHOD
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "BAD_REQUEST", detail: "METHOD_NOT_ALLOWED" });
  }

  // 2) CONTENT-TYPE
  if (!isJson(req)) {
    return json(res, 415, { ok: false, error: "BAD_REQUEST", detail: "UNSUPPORTED_CONTENT_TYPE" });
  }

  // 3) ENV
  if (!STRIPE_KEY) {
    return json(res, 500, { ok: false, error: "SERVER_ERROR", detail: "STRIPE_SECRET_MISSING" });
  }

  const redis = Redis.fromEnv();
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2023-10-16" });

  try {
    // 4) BODY PARSE (Vercel bazen string gönderir)
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    // 5) CONTRACT
    const session_id = safeStr(body.session_id);
    if (!session_id || typeof body.session_id !== "string" || !session_id.startsWith("cs_")) {
      return json(res, 400, { ok: false, error: "BAD_REQUEST", detail: "INVALID_SESSION_ID" });
    }

    // 6) STRIPE RETRIEVE + expand line_items
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["line_items"] });
    } catch (e) {
      // Stripe “bulunamadı / invalid id” gibi hatalar burada
      const msg = safeStr(e?.raw?.message || e?.message || "Stripe error");
      return json(res, 200, { ok: false, error: "STRIPE_ERROR", detail: msg });
    }

    if (session?.payment_status !== "paid") {
      return json(res, 200, { ok: false, error: "NOT_PAID" });
    }

    const meta = session?.metadata || {};
    const email =
      safeStr(meta.user_email) ||
      safeStr(session?.customer_details?.email) ||
      safeStr(session?.customer_email);

    const creditsToAdd = toInt(meta.credits);

    if (!email) {
      return json(res, 400, { ok: false, error: "BAD_REQUEST", detail: "MISSING_EMAIL" });
    }
    if (!creditsToAdd || creditsToAdd <= 0) {
      return json(res, 400, { ok: false, error: "BAD_REQUEST", detail: "MISSING_CREDITS_METADATA" });
    }

    // 7) Idempotency (asıl koruma)
    const processedKey = `processed:${session_id}`;
    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;

    // WRONGTYPE self-heal
    await safeDelIfWrongType(redis, processedKey, ["string"]);
    await safeDelIfWrongType(redis, creditsKey, ["string"]);
    await safeDelIfWrongType(redis, invoicesKey, ["list"]);

    // SET NX => daha önce işlendi mi?
    const firstTime = await redis.set(processedKey, "1", { nx: true, ex: 60 * 60 * 24 * 30 }); // 30 gün
    if (!firstTime) {
      const current = toInt(await redis.get(creditsKey));
      return json(res, 200, {
        ok: true,
        email,
        added: 0,
        credits: current,
        invoiceId: null,
        already_processed: true,
      });
    }

    // 8) APPLY credits
    const newTotal = await redis.incrby(creditsKey, creditsToAdd);

    // 9) INVOICE (LIST)
    const invoiceId = `stripe_${session_id}`;
    const invoice = {
      id: invoiceId,
      provider: "stripe",
      type: "purchase",
      credits: creditsToAdd,
      created_at: new Date().toISOString(),
      status: "paid",
      stripe: { session_id },
    };
    await redis.lpush(invoicesKey, JSON.stringify(invoice));

    return json(res, 200, {
      ok: true,
      email,
      added: creditsToAdd,
      credits: toInt(newTotal),
      invoiceId,
      already_processed: false,
    });
  } catch (err) {
    const msg = safeStr(err?.message || err);
    return json(res, 500, { ok: false, error: "SERVER_ERROR", detail: msg });
  }
}
