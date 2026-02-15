// api/jobs/create.js
const { Pool } = require("pg");
const { getRedis } = require("../_kv");

// Postgres bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Session'dan email alma
async function getEmailFromSession(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const origin = `${proto}://${host}`;

    const r = await fetch(`${origin}/api/auth/me`, {
      method: "GET",
      headers: {
        cookie: req.headers.cookie || "",
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
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const client = await pool.connect();

  try {
    const body = req.body || {};
    const redis = getRedis();

    // 1) email
    let email = String(body.email || "").trim().toLowerCase();
    if (!email) email = await getEmailFromSession(req);
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    // 2) type/app (biz bunu DB'de "tip" olarak yazacağız)
    const app = String(body.type || "").trim();

    const allowed = new Set(["hook", "social", "music", "video", "cover", "atmo"]);
    if (!allowed.has(app)) {
      return res.status(400).json({ ok: false, error: "type_invalid" });
    }

    // 3) provider (DB kolonunda yoksa meta içine koyacağız)
    const provider = String(body.provider || "unknown").trim();

    // 4) prompt + params/meta
    const prompt = body.prompt ? String(body.prompt) : null;
    const params = body.params || {};
    const meta = { ...(params || {}), provider, prompt };

    // 5) idempotency (Redis ile)
    const idemKey = String(req.headers["x-idempotency-key"] || "").trim();
    if (idemKey) {
      const idemRedisKey = `idem:${email}:${app}:${idemKey}`;
      const existing = await redis.get(idemRedisKey);
      if (existing) {
        return res.status(200).json({ ok: true, job_id: existing, reused: true });
      }
    }

    // 6) Kullanıcı UUID resolve (email -> kullanicilar.ID)
    // NOT: users tablosunda email kolonu "email" varsayımıyla.
    // Eğer sende farklı isimse (örn. "E-posta"), burada düzeltiriz.
    const u = await client.query(
      `SELECT "ID" AS id FROM kullanicilar WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );

    if (!u.rows || !u.rows.length) {
      return res.status(400).json({ ok: false, error: "user_not_found" });
    }

    const userId = u.rows[0].id;

    // 7) DB INSERT (Türkçe kolon isimleriyle)
    // - "durum" alanını hiç yazmıyoruz -> DB default'u ('sıraya alınmış'::iş_durumu) devreye girer
    // - provider/prompt kolonları olmadığı için meta içine koyduk
    const q = `
      INSERT INTO jobs
        ("Kullanıcı kimliği", "tip", "uygulama", "meta")
      VALUES
        ($1, $2, $3, $4)
      RETURNING "ID"
    `;

    const { rows } = await client.query(q, [
      userId, // uuid
      app,    // tip
      app,    // uygulama (şimdilik aynı)
      meta,   // jsonb
    ]);

    const job_id = rows[0]?.ID;

    if (!job_id) {
      return res.status(500).json({ ok: false, error: "insert_failed" });
    }

    // 8) idem kaydet
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
