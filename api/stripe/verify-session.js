// /api/stripe/verify-session.js
const Stripe = require("stripe");
const { getRedis } = require("../_kv");

/**
 * Tek sözleşme:
 * - ONLY POST
 * - Content-Type: application/json
 * - Body: { session_id: "cs_..." }
 *
 * Tek kaynak / tek key:
 * - credits:<email>  (string numeric via INCRBY)
 * - invoices:<email> (Redis LIST via LPUSH/LTRIM)
 * - stripe_processed:<session_id> (idempotency)
 *
 * WRONGTYPE varsa "sessizce v2"ye kaçma yok:
 * - açık hata döner, Redis temizliği zorunludur.
 */

function safeEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return "";
  return e;
}

function parseMaybeJsonBody(req) {
  // Vercel/Node bazı durumlarda req.body string gelebilir.
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
  // Sözleşme: yalnız POST body’den alacağız
  const body = parseMaybeJsonBody(req);
  const sid = body.session_id || body.sessionId || "";
  return String(sid || "").trim();
}

async function setIdempotent(redis, key, value, ttlSeconds) {
  // Race-safe: mümkünse SET NX EX, yoksa SETNX + EXPIRE.
  // Upstash/Redis client türüne göre methodlar değişebilir, bu yüzden çoklu deniyoruz.

  // 1) redis.set(key, value, { nx: true, ex: ttl })
  try {
    if (typeof redis.set === "function") {
      // Bazı client’larda opsiyon objesi
      const r = await redis.set(key, value, { nx: true, ex: ttlSeconds });
      // Redis "OK" döndürebilir; Upstash true/false döndürebilir
      if (r === "OK" || r === true) return true;
      if (r === null || r === false) return false;
    }
  } catch (_) {}

  // 2) redis.set(key, value, "NX", "EX", ttl)
  try {
    if (typeof redis.set === "function") {
      const r = await redis.set(key, value, "NX", "EX", ttlSeconds);
      if (r === "OK") return true;
      if (r === null) return false;
    }
  } catch (_) {}

  // 3) redis.setnx + expire
  try {
    if (typeof redis.setnx === "function") {
      const ok = await redis.setnx(key, value); // 1/0
      if (ok === 1 || ok === true) {
        try {
          if (typeof redis.expire === "function") await redis.expire(key, ttlSeconds);
        } catch (_) {}
        return true;
      }
      return false;
    }
  } catch (_) {}

  // Eğer hiçbiri yoksa (çok nadir) fallback: önce GET, sonra SET (race-safe değil)
  const exists = await redis.get(key);
  if (exists) return false;
  await redis.set(key, value);
  return true;
}

module.exports = async (req, res) => {
  try {
    // 0) Method
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed", allowed: ["POST"] });
    }

    // 1) Env
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    // 2) Body / session_id
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    // Bazı fetch’lerde "application/json; charset=utf-8" gelir
    if (!ct.includes("application/json")) {
      return res.status(415).json({ ok: false, error: "content_type_must_be_json" });
    }

    const sessionId = pickSessionId(req);
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        ok: false,
        error: "session_id_required",
        hint: 'POST body JSON: {"session_id":"cs_..."}',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const redis = getRedis();

    // 3) Stripe retrieve (+ line_items expand)
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
    } catch (e) {
      const msg = e?.raw?.message || e?.message || "stripe_session_retrieve_failed";
      return res.status(400).json({ ok: false, error: "stripe_error", detail: msg });
    }

    // 4) Paid kontrolü
    const paid = session?.payment_status === "paid";
    if (!paid) {
      return res.status(200).json({ ok: false, paid: false, error: "not_paid_yet" });
    }

    // 5) Session metadata’dan email/credits al (tek kaynak)
    const meta = session?.metadata || {};
    const email = safeEmail(meta.user_email || session?.customer_details?.email || session?.customer_email);
    const pack = String(meta.pack || "").trim();
    const creditsToAdd = Number(meta.credits || 0);

    if (!email) {
      return res.status(400).json({ ok: false, error: "email_missing_on_session" });
    }
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return res.status(400).json({
        ok: false,
        error: "credits_missing_on_session",
        hint: "Checkout metadata must include credits (numeric > 0).",
      });
    }

    // 6) Idempotency (race-safe)
    const processedKey = `stripe_processed:${sessionId}`;
    const now = Date.now();

    // 7 gün yeterli; session tekrar gelirse yazma
    const firstTime = await setIdempotent(redis, processedKey, String(now), 60 * 60 * 24 * 7);

    if (!firstTime) {
      // already processed → current credits
      let current = 0;
      try {
        const raw = await redis.get(`credits:${email}`);
        current = Number(raw || 0);
        if (!Number.isFinite(current)) current = 0;
      } catch (e) {
        // WRONGTYPE dahil her şeyde açık hata veriyoruz (temizlik şart)
        return res.status(500).json({
          ok: false,
          error: "credits_key_unreadable",
          detail: String(e?.message || e),
          hint: `Check Redis key type: credits:${email} (should be string numeric). If WRONGTYPE -> DEL credits:${email}`,
        });
      }

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

    // 7) Credits INCRBY (tek key)
    let newCredits = 0;
    try {
      newCredits = Number(await redis.incrby(`credits:${email}`, creditsToAdd));
      if (!Number.isFinite(newCredits)) newCredits = 0;
    } catch (e) {
      // WRONGTYPE ise açık hata: temizlik şart
      return res.status(500).json({
        ok: false,
        error: "credits_key_wrongtype",
        detail: String(e?.message || e),
        hint: `DEL credits:${email} then retry verify-session (after confirming no other code writes non-string to this key).`,
      });
    }

    // 8) Invoice (Redis LIST) — tek format
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

    const invoicesKey = `invoices:${email}`;
    try {
      await redis.lpush(invoicesKey, JSON.stringify(invoiceItem));
      await redis.ltrim(invoicesKey, 0, 199); // son 200 kayıt
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "invoices_key_wrongtype",
        detail: String(e?.message || e),
        hint: `invoices:<email> must be a Redis LIST. If WRONGTYPE -> DEL ${invoicesKey} then retry.`,
      });
    }

    // 9) Response
    return res.status(200).json({
      ok: true,
      already_processed: false,
      email,
      pack,
      added: creditsToAdd,
      credits: newCredits,
      invoice: invoiceItem,
      session_id: sessionId,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
};
