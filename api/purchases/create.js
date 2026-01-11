// /api/purchases/create.js
const { getRedis } = require("../_kv");

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    const b = req.body || {};
    const email = normEmail(b.email || b.user_email);
    const order_id = String(b.order_id || "").trim();

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!order_id) return res.status(400).json({ ok: false, error: "order_id_required" });

    // Idempotency (aynı order tekrar yazılmasın)
    const orderKey = `orders:applied:${order_id}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 gün
    const first = await redis.set(orderKey, "1", { nx: true, ex: ORDER_TTL_SECONDS });

    if (!first) {
      // zaten yazılmış
      return res.json({ ok: true, already_exists: true, order_id });
    }

    const item = {
      id: `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      created_at: nowIso(),

      // kim
      email,

      // ödeme
      provider: String(b.provider || b.source || "stripe"),
      status: String(b.status || "paid"),
      currency: String(b.currency || "try").toLowerCase(),

      // paket
      pack: String(b.pack || ""),
      credits: safeNumber(b.credits || b.amount || 0),

      // referanslar
      order_id,
      session_id: String(b.session_id || ""),
      amount_total: safeNumber(b.amount_total || 0),
    };

    // Listeye ekle (en yeni başa)
    const listKey = `invoices:${email}`;
    await redis.lpush(listKey, JSON.stringify(item));
    await redis.ltrim(listKey, 0, 200); // son 200 fatura yeter
    await redis.expire(listKey, ORDER_TTL_SECONDS);

    return res.json({ ok: true, saved: true, invoice: item });
  } catch (e) {
    console.error("purchases/create error:", e);
    return res.status(500).json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
};
