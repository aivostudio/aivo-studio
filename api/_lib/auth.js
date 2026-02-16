// api/_lib/auth.js
// Hybrid auth (prod-ready):
// 1) KV session cookie: aivo_sess  (preferred)
// 2) Legacy JWT cookie: aivo_session
//
// ✅ En sağlam iskelet:
// - Cookie (sid/token) -> DB mapping: user_sessions.sid -> users.id (uuid)
// - Böylece Safari/Chrome/device farkı bitiyor.
// - Email varsa users tablosuyla eşleştirip sid'i o user'a map ediyoruz.
// - Email yoksa bile anon user açıp sid'i map ediyoruz.
//
// ÖNKOŞUL (Neon):
//   create table if not exists user_sessions (
//     sid text primary key,
//     user_id uuid not null,
//     created_at timestamptz not null default now(),
//     last_seen_at timestamptz not null default now(),
//     revoked_at timestamptz null
//   );

import jwt from "jsonwebtoken";
import { kv } from "@vercel/kv";
import { neon } from "@neondatabase/serverless";

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

/* ----------------------------- helpers ----------------------------- */

function parseCookies(req) {
  const out = {};

  if (req?.cookies && typeof req.cookies === "object") {
    for (const [k, v] of Object.entries(req.cookies)) {
      if (typeof v === "string") out[k] = v;
    }
  }

  let header = "";
  if (req?.headers?.cookie) header = req.headers.cookie;
  if (!header && req?.headers?.["cookie"]) header = req.headers["cookie"];
  if (!header && req?.headers?.get) header = req.headers.get("cookie") || "";

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

async function getOrCreateUserIdByEmail(email) {
  if (!email) return null;

  const conn = getDbConn();
  if (!conn) return null;

  const sql = neon(conn);

  const rows = await sql`
    select id
    from users
    where email = ${email}
    limit 1
  `;
  if (rows?.[0]?.id) return rows[0].id;

  const inserted = await sql`
    insert into users (email, created_at)
    values (${email}, now())
    returning id
  `;

  return inserted?.[0]?.id || null;
}

async function getOrCreateAnonymousUserId() {
  const conn = getDbConn();
  if (!conn) return null;

  const sql = neon(conn);

  // users tablosunda email nullable değilse bu patlar.
  // Eğer email NOT NULL ise, söyle; ona göre anon mantığını değiştiririz.
  const inserted = await sql`
    insert into users (email, created_at)
    values (null, now())
    returning id
  `;

  return inserted?.[0]?.id || null;
}

async function getUserIdBySid(sid) {
  if (!sid) return null;

  const conn = getDbConn();
  if (!conn) return null;

  const sql = neon(conn);

  const rows = await sql`
    select user_id
    from user_sessions
    where sid = ${sid}
      and revoked_at is null
    limit 1
  `;

  return rows?.[0]?.user_id || null;
}

async function linkSidToUserId(sid, user_id) {
  if (!sid || !user_id) return null;

  const conn = getDbConn();
  if (!conn) return null;

  const sql = neon(conn);

  await sql`
    insert into user_sessions (sid, user_id, created_at, last_seen_at, revoked_at)
    values (${sid}, ${user_id}, now(), now(), null)
    on conflict (sid)
    do update set
      user_id = excluded.user_id,
      last_seen_at = now(),
      revoked_at = null
  `;

  return user_id;
}

async function touchSid(sid) {
  if (!sid) return;

  const conn = getDbConn();
  if (!conn) return;

  const sql = neon(conn);

  await sql`
    update user_sessions
    set last_seen_at = now()
    where sid = ${sid}
      and revoked_at is null
  `;
}

function normalizeRole(x) {
  const r = String(x || "").toLowerCase();
  if (!r) return "user";
  return r;
}

/* ----------------------------- main ----------------------------- */

export async function requireAuth(req) {
  try {
    const cookies = parseCookies(req);

    // ---------------------------------
    // 1) KV SESSION (aivo_sess)
    // ---------------------------------
    const sid = cleanToken(cookies[COOKIE_KV]);

    if (sid) {
      // A) En sağlam yol: DB mapping (sid -> users.id)
      try {
        const mapped = await getUserIdBySid(sid);
        if (mapped) {
          await touchSid(sid);
          return {
            user_id: String(mapped),
            email: null,
            role: "user",
            session: "sid_db",
          };
        }
      } catch (e) {
        console.error("[auth] sid_db lookup error:", e);
      }

      // B) KV'den email alabilirsek, users.id'yi resolve et ve sid'i map et
      try {
        const sess = await kv.get(`sess:${sid}`);
        if (sess && typeof sess === "object" && sess.email) {
          const email = String(sess.email);
          const role = normalizeRole(sess.role);

          const user_id = await getOrCreateUserIdByEmail(email);
          if (user_id) {
            try {
              await linkSidToUserId(sid, user_id);
            } catch (e) {
              console.error("[auth] linkSidToUserId error:", e);
            }
            return {
              user_id: String(user_id),
              email,
              role,
              session: "kv_email_db",
            };
          }

          // users tablosu / db yoksa bile email'i döndür
          return {
            user_id: null,
            email,
            role,
            session: "kv_email_nodb",
          };
        }
      } catch (e) {
        // KV/Upstash down olsa bile auth'u öldürmeyelim
        console.error("[auth] KV read error:", e);
      }

      // C) Email yoksa bile: anon user aç + sid'i map et
      const anon = await getOrCreateAnonymousUserId();
      if (anon) {
        try {
          await linkSidToUserId(sid, anon);
        } catch (e) {
          console.error("[auth] linkSidToUserId(anon) error:", e);
        }
      }

      return {
        user_id: anon ? String(anon) : null,
        email: null,
        role: "user",
        session: anon ? "sid_anon_db" : "sid_anon_nodb",
      };
    }

    // ---------------------------------
    // 2) LEGACY JWT (aivo_session)
    // ---------------------------------
    const token = cleanToken(cookies[COOKIE_JWT]);
    const JWT_SECRET = process.env.JWT_SECRET;

    if (token && JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        const email =
          payload?.email || payload?.sub || payload?.user?.email || null;

        const role = normalizeRole(payload?.role || "user");

        if (email) {
          const user_id = await getOrCreateUserIdByEmail(String(email));

          // JWT tarafında sid yok; ama yine de stable user_id döndürürüz
          return {
            user_id: user_id ? String(user_id) : null,
            email: String(email),
            role,
            session: "jwt_email_db",
          };
        }
      } catch (e) {
        // invalid jwt -> fallthrough
      }
    }

    // Son çare: hiçbir şey yok
    return null;
  } catch (e) {
    console.error("[auth] requireAuth fatal:", e);
    return null;
  }
}
