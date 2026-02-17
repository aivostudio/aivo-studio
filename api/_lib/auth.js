// /api/_lib/auth.js
const jwt = require("jsonwebtoken");
const { kv } = require("@vercel/kv");
const { neon } = require("@neondatabase/serverless");

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
  if (!conn) throw new Error("missing_db_env");

  const sql = neon(conn);

  const rows = await sql`
    select id from users where email = ${email} limit 1
  `;
  if (rows?.[0]?.id) return rows[0].id;

  const inserted = await sql`
    insert into users (email, created_at)
    values (${email}, now())
    returning id
  `;

  return inserted?.[0]?.id || null;
}

async function requireAuth(req) {
  const cookies = parseCookies(req);

  // ==========================
  // 1) KV SESSION FLOW
  // ==========================
  const sid = cleanToken(cookies[COOKIE_KV]);
  if (sid) {
    let sess = null;

    try {
      sess = await kv.get(`sess:${sid}`);
    } catch (e) {
      console.error("[auth] KV read error:", e);
      throw new Error("kv_not_available");
    }

    if (!sess || typeof sess !== "object") {
      throw new Error("invalid_session");
    }

    const email = sess.email ? String(sess.email) : null;
    if (!email) {
      throw new Error("missing_email");
    }

    const user_id = await getOrCreateUserIdByEmail(email);

    return {
      user_id,
      email,
      role: sess.role || "user",
      verified: typeof sess.verified === "boolean" ? sess.verified : true,
      session: "kv",
    };
  }

  // ==========================
  // 2) JWT LEGACY FLOW
  // ==========================
  const token = cleanToken(cookies[COOKIE_JWT]);
  const JWT_SECRET = process.env.JWT_SECRET;

  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);

      const email =
        payload?.email || payload?.sub || payload?.user?.email || null;

      if (!email) throw new Error("missing_email");

      const user_id = await getOrCreateUserIdByEmail(email);

      return {
        user_id,
        email,
        role: payload?.role || "user",
        verified:
          typeof payload?.verified === "boolean" ? payload.verified : true,
        session: "jwt",
      };
    } catch (e) {
      throw new Error("invalid_session");
    }
  }

  // ==========================
  // 3) NO SESSION
  // ==========================
  throw new Error("missing_session");
}

module.exports = { requireAuth };
