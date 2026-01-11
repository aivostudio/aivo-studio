// /api/invoices/get.js
const { getRedis } = require("../_kv");

function safeEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return "";
  return e;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const email = safeEmail(req.query?.email);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const k1 = `invoices:${email}`;
    const k2 = `invoices_v2:${email}`;

    let raw = null;
    try {
      raw = await redis.get(k1);
    } catch (_) {
      raw = null;
    }
    if (!raw) {
      try {
        raw = await redis.get(k2);
      } catch (_) {
        raw = null;
      }
    }

    if (!raw) return res.json({ ok: true, email, invoices: [] });

    let invoices = [];
    try { invoices = JSON.parse(raw) || []; } catch { invoices = []; }

    return res.json({ ok: true, email, invoices });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
