// api/admin/credits/get.js
const { getRedis } = require("../../_kv");

// Basit allowlist (ENV'den de okuyabiliriz)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    // admin kim? (admin panel localStorage email'i server'a gönderiyor)
    const admin = String(req.query.admin || req.query.admin_email || req.query.who || "").trim().toLowerCase();
    if (!admin) return res.status(401).json({ ok: false, error: "admin_required" });

    if (ADMIN_EMAILS.length && !ADMIN_EMAILS.includes(admin)) {
      return res.status(403).json({ ok: false, error: "admin_not_allowed" });
    }

    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const redis = getRedis();
    const key = `credits:${email}`;
    const credits = Number((await redis.get(key)) || 0);

    return res.status(200).json({ ok: true, email, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "credits_get_failed" });
  }
};
