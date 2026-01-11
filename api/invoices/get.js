// /api/invoices/get.js
const { getRedis } = require("../_kv");

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const email = normEmail(req.query?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const redis = getRedis();

    const listKey = `invoices:${email}`;
    const raw = (await redis.get(listKey)) || "[]";

    let items = [];
    try { items = JSON.parse(raw) || []; } catch (_) { items = []; }

    // en yeni üstte kalsın
    items.sort((a, b) => String(b?.ts || "").localeCompare(String(a?.ts || "")));

    return res.json({ ok: true, email, items });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
