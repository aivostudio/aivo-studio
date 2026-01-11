// /api/invoices/get.js
const { getRedis } = require("./_kv"); // DİKKAT: /api altında olduğu için yol böyle OLABİLİR
// Eğer import hatası olursa şunu kullan:
// const { getRedis } = require("../_kv");
// Dosya konumuna göre 1 tanesi doğru olacak.

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    const email = normEmail(req.query?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const listKey = `purchases:${email}`;
    const rawList = (await redis.get(listKey)) || "[]";

    let items = [];
    try { items = JSON.parse(rawList) || []; } catch (_) { items = []; }

    // UI kolaylığı: “invoice” alanları standardize
    const invoices = items.map((x) => ({
      id: x.id,
      order_id: x.order_id,
      provider: x.provider,
      pack: x.pack,
      credits: x.credits,
      amount_try: x.amount_try,
      currency: x.currency || "TRY",
      payment_status: x.payment_status || "paid",
      created_at: x.created_at,
      session_id: x.session_id || null
    }));

    return res.json({ ok: true, email, invoices, count: invoices.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
