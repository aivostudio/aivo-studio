// api/credits/consume.js
const { getRedis } = require("../_kv");

/**
 * Body:
 * {
 *   email?: string,        // opsiyonel (auth varsa gerekmez)
 *   amount: number,        // düşülecek kredi (pozitif sayı)
 *   ref: string,           // UNIQUE jobId (idempotency key)
 *   reason?: string        // örn: "music.generate"
 * }
 */
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { amount, ref, reason, email } = req.body || {};

    // 1) Auth / session'dan user (varsa)
    const userFromSession =
      req.user?.email ||
      req.session?.user?.email ||
      null;

    const user =
      (userFromSession || email || "").toString().trim().toLowerCase();

    if (!user) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const cost = Number(amount);
    if (!Number.isFinite(cost) || cost <= 0) {
      return res.status(400).json({ ok: false, error: "amount_invalid" });
    }

    if (!ref || typeof ref !== "string") {
      return res.status(400).json({ ok: false, error: "ref_required" });
    }

    const redis = getRedis();

    const balanceKey = `credits:${user}`;
    const lockKey = `credits:consume:${user}:${ref}`; // idempotency

    /**
     * 2) Idempotency check
     * Aynı ref (jobId) daha önce işlendi mi?
     */
    const already = await redis.get(lockKey);
    if (already) {
      return res.status(200).json({
        ok: true,
        duplicated: true,
        credits: Number(await redis.get(balanceKey)) || 0
      });
    }

    /**
     * 3) Atomik kredi düşme
     */
    const creditsAfter = await redis.incrby(balanceKey, -cost);

    if (creditsAfter < 0) {
      // geri al
      await redis.incrby(balanceKey, cost);
      return res.status(402).json({
        ok: false,
        error: "insufficient_credits"
      });
    }

    /**
     * 4) Idempotency lock yaz
     * (aynı job tekrar gelirse tekrar düşmesin)
     */
    await redis.set(lockKey, "1", { ex: 60 * 60 * 24 }); // 24 saat

    /**
     * 5) Ledger / audit
     */
    const ledgerKey = `credits:ledger:${user}`;
    const entry = JSON.stringify({
      ts: Date.now(),
      ref,
      delta: -cost,
      reason: reason || "consume",
      credits: creditsAfter
    });

    await redis.lpush(ledgerKey, entry);
    await redis.ltrim(ledgerKey, 0, 199);

    return res.status(200).json({
      ok: true,
      credits: creditsAfter
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "credits_consume_failed" });
  }
};
