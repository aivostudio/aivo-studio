// /api/stripe/verify-session.js
import Stripe from "stripe";

function getStr(v, fb = "") {
  const s = String(v ?? fb).trim();
  return s;
}

function safeEmail(v) {
  const e = getStr(v).toLowerCase();
  if (!e || !e.includes("@")) return "";
  return e;
}

function pickSessionId(req) {
  // query: ?session_id=...
  const q = req?.query?.session_id || req?.query?.sessionId || "";
  const b = req?.body?.session_id || req?.body?.sessionId || "";
  const s = getStr(q || b);
  return s;
}

// ---- KV helper: Upstash Redis REST (fetch) ----
// Senin projede KV zaten kullanılıyor. Bu helper, UPSTASH_REDIS_REST_URL / TOKEN ile çalışır.
// Eğer sende KV_URL vb. ile farklı wrapper varsa, burayı ona göre uyarlarsın.
// Ama mantık: credits numeric key, invoices json key, processed flag key.

const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.UPSTASH_KV_REST_API_URL ||
  process.env.KV_REST_API_URL ||
  "";

const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.UPSTASH_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  "";

async function redisCmd(cmd, ...args) {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error("KV_REDIS_REST_ENV_MISSING");
  }
  const url = `${REST_URL}/${cmd}/${args.map(a => encodeURIComponent(String(a))).join("/")}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
  });
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error || j?.message || `REDIS_${cmd}_FAILED`;
    const e = new Error(msg);
    e.__redis = j;
    throw e;
  }
  return j?.result;
}

async function getJson(key, fallback) {
  const raw = await redisCmd("get", key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function setJson(key, value) {
  return redisCmd("set", key, JSON.stringify(value));
}

export default async function handler(req, res) {
  try {
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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    // 1) Stripe session çek
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      const msg = e?.raw?.message || e?.message || "STRIPE_SESSION_RETRIEVE_FAILED";
      return res.status(400).json({ ok: false, error: msg });
    }

    // 2) Paid kontrol
    const paid = session?.payment_status === "paid";
    if (!paid) {
      return res.status(200).json({ ok: false, paid: false, error: "NOT_PAID_YET" });
    }

    // 3) Metadata
    const meta = session?.metadata || {};
    const email = safeEmail(meta.user_email || session?.customer_details?.email || session?.customer_email);
    const pack = getStr(meta.pack || "");
    const creditsToAdd = Number(meta.credits || 0) || 0;

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_MISSING_ON_SESSION" });
    }
    if (!creditsToAdd) {
      return res.status(400).json({ ok: false, error: "CREDITS_MISSING_ON_SESSION" });
    }

    // 4) Idempotent: aynı session 2 kere kredi yazmasın
    const processedKey = `AIVO_STRIPE_PROCESSED:${sessionId}`;
    const already = await redisCmd("get", processedKey);
    if (already) {
      // UI senkronu için mevcut state’i yine döndür
      const creditsKey = `AIVO_CREDITS:${email}`;
      const currentCredits = Number(await redisCmd("get", creditsKey)) || 0;

      return res.status(200).json({
        ok: true,
        already_processed: true,
        email,
        pack,
        added: 0,
        credits: currentCredits,
        session_id: sessionId,
      });
    }

    // 5) CREDIT: tek tip anahtar (string numeric) -> INCRBY
    const creditsKey = `AIVO_CREDITS:${email}`;
    let newCredits = 0;

    try {
      newCredits = Number(await redisCmd("incrby", creditsKey, creditsToAdd)) || 0;
    } catch (e) {
      // WRONGTYPE ise: V2 namespace’e geç (çatışmayı bypass)
      const creditsKeyV2 = `AIVO_CREDITS_V2:${email}`;
      newCredits = Number(await redisCmd("incrby", creditsKeyV2, creditsToAdd)) || 0;
    }

    // 6) Invoice: JSON listesi (GET/SET)
    const invoicesKey = `AIVO_INVOICES:${email}`;
    const now = Date.now();

    const invoiceItem = {
      id: `AIVO-${new Date(now).toISOString().slice(0,10).replace(/-/g,"")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      ts: now,
      provider: "stripe",
      type: "purchase",
      status: "paid",
      pack,
      credits: creditsToAdd,
      session_id: sessionId,
      amount_total: session?.amount_total ?? null,
      currency: session?.currency ?? null,
    };

    try {
      const list = await getJson(invoicesKey, []);
      list.unshift(invoiceItem);
      // son 200 kayıt
      await setJson(invoicesKey, list.slice(0, 200));
    } catch (e) {
      // WRONGTYPE ise: V2’ye yaz
      const invoicesKeyV2 = `AIVO_INVOICES_V2:${email}`;
      const list = await getJson(invoicesKeyV2, []);
      list.unshift(invoiceItem);
      await setJson(invoicesKeyV2, list.slice(0, 200));
    }

    // 7) processed flag (SET)
    await redisCmd("set", processedKey, String(now));

    return res.status(200).json({
      ok: true,
      email,
      pack,
      added: creditsToAdd,
      credits: newCredits,
      invoice: invoiceItem,
      session_id: sessionId,
    });
  } catch (err) {
    const msg = err?.message || "VERIFY_SESSION_FAILED";
    return res.status(500).json({ ok: false, error: msg });
  }
}
