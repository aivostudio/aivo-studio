// api/_lib/auth.js
// Hybrid auth:
// 1) KV session cookie: aivo_sess
// 2) Legacy JWT cookie: aivo_session

import jwt from "jsonwebtoken";
import { kv } from "@vercel/kv";
import { neon } from "@neondatabase/serverless";

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

/* ----------------------------- helpers ----------------------------- */
function parseCookies(req) {
  let header = "";

  // Node style variants
  if (req?.headers?.cookie) header = req.headers.cookie;
  if (!header && req?.headers?.["cookie"]) header = req.headers["cookie"];

  // Web Request style
  if (!header && req?.headers?.get) header = req.headers.get("cookie") || "";

  const out = {};
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

  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, "").trim();
  }

  if (t.startsWith("s:")) {
    t = t.slice(2);
  }

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

/* ----------------------------- main ----------------------------- */

export async function requireAuth(req) {
  try {
    const cookies = parseCookies(req);

    /* ---------------- KV SESSION ---------------- */
    const sid = cleanToken(cookies[COOKIE_KV]);

    if (sid) {
      try {
        const sess = await kv.get(`sess:${sid}`);
        if (sess && typeof sess === "object" && sess.email) {
          const user_id = await getOrCreateUserIdByEmail(sess.email);

          return {
            user_id,
            email: sess.email,
            role: sess.role || "user",
            session: "kv",
          };
        }
      } catch (e) {
        console.error("KV read error:", e);
      }
    }

    /* ---------------- LEGACY JWT ---------------- */
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
            user_id,
            email,
            role: payload?.role || "user",
            session: "jwt",
          };
        }
      } catch {
        // invalid jwt
      }
    }

    return null;
  } catch (e) {
    console.error("requireAuth fatal:", e);
    return null;
  }
}
