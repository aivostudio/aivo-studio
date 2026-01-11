// /api/purchases/create.js
const { getRedis } = require("../_kv");

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      email,
      order_id,
      provider = "manual",
      status = "paid",
      pack = "unknown",
      credits = 0,
      amount_total = 0,
      currency = "try",
      session_id = "",
    } = req.body || {};

    const user = normEmail(email);
    const oid = String(order_id || "").trim();
    if (!user) return res.status(400).json({ ok: false, error: "email_required" });
    if (!oid) return res.status(400).json({ ok: false, error: "order_id_required" });

    const redis = getRedis();
    const TTL = 90 * 24 * 60 * 60;

    // idempotency: aynı order 2 kez yazılmasın
    const onceKey = `purchase:${user}:${oid}`;
    const first = await redis.set(onceKey, "1", { nx: true, ex: TTL });

    if (!first) {
      return res.json({ ok: true, already_exists: true });
    }

    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      provider: String(provider),
      status: String(status),
      email: user,
      order_id: oid,
      session_id: String(session_id),
      pack: String(pack),
      credits: safeNum(credits),
      amount_total: safeNum(amount_total),
      currency: String(currency || "try").toLowerCase(),
      ts: new Date().toISOString(),
    };

    // invoices list
    const listKey = `invoices:${user}`;
    const raw = (await redis.get(listKey)) || "[]";
    let items = [];
    try { items = JSON.parse(raw) || []; } catch (_) { items = []; }
    items.unshift(invoice);
    if (items.length > 200) items = items.slice(0, 200);
    await redis.set(listKey, JSON.stringify(items));

    return res.json({ ok: true, invoice });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
