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

    const redis = getRedis();

    const email = normEmail(req.query?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const listKey = `invoices:${email}`;

    // en yeni 200
    const rows = await redis.lrange(listKey, 0, 200);

    const items = [];
    for (const s of rows || []) {
      try { items.push(JSON.parse(s)); } catch (_) {}
    }

    return res.json({ ok: true, email, items });
  } catch (e) {
    console.error("invoices/get error:", e);
    return res.status(500).json({ ok: false, error: "server_error", message: e?.message || String(e) });
  }
};
