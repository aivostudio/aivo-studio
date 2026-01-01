// api/jobs/create.js
const crypto = require("crypto");
const { getRedis } = require("../_kv");

// Basit id üretimi
function newJobId() {
  return "job_" + crypto.randomBytes(12).toString("hex");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const body = req.body || {};

    const email = String(body.email || "").trim().toLowerCase();
    const type = String(body.type || "").trim(); // "hook" | "socialpack"
    const params = body.params || {};

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!type) return res.status(400).json({ ok: false, error: "type_required" });

    // İzinli tipler
    const allowed = new Set(["hook", "socialpack"]);
    if (!allowed.has(type)) return res.status(400).json({ ok: false, error: "type_invalid" });

    // (Opsiyonel) idempotency: aynı request’i tekrar atarsa aynı job dönsün
    // Header: x-idempotency-key
    const idemKey = String(req.headers["x-idempotency-key"] || "").trim();
    if (idemKey) {
      const idemRedisKey = `idem:${email}:${type}:${idemKey}`;
      const existing = await redis.get(idemRedisKey);
      if (existing) return res.status(200).json({ ok: true, job_id: existing, reused: true });
    }

    const job_id = newJobId();
    const now = Math.floor(Date.now() / 1000);

    const job = {
      id: job_id,
      type,
      email,
      status: "queued",
      created_at: now,
      updated_at: now,
      params,
      result: null,
      error: null,
    };

    // Job kaydet
    await redis.set(`job:${job_id}`, JSON.stringify(job));

    // Kullanıcı job listesine ekle (son 50)
    const listKey = `user:${email}:jobs`;
    // Upstash Redis LIST komutları destekliyor. _kv wrapper'ında lpush/ltrim varsa kullan.
    // Yoksa fallback: JSON array tutarız.
    // Aşağıdaki yöntem "string array" şeklinde set.
    const raw = await redis.get(listKey);
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(job_id);
    if (arr.length > 50) arr.length = 50;
    await redis.set(listKey, JSON.stringify(arr));

    if (idemKey) {
      const idemRedisKey = `idem:${email}:${type}:${idemKey}`;
      await redis.set(idemRedisKey, job_id);
      // İstersen TTL koyabiliriz (örn 24h)
      // await redis.expire(idemRedisKey, 86400);
    }

    return res.status(200).json({ ok: true, job_id });
  } catch (err) {
    console.error("jobs/create error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
