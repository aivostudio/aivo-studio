// api/admin/credits-get.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const redis = getRedis();
    const key = `credits:${email}`;
    const credits = Number(await redis.get(key) || 0);

    return res.status(200).json({ ok: true, email, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "credits_get_failed" });
  }
};
