// api/credits/get.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // 1) Auth / session'dan user
    const user =
      req.user ||
      req.session?.user ||
      null;

    // 2) Email fallback (query opsiyonel)
    const email =
      (user?.email || "").toLowerCase() ||
      String(req.query.email || "").trim().toLowerCase() ||
      "";

    // ❗ Email yoksa 400 DEĞİL, 401
    if (!email) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const redis = getRedis();
    const key = `credits:${email}`;
    const credits = Number((await redis.get(key)) || 0);

    return res.status(200).json({
      ok: true,
      credits
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "credits_get_failed" });
  }
};
