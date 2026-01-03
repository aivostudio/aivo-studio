// api/music/generate.js
const { getRedis } = require("../_kv");
const crypto = require("crypto");

// Reason standardizasyonu (şimdilik music_generate)
const REASON = "music_generate";

// Basit cost örneği: mode + vocal + duration'a göre (SENİN MODELİNE GÖRE NETLEŞTİRİRİZ)
function computeCost(body) {
  const mode = String(body?.mode || "instrumental"); // instrumental | vocal
  const duration = Number(body?.duration_sec || 30); // 30, 60, 90...
  const quality = String(body?.quality || "standard"); // standard | pro

  let cost = 0;

  // temel
  cost += 5;

  // süre
  if (duration > 30 && duration <= 60) cost += 3;
  else if (duration > 60) cost += 6;

  // vocal ekstra
  if (mode === "vocal") cost += 7;

  // kalite
  if (quality === "pro") cost += 5;

  // güvenlik
  if (!Number.isFinite(cost) || cost < 1) cost = 5;
  return cost;
}

// Upstash Redis Lua: idempotency + credit check + decrement + job + log (atomik)
const LUA = `
-- KEYS:
-- 1 creditsKey
-- 2 idemKey
-- 3 jobKey
-- 4 logListKey
-- ARGV:
-- 1 cost
-- 2 now
-- 3 reason
-- 4 job_id
-- 5 payload_json
-- 6 idem_ttl_sec
-- 7 job_ttl_sec

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

-- If already processed, return stored response
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

-- Decrement credits
local newBal = bal - cost
redis.call("SET", creditsKey, tostring(newBal))

-- Create job record (queued)
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

-- Append log (for admin/invoice later)
local logObj = cjson.encode({
  ts=now,
  job_id=job_id,
  reason=reason,
  cost=cost,
  credits_after=newBal
})
redis.call("LPUSH", logListKey, logObj)
redis.call("LTRIM", logListKey, 0, 999)

-- Store idempotent success response
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

    // Auth/email: şu an sisteminizde email store’dan geliyor; burada minimum doğrulama yapıyoruz.
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    // job_id zorunlu: UI her generate tıklamasında üretir (uuid)
    const job_id = String(body.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });
    if (job_id.length < 8) return res.status(400).json({ ok: false, error: "job_id_invalid" });

    // Cost server-side hesaplanır (UI cost gönderebilir ama dikkate almıyoruz)
    const cost = computeCost(body);

    // payload (job için saklanacak parametreler)
    const payload = {
      prompt: String(body.prompt || "").slice(0, 2000),
      mode: String(body.mode || "instrumental"),
      duration_sec: Number(body.duration_sec || 30),
      quality: String(body.quality || "standard"),
      // opsiyonel: reference, bpm, genre vs sonradan eklersiniz
    };

    const now = new Date().toISOString();

    const userKey = email; // ileride userId ile değiştirilebilir
    const creditsKey = `credits:${userKey}`;
    const idemKey = `idem:music_generate:${userKey}:${job_id}`;
    const jobKey = `job:${userKey}:${job_id}`;
    const logListKey = `consume_log:${userKey}`;

    const idemTTL = 60 * 60 * 24 * 7; // 7 gün idempotency sakla
    const jobTTL = 60 * 60 * 24 * 14; // 14 gün job sakla

    // eval
    const payload_json = JSON.stringify(payload);

    // Upstash redis client'ınız eval destekliyor olmalı. Değilse pipeline alternatifini yazarım.
    const out = await redis.eval(LUA, {
      keys: [creditsKey, idemKey, jobKey, logListKey],
      arguments: [String(cost), now, REASON, job_id, payload_json, String(idemTTL), String(jobTTL)],
    });

    // out = [successFlag, jsonString]
    const successFlag = Number(out?.[0] ?? 0);
    const respStr = out?.[1] || "{}";
    const resp = JSON.parse(respStr);

    // Başarılıysa burada queue/worker tetikleyebilirsiniz (şimdilik job queued)
    // Örn: await redis.lpush("queue:music", JSON.stringify({ email, job_id }))

    if (successFlag === 1 && resp.ok) return res.status(200).json(resp);

    // insufficient_credits vb.
    return res.status(200).json(resp);
  } catch (err) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(err?.message || err) });
  }
};
