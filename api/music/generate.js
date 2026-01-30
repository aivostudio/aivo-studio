// /api/music/generate.js
const { getRedis } = require("../_kv");

// === COST ===
function computeCost(body) {
  const mode = String(body?.mode || "instrumental");
  const duration = Number(body?.duration_sec || 30);
  const quality = String(body?.quality || "standard");

  let cost = 5;
  if (duration > 30 && duration <= 60) cost += 3;
  else if (duration > 60) cost += 6;
  if (mode === "vocal") cost += 7;
  if (quality === "pro") cost += 5;
  return Math.max(1, cost);
}

// === LUA ===
const LUA = `
local creditsKey = KEYS[1]
local idemKey    = KEYS[2]
local jobKey     = KEYS[3]
local logKey     = KEYS[4]

local cost   = tonumber(ARGV[1])
local now    = ARGV[2]
local reason = ARGV[3]
local job_id = ARGV[4]
local payload_json = ARGV[5]
local idemTTL = tonumber(ARGV[6])
local jobTTL  = tonumber(ARGV[7])

local existing = redis.call("GET", idemKey)
if existing then
  return {1, existing}
end

local bal = tonumber(redis.call("GET", creditsKey) or "0")
if bal < cost then
  local r = cjson.encode({ ok=false, error="insufficient_credits", credits=bal })
  redis.call("SET", idemKey, r, "EX", idemTTL)
  return {0, r}
end

local newBal = bal - cost
redis.call("SET", creditsKey, tostring(newBal))

redis.call("SET", jobKey, payload_json, "EX", jobTTL)

local log = cjson.encode({ ts=now, job_id=job_id, cost=cost, credits_after=newBal })
redis.call("LPUSH", logKey, log)
redis.call("LTRIM", logKey, 0, 999)

local resp = cjson.encode({ ok=true, job_id=job_id, credits=newBal, status="queued" })
redis.call("SET", idemKey, resp, "EX", idemTTL)

return {1, resp}
`;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const job_id = String(body.job_id || "").trim();

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    const cost = computeCost(body);

    const payload = {
      email,
      job_id,
      prompt: String(body.prompt || ""),
      mode: String(body.mode || "instrumental"),
      duration_sec: Number(body.duration_sec || 30),
      quality: String(body.quality || "standard"),
      created_at: new Date().toISOString()
    };

    const redis = getRedis();

    const out = await redis.eval(LUA, {
      keys: [
        `credits:${email}`,
        `idem:music:${email}:${job_id}`,
        `job:${email}:${job_id}`,
        `consume_log:${email}`
      ],
      arguments: [
        String(cost),
        payload.created_at,
        "music_generate",
        job_id,
        JSON.stringify(payload), // 🔴 STRING GARANTİ
        "604800",
        "1209600"
      ]
    });

    const resp = JSON.parse(out[1] || "{}");
    return res.status(200).json(resp);

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err)
    });
  }
};
