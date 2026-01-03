// api/credits/consume.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const { email, cost, reason } = req.body || {};

    const user = String(email || "").trim().toLowerCase();
    const c = Number(cost || 0);

    if (!user) return res.status(400).json({ ok: false, error: "email_required" });
    if (!Number.isFinite(c) || c <= 0) return res.status(400).json({ ok: false, error: "cost_invalid" });

    const key = `credits:${user}`;

    const curRaw = await redis.get(key);
    const cur = Number(curRaw || 0);

    if (!Number.isFinite(cur)) {
      return res.status(500).json({ ok: false, error: "credits_corrupt" });
    }

    if (cur < c) {
      return res.status(200).json({ ok: false, error: "insufficient_credits", credits: cur });
    }

    const next = cur - c;
    await redis.set(key, String(next));

    return res.status(200).json({
      ok: true,
      credits: next,
      spent: c,
      reason: String(reason || "")
    });
  } catch (e) {
    console.error("credits/consume error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
