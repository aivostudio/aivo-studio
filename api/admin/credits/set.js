// api/admin/credits/set.js
const { getRedis } = require("../../_kv");

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isEmailLike(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("@") && s.includes(".");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { admin, admin_email, email, delta, reason } = req.body || {};

    const who = String(admin || admin_email || "").trim().toLowerCase();
    if (!who) return res.status(401).json({ ok: false, error: "admin_required" });

    if (ADMIN_EMAILS.length && !ADMIN_EMAILS.includes(who)) {
      return res.status(403).json({ ok: false, error: "admin_not_allowed" });
    }

    const user = String(email || "").trim().toLowerCase();
    const d = Number(delta || 0);
    const why = String(reason || "manual_adjust").trim();

    if (!user) return res.status(400).json({ ok: false, error: "email_required" });
    if (!isEmailLike(user)) return res.status(400).json({ ok: false, error: "email_invalid" });
    if (!Number.isFinite(d) || d === 0) return res.status(400).json({ ok: false, error: "delta_invalid" });

    const redis = getRedis();
    const key = `credits:${user}`;

    // atomic adjust
    const creditsAfter = await redis.incrby(key, d);

    // negatif kredi istemiyorsan: negatifse geri al ve hata dön
    if (creditsAfter < 0) {
      await redis.incrby(key, -d); // revert
      return res.status(400).json({ ok: false, error: "credits_cannot_be_negative" });
    }

    // audit
    const auditKey = `admin:audit:${user}`;
    const entry = JSON.stringify({ ts: Date.now(), admin: who, delta: d, reason: why, credits: creditsAfter });
    await redis.lpush(auditKey, entry);
    await redis.ltrim(auditKey, 0, 199);

    return res.status(200).json({ ok: true, email: user, delta: d, credits: creditsAfter });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "credits_set_failed" });
  }
};
