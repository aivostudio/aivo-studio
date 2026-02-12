// api/jobs/create.js
const { Pool } = require("pg");
const { getRedis } = require("../_kv");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🔴 SESSION'DAN EMAIL ALMA (aynı bırakıyoruz)
async function getEmailFromSession(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const origin = `${proto}://${host}`;

    const r = await fetch(`${origin}/api/auth/me`, {
      method: "GET",
      headers: { cookie: req.headers.cookie || "" },
    });

    if (!r.ok) return null;
    const me = await r.json().catch(() => ({}));
    return (me?.email || me?.user?.email || "").trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const client = await pool.connect();
  try {
    const body = req.body || {};
    const redis = getRedis();

    // 1️⃣ email
    let email = String(body.email || "").trim().toLowerCase();
    if (!email) email = await getEmailFromSession(req);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    // 2️⃣ app/type
    const app = String(body.type || "").trim();
    const allowed = new Set(["music", "video", "cover", "atmo", "social", "hook"]);
    if (!allowed.has(app)) {
      return res.status(400).json({ ok: false, error: "type_invalid" });
    }

    // 3️⃣ provider + payload
    const provider = String(body.provider || "unknown");
    const prompt = body.prompt || null;
    const meta = body.params || {};

    // 4️⃣ idempotency (opsiyonel, Redis)
    const idemKey = String(req.headers["x-idempotency-key"] || "").trim();
    if (idemKey) {
      const idemRedisKey = `idem:${email}:${app}:${idemKey}`;
      const existing = await redis.get(idemRedisKey);
      if (existing) {
        return res.status(200).json({ ok: true, job_id: existing, reused: true });
      }
    }

    // 5️⃣ DB INSERT
    const q = `
      INSERT INTO jobs
        (user_id, app, provider, status, prompt, meta)
      VALUES
        ($1, $2, $3, 'queued', $4, $5)
      RETURNING id
    `;

    const { rows } = await client.query(q, [
      email,
      app,
      provider,
      prompt,
      meta,
    ]);

    const job_id = rows[0].id;

    // 6️⃣ idempotency key kaydet
    if (idemKey) {
      const idemRedisKey = `idem:${email}:${app}:${idemKey}`;
      await redis.set(idemRedisKey, job_id);
    }

    return res.status(200).json({ ok: true, job_id });
  } catch (err) {
    console.error("jobs/create error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    client.release();
  }
};
