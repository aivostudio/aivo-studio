const { getRedis } = require("../_kv");

const REASON = "music_generate";

function computeCost(body) {
  const mode = String(body?.mode || "instrumental");
  const duration = Number(body?.duration_sec || 30);
  const quality = String(body?.quality || "standard");

  let cost = 5;
  if (duration > 30 && duration <= 60) cost += 3;
  else if (duration > 60) cost += 6;
  if (mode === "vocal") cost += 7;
  if (quality === "pro") cost += 5;

  return Math.max(cost, 1);
}

const LUA = `
local creditsKey = KEYS[1]
local idemKey    = KEYS[2]
local jobKey     = KEYS[3]
local logKey     = KEYS[4]

local cost    = tonumber(ARGV[1])
local now     = ARGV[2]
local reason  = ARGV[3]
local job_id  = ARGV[4]
local payload = ARGV[5]
local idemTTL = tonumber(ARGV[6])
local jobTTL  = tonumber(ARGV[7])

local cached = redis.call("GET", idemKey)
if cached then
  return cached
end

local bal = tonumber(redis.call("GET", creditsKey) or "0")
if bal < cost then
  local r = cjson.encode({ ok=false, error="insufficient_credits", credits=bal })
  redis.call("SET", idemKey, r, "EX", idemTTL)
  return r
end

bal = bal - cost
redis.call("SET", creditsKey, tostring(bal))

redis.call("SET", jobKey, cjson.encode({
  ok=true,
  job_id=job_id,
  status="queued",
  reason=reason,
  cost=cost,
  created_at=now,
  payload=payload
}), "EX", jobTTL)

redis.call("LPUSH", logKey, cjson.encode({
  ts=now,
  job_id=job_id,
  reason=reason,
  cost=cost,
  credits_after=bal
}))

local resp = cjson.encode({ ok=true, job_id=job_id, credits=bal, status="queued" })
redis.call("SET", idemKey, resp, "EX", idemTTL)
return resp
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
    if (!job_id || job_id.length < 8) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    const payload = JSON.stringify({
      prompt: String(body.prompt || "").slice(0, 2000),
      mode: String(body.mode || "instrumental"),
      duration_sec: Number(body.duration_sec || 30),
      quality: String(body.quality || "standard")
    });

    const cost = computeCost(body);
    const now = new Date().toISOString();

    const userKey = email;
    const creditsKey = `credits:${userKey}`;
    const idemKey = `idem:music:${userKey}:${job_id}`;
    const jobKey = `job:${userKey}:${job_id}`;
    const logKey = `consume_log:${userKey}`;

    const out = await redis.eval(
      LUA,
      [creditsKey, idemKey, jobKey, logKey],
      [
        String(cost),
        now,
        REASON,
        job_id,
        payload,
        String(60 * 60 * 24 * 7),
        String(60 * 60 * 24 * 14)
      ]
    );

    return res.status(200).json(JSON.parse(out));
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err)
    });
  }
};
