// /api/credits/add.js
const { getRedis } = require("../_kv");

function pickString(v) {
  return String(v ?? "").trim();
}

function normalizeEmail(v) {
  const s = pickString(v).toLowerCase();
  if (!s || !s.includes("@")) return "";
  return s;
}

function pickNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // Opsiyonel internal auth (şimdilik zorunlu değil)
    // verify-session server-to-server çağrısında bu header'ı gönderiyor.
    // Eğer env yoksa ya da header yoksa yine çalışır (backward compatible).
    const internalHeader = pickString(req.headers["x-aivo-internal"]);
    const internalKey = pickString(process.env.AIVO_INTERNAL_KEY);
    const internalOk = internalKey && internalHeader && internalHeader === internalKey;

    const redis = getRedis();

    const body = req.body || {};

    // ✅ Backward + forward compatible alanlar:
    // Eski:  { email, amount, order_id }
    // Yeni:  { user_email, credits, order_id, ... }
    const user =
      normalizeEmail(body.user_email) ||
      normalizeEmail(body.email) ||
      normalizeEmail(body.userEmail);

    // amount/credits: string de gelebilir
    const inc =
      pickNumber(body.credits) ||
      pickNumber(body.amount);

    const oid = pickString(body.order_id || body.orderId || body.oid);

    if (!user) {
      return res.status(400).json({
        ok: false,
        error: "email_required",
        hint: "Send {email, amount, order_id} OR {user_email, credits, order_id}",
      });
    }

    if (!oid) {
      return res.status(400).json({ ok: false, error: "order_id_required" });
    }

    if (!Number.isFinite(inc) || inc <= 0) {
      return res.status(400).json({
        ok: false,
        error: "amount_invalid",
        hint: "amount/credits must be a positive number",
      });
    }

    // idempotency: aynı order iki kez işlenmesin (TTL + NX)
    const orderKey = `orders:applied:${oid}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 gün

    // ✅ Tek komut: ilk kez mi + TTL
    const firstTime = await redis.set(orderKey, "1", {
      nx: true,
      ex: ORDER_TTL_SECONDS,
    });

    if (!firstTime) {
      const current = (await redis.get(`credits:${user}`)) ?? 0;
      return res.json({
        ok: true,
        already_applied: true,
        credits: Number(current) || 0,
        internal_ok: !!internalOk,
      });
    }

    // kredi arttır (atomic)
    const newCredits = await redis.incrby(`credits:${user}`, inc);

    return res.json({
      ok: true,
      already_applied: false,
      credits: Number(newCredits) || 0,
      internal_ok: !!internalOk,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
};
