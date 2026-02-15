// api/_lib/auth.js
// Hybrid auth:
// 1) KV session cookie: aivo_sess
// 2) Legacy JWT cookie: aivo_session

import jwt from "jsonwebtoken";
import { kv } from "@vercel/kv";

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

/* ----------------------------- helpers ----------------------------- */

function parseCookies(req) {
  const header = req?.headers?.cookie || "";
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

/* ----------------------------- main ----------------------------- */

export async function requireAuth(req, res) {
  try {
    const cookies = parseCookies(req);

    /* ---------------- KV SESSION ---------------- */
    const sid = cleanToken(cookies[COOKIE_KV]);

    if (sid) {
      try {
        const sess = await kv.get(`sess:${sid}`);
        if (sess && typeof sess === "object" && sess.email) {
          return {
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
          return {
            email,
            role: payload?.role || "user",
            session: "jwt",
          };
        }
      } catch (e) {
        // JWT invalid — fallthrough
      }
    }

    /* ---------------- NO AUTH ---------------- */
    return null;
  } catch (e) {
    console.error("requireAuth fatal:", e);
    return null;
  }
}
