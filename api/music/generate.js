// /api/music/generate.js
const { getRedis } = require("../_kv");

// ===== CONFIG =====
const REASON = "music_generate";
const IDEM_TTL = 60 * 60 * 24 * 7;   // 7 gün
const JOB_TTL  = 60 * 60 * 24 * 14;  // 14 gün

// ===== COST =====
function computeCost(body) {
  const mode = String(body.mode || "instrumental");
  const duration = Number(body.duration_sec || 30);
  let cost = 5;
  if (duration > 30 && duration <= 60) cost += 3;
  else if (duration > 60) cost += 6;
  if (mode === "vocal") cost += 7;
  return cost;
}

// ===== HANDLER =====
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const body = req.body || {};

    // ---- email ----
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    // ---- job_id ----
    const job_id = String(body.job_id || "").trim();
    if (!job_id || job_id.length < 8) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    const cost = computeCost(body);
    const now = new Date().toISOString();

    const userKey = email;
    const creditsKey = `credits:${userKey}`;
    const idemKey = `idem:music:${userKey}:${job_id}`;
    const jobKey = `job:${userKey}:${job_id}`;
    const logKey = `consume_log:${userKey}`;

    // ---- idempotency ----
    const cached = await redis.get(idemKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // ---- credits ----
    const balRaw = await redis.get(creditsKey);
    const balance = Number(balRaw || 0);

    if (balance < cost) {
      const resp = {
        ok: false,
        error: "insufficient_credits",
        credits: balance,
        job_id
      };
      await redis.set(idemKey, JSON.stringify(resp), { ex: IDEM_TTL });
      return res.status(200).json(resp);
    }

    // ---- decrement ----
    const newBal = balance - cost;
    await redis.set(creditsKey, String(newBal));

    // ---- job payload ----
    const payload = {
      prompt: String(body.prompt || "").slice(0, 2000),
      mode: String(body.mode || "instrumental"),
      duration_sec: Number(body.duration_sec || 30)
    };

    const job = {
      ok: true,
      job_id,
      status: "queued",
      reason: REASON,
      cost,
      created_at: now,
      payload
    };

    await redis.set(jobKey, JSON.stringify(job), { ex: JOB_TTL });

    await redis.lpush(
      logKey,
      JSON.stringify({
        ts: now,
        job_id,
        reason: REASON,
        cost,
        credits_after: newBal
      })
    );

    const resp = {
      ok: true,
      job_id,
      credits: newBal,
      status: "queued"
    };

    await redis.set(idemKey, JSON.stringify(resp), { ex: IDEM_TTL });

    return res.status(200).json(resp);

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err)
    });
  }
};
