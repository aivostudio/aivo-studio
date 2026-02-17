// /api/_lib/auth.js

const jwt = require("jsonwebtoken");
const { neon } = require("@neondatabase/serverless");

// KV wrapper (tek doğru kaynak)
const kvMod = require("../_kv.js");
const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function cleanToken(raw) {
  if (!raw) return null;
  let t = String(raw).trim();
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  if (t.startsWith("s:")) t = t.slice(2);
  return t || null;
}

function getDbConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    null
  );
}

async function getOrCreateUserIdByEmail(email) {
  if (!email) return null;

  const conn = getDbConn();
  if (!conn) return null;

  const sql = neon(conn);

  const rows = await sql`
    select id from users where email = ${email} limit 1
  `;

  if (rows?.[0]?.id) return rows[0].id;

  const inserted = await sql`
    insert into users (email, created_at)
    values (${email}, now())
    on conflict (email) do update set email = excluded.email
    returning id
  `;

  return inserted?.[0]?.id || null;
}

async function requireAuth(req) {
  const cookies = parseCookies(req);

  // ============================
  // 1) KV SESSION AUTH
  // ============================
  const sid = cleanToken(cookies[COOKIE_KV]);

  if (sid) {
    if (typeof kvGetJson !== "function") {
      // KV çalışmıyorsa auth kırmayalım, fallback dönelim
      return {
        user_id: sid,
        email: null,
        role: "user",
        session: "kv_missing",
      };
    }

    const sess = await kvGetJson(`sess:${sid}`).catch(() => null);

    if (sess && typeof sess === "object" && sess.email) {
      const email = String(sess.email);

      // user_id DB'den gerçek uuid olsun
      const user_id = await getOrCreateUserIdByEmail(email);

      return {
        user_id: user_id || email,
        email,
        role: sess.role || "user",
        session: "kv",
      };
    }

    // sid var ama KV'de sess yok
    return null;
  }

  // ============================
  // 2) JWT LEGACY AUTH
  // ============================
  const token = cleanToken(cookies[COOKIE_JWT]);
  const JWT_SECRET = process.env.JWT_SECRET;

  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);

      const email =
        payload?.email || payload?.sub || payload?.user?.email || null;

      if (email) {
        const user_id = await getOrCreateUserIdByEmail(email);

        return {
          user_id: user_id || email,
          email,
          role: payload?.role || "user",
          session: "jwt",
        };
      }
    } catch (_) {
      return null;
    }
  }

  return null;
}

module.exports = { requireAuth };
