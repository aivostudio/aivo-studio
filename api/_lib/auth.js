// api/_lib/auth.js
import jwt from "jsonwebtoken";
import { kv } from "@vercel/kv";
import { neon } from "@neondatabase/serverless";

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

/* ----------------------------- helpers ----------------------------- */

function parseCookies(req) {
  const out = {};

  // 1) Next/Vercel bazı ortamlarda req.cookies verir
  if (req?.cookies && typeof req.cookies === "object") {
    for (const [k, v] of Object.entries(req.cookies)) {
      if (typeof v === "string" && v) out[k] = v;
    }
  }

  // 2) Header cookie (object headers veya Headers instance)
  let header = "";
  if (req?.headers?.cookie) header = req.headers.cookie;
  if (!header && req?.headers?.["cookie"]) header = req.headers["cookie"];
  if (!header && typeof req?.headers?.get === "function") {
    header = req.headers.get("cookie") || "";
  }

  header = String(header || "");
  if (!header) return out;

  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  });

  return out;
}

function cleanToken(raw) {
  if (!raw) return null;
  let t = String(raw).trim();

  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, "").trim();
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

    // 1) KV session cookie (aivo_sess)
    const sid = cleanToken(cookies[COOKIE_KV]);

    if (sid) {
      // A) sid -> user_id mapping varsa direkt dön
      const mapped = await getUserIdBySid(sid);
      if (mapped) {
        return {
          user_id: String(mapped),
          email: null,
          session: "sid_db",
        };
      }

      // B) KV'den email resolve edebiliyorsak gerçek user'a bağla
      try {
        const sess = await kv.get(`sess:${sid}`);
        if (sess?.email) {
          const email = String(sess.email).toLowerCase();
          const user_id = await getOrCreateUserByEmail(email);
          if (user_id) await linkSid(sid, user_id);

          return {
            user_id: String(user_id),
            email,
            role: sess.role || "user",
            session: "kv_email",
          };
        }
      } catch {
        // KV down olsa bile devam
      }

      // C) Email yoksa deterministic anon email üret (users.email NOT NULL uyumlu)
      const anonEmail = `anon+${sid}@aivo.local`;
      const anonId = await getOrCreateUserByEmail(anonEmail);
      if (anonId) await linkSid(sid, anonId);

      return {
        user_id: String(anonId),
        email: anonEmail,
        role: "user",
        session: "sid_anon",
      };
    }

    // 2) Legacy JWT cookie (aivo_session)
    const token = cleanToken(cookies[COOKIE_JWT]);
    if (token && process.env.JWT_SECRET) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const email =
          payload?.email || payload?.sub || payload?.user?.email || null;

        if (email) {
          const e = String(email).toLowerCase();
          const user_id = await getOrCreateUserByEmail(e);
          return {
            user_id: String(user_id),
            email: e,
            role: payload?.role || "user",
            session: "jwt",
          };
        }
      } catch {
        // invalid jwt -> fallthrough
      }
    }

    return null;
  } catch (e) {
    console.error("requireAuth fatal:", e);
    return null;
  }
}
