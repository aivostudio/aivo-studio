// api/admin/credits-adjust.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const { email, delta, reason } = req.body || {};
    const user = String(email || "").trim().toLowerCase();
    const d = Number(delta || 0);
    const why = String(reason || "manual_adjust").trim();

    if (!user) return res.status(400).json({ ok: false, error: "email_required" });
    if (!Number.isFinite(d) || d === 0) return res.status(400).json({ ok: false, error: "delta_invalid" });

    const redis = getRedis();
    const key = `credits:${user}`;

    // atomic
    const credits = await redis.incrby(key, d);

    // audit (basit)
    const auditKey = `admin:audit:${user}`;
    const entry = JSON.stringify({ ts: Date.now(), delta: d, reason: why });
    await redis.lpush(auditKey, entry);
    await redis.ltrim(auditKey, 0, 199);

    return res.status(200).json({ ok: true, email: user, delta: d, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "credits_adjust_failed" });
  }
};
