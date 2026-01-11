// api/credits/add.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const { email, amount, order_id } = req.body || {};

    const user = String(email || "").trim().toLowerCase();
    const inc = Number(amount || 0);
    const oid = String(order_id || "").trim();

    if (!user) return res.status(400).json({ ok: false, error: "email_required" });
    if (!oid) return res.status(400).json({ ok: false, error: "order_id_required" });
    if (!Number.isFinite(inc) || inc <= 0) {
      return res.status(400).json({ ok: false, error: "amount_invalid" });
    }

    // idempotency: aynı order iki kez işlenmesin (TTL + NX)
    const orderKey = `orders:applied:${oid}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 gün

    // ✅ Tek komut: ilk kez mi + TTL
    const firstTime = await redis.set(orderKey, "1", {
      nx: true,
      ex: ORDER_TTL_SECONDS
    });

    if (!firstTime) {
      const current = (await redis.get(`credits:${user}`)) ?? 0;
      return res.json({
        ok: true,
        already_applied: true,
        credits: Number(current) || 0
      });
    }

    // kredi arttır (atomic)
    const newCredits = await redis.incrby(`credits:${user}`, inc);

    return res.json({
      ok: true,
      already_applied: false,
      credits: Number(newCredits) || 0
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
