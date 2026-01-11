// /api/stripe/verify-session.js
const Stripe = require("stripe");
const { getRedis } = require("../_kv");

function safeEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return "";
  return e;
}

function parseBody(req) {
  const b = req && req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (typeof b === "string") {
    try {
      const obj = JSON.parse(b);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }
  return {};
}

function pickSessionId(req) {
  const body = parseBody(req);
  const sid = body.session_id || body.sessionId || "";
  return String(sid || "").trim();
}

// OPTIONAL: priceId -> credits fallback (metadata yoksa)
// Burayı senin gerçek Stripe priceId’lerinle dolduracağız.
const PRICE_TO_CREDITS = {
  // "price_123": 500,
  // "price_456": 1000,
};

async function setIdempotent(redis, key, value, ttlSeconds) {
  // SET key value NX EX ttl
  try {
    const r = await redis.set(key, value, "NX", "EX", ttlSeconds);
    if (r === "OK") return true;
    if (r === null) return false;
  } catch (_) {}

  // Fallback: setnx + expire
  try {
    if (typeof redis.setnx === "function") {
      const ok = await redis.setnx(key, value);
      if (ok === 1 || ok === true) {
        if (typeof redis.expire === "function") await redis.expire(key, ttlSeconds);
        return true;
      }
      return false;
    }
  } catch (_) {}

  // Last resort (not race-safe)
  const exists = await redis.get(key);
  if (exists) return false;
  await redis.set(key, value);
  return true;
}

module.exports = async (req, res) => {
  try {
    // ONLY POST
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed", allowed: ["POST"] });
    }

    // content-type must be json
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return res.status(415).json({ ok: false, error: "content_type_must_be_json" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const sessionId = pickSessionId(req);
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        ok: false,
        error: "session_id_required",
        hint: 'POST JSON: {"session_id":"cs_..."}',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const redis = getRedis();

    // Retrieve session (expand line_items for fallback)
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
    } catch (e) {
      const msg = e?.raw?.message || e?.message || "stripe_session_retrieve_failed";
      return res.status(400).json({ ok: false, error: "stripe_error", detail: msg });
    }

    if (session?.payment_status !== "paid") {
      return res.status(200).json({ ok: false, paid: false, error: "not_paid_yet" });
    }

    const meta = session?.metadata || {};
    const email = safeEmail(meta.user_email || session?.customer_details?.email || session?.customer_email);
    const pack = String(meta.pack || "").trim();

    if (!email) {
      return res.status(400).json({ ok: false, error: "email_missing_on_session" });
    }

    // creditsToAdd: prefer metadata.credits
    let creditsToAdd = Number(meta.credits || 0);

    // fallback from priceId if metadata missing
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      const li = session?.line_items?.data?.[0];
      const priceId = li?.price?.id || "";
      const fallback = PRICE_TO_CREDITS[priceId];
      if (fallback) creditsToAdd = Number(fallback);
    }

    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return res.status(400).json({
        ok: false,
        error: "credits_missing_on_session",
        hint: "Checkout session metadata must include credits OR PRICE_TO_CREDITS must map the priceId.",
      });
    }

    // Idempotency
    const processedKey = `stripe_processed:${sessionId}`;
    const now = Date.now();
    const first = await setIdempotent(redis, processedKey, String(now), 60 * 60 * 24 * 14); // 14 gün

    if (!first) {
      // already processed -> just read current credits
      const raw = await redis.get(`credits:${email}`);
      const current = Number(raw || 0) || 0;
      return res.status(200).json({
        ok: true,
        already_processed: true,
        email,
        pack,
        added: 0,
        credits: current,
        session_id: sessionId,
      });
    }

    // Increment credits
    let newCredits;
    try {
      newCredits = await redis.incrby(`credits:${email}`, creditsToAdd);
    } catch (e) {
      // WRONGTYPE / any redis type issue
      return res.status(500).json({
        ok: false,
        error: "credits_key_error",
        detail: String(e?.message || e),
        hint: `DEL credits:${email} (key must be numeric string)`,
      });
    }

    const creditsNum = Number(newCredits || 0) || 0;

    // Invoice append as JSON array (compat)
    const invoiceItem = {
      id: `AIVO-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`,
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

    const invKey = `invoices:${email}`;
    try {
      const raw = await redis.get(invKey);
      let list = [];
      if (raw) {
        try { list = JSON.parse(raw) || []; } catch { list = []; }
      }
      list.unshift(invoiceItem);
      await redis.set(invKey, JSON.stringify(list.slice(0, 200)));
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "invoices_key_error",
        detail: String(e?.message || e),
        hint: `DEL invoices:${email} (must be JSON string array for current invoices/get)`,
      });
    }

    return res.status(200).json({
      ok: true,
      already_processed: false,
      email,
      pack,
      added: creditsToAdd,
      credits: creditsNum,
      invoice: invoiceItem,
      session_id: sessionId,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
};
