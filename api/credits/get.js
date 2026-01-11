// api/credits/get.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    // query: /api/credits/get?email=...
    const email = String(req.query?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const raw = await redis.get(`credits:${email}`);
    const credits = Number(raw) || 0;

    return res.json({ ok: true, email, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
