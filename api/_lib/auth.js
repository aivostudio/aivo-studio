// api/_lib/auth.js
import jwt from "jsonwebtoken";
import { kv } from "@vercel/kv";
import { neon } from "@neondatabase/serverless";

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

/* ---------------- helpers ---------------- */

function parseCookies(req) {
  const out = {};
  const header = String(req?.headers?.cookie || "");
  if (!header) return out;

  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function cleanToken(raw) {
  if (!raw) return null;
  let t = String(raw).trim();
  if (t.startsWith("s:")) t = t.slice(2);
  if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, "");
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

/* ---------------- DB helpers ---------------- */

async function getOrCreateUserByEmail(email) {
  const conn = getDbConn();
  if (!conn) return null;
  const sql = neon(conn);

  const existing = await sql`
    select id from users
    where lower(email) = lower(${email})
    limit 1
  `;
  if (existing?.[0]?.id) return existing[0].id;

  const inserted = await sql`
    insert into users (email, created_at)
    values (${email}, now())
    returning id
  `;
  return inserted?.[0]?.id || null;
}

async function getUserIdBySid(sid) {
  const conn = getDbConn();
  if (!conn) return null;
  const sql = neon(conn);

  const r = await sql`
    select user_id
    from user_sessions
    where sid = ${sid}
      and revoked_at is null
    limit 1
  `;
  return r?.[0]?.user_id || null;
}

async function linkSid(sid, user_id) {
  const conn = getDbConn();
  if (!conn) return;
  const sql = neon(conn);

  await sql`
    insert into user_sessions (sid, user_id, created_at, last_seen_at)
    values (${sid}, ${user_id}, now(), now())
    on conflict (sid)
    do update set
      user_id = excluded.user_id,
      last_seen_at = now(),
      revoked_at = null
  `;
}

/* ---------------- MAIN ---------------- */

export async function requireAuth(req) {
  try {
    const cookies = parseCookies(req);

    // 1️⃣ KV session
    const sid = cleanToken(cookies[COOKIE_KV]);

    if (sid) {
      // A) sid zaten DB'de varsa direkt resolve
      const mapped = await getUserIdBySid(sid);
      if (mapped) {
        return {
          user_id: String(mapped),
          email: null,
          session: "sid_db",
        };
      }

      // B) KV email varsa gerçek user’a bağla
      try {
        const sess = await kv.get(`sess:${sid}`);
        if (sess?.email) {
          const email = String(sess.email).toLowerCase();
          const user_id = await getOrCreateUserByEmail(email);
          if (user_id) await linkSid(sid, user_id);

          return {
            user_id: String(user_id),
            email,
            session: "kv_email",
          };
        }
      } catch {}

      // C) Email yok → anon deterministic email üret
      const anonEmail = `anon+${sid}@aivo.local`;
      const anonId = await getOrCreateUserByEmail(anonEmail);
      if (anonId) await linkSid(sid, anonId);

      return {
        user_id: String(anonId),
        email: anonEmail,
        session: "sid_anon",
      };
    }

    // 2️⃣ JWT legacy
    const token = cleanToken(cookies[COOKIE_JWT]);
    if (token && process.env.JWT_SECRET) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const email =
          payload?.email || payload?.sub || payload?.user?.email || null;

        if (email) {
          const user_id = await getOrCreateUserByEmail(
            String(email).toLowerCase()
          );
          return {
            user_id: String(user_id),
            email,
            session: "jwt",
          };
        }
      } catch {}
    }

    return null;
  } catch (e) {
    console.error("requireAuth fatal:", e);
    return null;
  }
}
