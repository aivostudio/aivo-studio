// /api/credits/get.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    const email = String(req.query?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const key1 = `credits:${email}`;
    const key2 = `credits_v2:${email}`;

    let raw = null;

    // 1) v1 dene
    try {
      raw = await redis.get(key1);
    } catch (e) {
      // WRONGTYPE vb. durumlarda v2 dene
      raw = null;
    }

    // 2) v2 fallback
    if (raw == null) {
      try {
        raw = await redis.get(key2);
      } catch (e) {
        raw = null;
      }
    }

    const credits = Number(raw) || 0;
    return res.json({ ok: true, email, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
