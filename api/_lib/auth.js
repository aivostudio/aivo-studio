// api/_lib/auth.js  (ESM)
// NEW: KV session cookie (aivo_sess) üzerinden auth
// LEGACY: JWT cookie (aivo_session) fallback (opsiyonel)

import jwt from "jsonwebtoken";
import { kvGetJson } from "./kv.js"; // projende yolu farklıysa söyle, düzeltelim

const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

function parseCookies(req) {
  const header = req?.headers?.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  });
  return out;
}

export async function requireAuth(req, res) {
  try {
    const cookies = parseCookies(req);

    // 1) ✅ NEW FLOW: KV session (aivo_sess)
    const sid = cookies[COOKIE_KV];
    if (sid) {
      const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
      if (sess && typeof sess === "object" && sess.email) {
        // En azından email dönelim; istersen burada user_id da resolve edebiliriz
        return {
          session: "kv",
          email: sess.email,
          role: sess.role || "user",
          verified: typeof sess.verified === "boolean" ? sess.verified : true,
          sid,
          sess,
        };
      }
      res.status(401).json({ ok: false, error: "invalid_session" });
      return null;
    }

    // 2) ✅ LEGACY FLOW: JWT cookie (aivo_session) fallback
    const token = cookies[COOKIE_JWT];
    if (!token) {
      res.status(401).json({ ok: false, error: "no_session" });
      return null;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      // legacy JWT yoksa invalid say
      res.status(401).json({ ok: false, error: "invalid_session" });
      return null;
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const email = payload?.email || payload?.sub || null;
    if (!email) {
      res.status(401).json({ ok: false, error: "invalid_session" });
      return null;
    }

    return { session: "jwt", ...payload, email };
  } catch (e) {
    res.status(401).json({ ok: false, error: "invalid_session" });
    return null;
  }
}
