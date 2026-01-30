// api/music/generate.js
const { getRedis } = require("../_kv");
const crypto = require("crypto");

// Reason standardizasyonu (şimdilik music_generate)
const REASON = "music_generate";

// Basit cost örneği
function computeCost(body) {
  const mode = String(body?.mode || "instrumental");
  const duration = Number(body?.duration_sec || 30);
  const quality = String(body?.quality || "standard");

  let cost = 5;

  if (duration > 30 && duration <= 60) cost += 3;
  else if (duration > 60) cost += 6;

  if (mode === "vocal") cost += 7;
  if (quality === "pro") cost += 5;

  if (!Number.isFinite(cost) || cost < 1) cost = 5;
  return cost;
}

// Upstash Redis Lua
const LUA = `
local creditsKey = KEYS[1]
local idemKey    = KEYS[2]
local jobKey     = KEYS[3]
local logListKey = KEYS[4]

local cost       = tonumber(ARGV[1])
local now        = ARGV[2]
local reason     = ARGV[3]
local job_id     = ARGV[4]
local payload    = ARGV[5]
local idemTTL    = tonumber(ARGV[6])
local jobTTL     = tonumber(ARGV[7])

local existing = redis.call("GET", idemKey)
if existing then
  return {1, existing}
end

local bal = redis.call("GET", creditsKey)
if not bal then bal = "0" end
bal = tonumber(bal)

if bal < cost then
  local resp = cjson.encode({ ok=false, error="insufficient_credits", credits=bal, job_id=job_id })
  redis.call("SET", idemKey, resp, "EX", idemTTL)
  return {0, resp}
end

local newBal = bal - cost
redis.call("SET", creditsKey, tostring(newBal))

local jobObj = cjson.encode({
  ok=true,
  job_id=job_id,
  status="queued",
  reason=reason,
  cost=cost,
  created_at=now,
  payload=payload
})
redis.call("SET", jobKey, jobObj, "EX", jobTTL)

local logObj = cjson.encode({
  ts=now,
  job_id=job_id,
  reason=reason,
  cost=cost,
  credits_after=newBal
})
redis.call("LPUSH", logListKey, logObj)
redis.call("LTRIM", logListKey, 0, 999)

local resp = cjson.encode({ ok=true, job_id=job_id, credits=newBal, status="queued" })
redis.call("SET", idemKey, resp, "EX", idemTTL)

return {1, resp}
`;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const body = req.body || {};

    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const job_id = String(body.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });
    if (job_id.length < 8) return res.status(400).json({ ok: false, error: "job_id_invalid" });

    const cost = computeCost(body);

    const payload = {
      prompt: String(body.prompt || "").slice(0, 2000),
      mode: String(body.mode || "instrumental"),
      duration_sec: Number(body.duration_sec || 30),
      quality: String(body.quality || "standard"),
    };

    const now = new Date().toISOString();

    const userKey = email;
    const creditsKey = `credits:${userKey}`;
    const idemKey = `idem:music_generate:${userKey}:${job_id}`;
    const jobKey = `job:${userKey}:${job_id}`;
    const logListKey = `consume_log:${userKey}`;

    const idemTTL = 60 * 60 * 24 * 7;
    const jobTTL = 60 * 60 * 24 * 14;

    const payload_json = JSON.stringify(payload);

    // ✅ UPSTASH SAFE EVAL (POSITIONAL)
    const out = await redis.eval(
      LUA,
      4,
      creditsKey,
      idemKey,
      jobKey,
      logListKey,
      String(cost),
      now,
      REASON,
      job_id,
      payload_json,
      String(idemTTL),
      String(jobTTL)
    );

    const successFlag = Number(out?.[0] ?? 0);
    const respStr = out?.[1] || "{}";
    const resp = JSON.parse(respStr);

    if (successFlag === 1 && resp.ok) {
      return res.status(200).json(resp);
    }

    return res.status(200).json(resp);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err),
    });
  }
};
