// api/jobs/create.js
const crypto = require("crypto");
const { getRedis } = require("../_kv");

// Basit id üretimi
function newJobId() {
  return "job_" + crypto.randomBytes(12).toString("hex");
}

// 🔴 YENİ EK BLOK — SESSION'DAN EMAIL ALMA
async function getEmailFromSession(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const origin = `${proto}://${host}`;

    const r = await fetch(`${origin}/api/auth/me`, {
      method: "GET",
      headers: {
        cookie: req.headers.cookie || "", // KRİTİK: session cookie forward
      },
    });

    if (!r.ok) return null;

    const me = await r.json().catch(() => ({}));
    const email = (me?.email || me?.user?.email || "").trim().toLowerCase();
    return email || null;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const body = req.body || {};

    // 🔹 1) Önce body’den email dene
    let email = String(body.email || "").trim().toLowerCase();

    // 🔹 2) Body boşsa session’dan al
    if (!email) {
      email = await getEmailFromSession(req);
    }

    const type = String(body.type || "").trim();
    const params = body.params || {};

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!type) return res.status(400).json({ ok: false, error: "type_required" });

    // ✅ İzinli tipler (genişletildi)
    const allowed = new Set(["hook", "socialpack", "music", "video", "cover"]);
    if (!allowed.has(type)) return res.status(400).json({ ok: false, error: "type_invalid" });

    // (Opsiyonel) idempotency
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

    // ✅ Kullanıcı job listesi (son 50) — JSON.parse crash FIX
    const listKey = `user:${email}:jobs`;
    const raw = await redis.get(listKey);

    let arr = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        // eski/string data varsa sıfırla
        arr = [];
      }
    }

    arr.unshift(job_id);
    if (arr.length > 50) arr.length = 50;
    await redis.set(listKey, JSON.stringify(arr));

    if (idemKey) {
      const idemRedisKey = `idem:${email}:${type}:${idemKey}`;
      await redis.set(idemRedisKey, job_id);
      // istersen TTL:
      // await redis.expire(idemRedisKey, 86400);
    }

    return res.status(200).json({ ok: true, job_id });
  } catch (err) {
    console.error("jobs/create error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
