// api/_lib/auth.js  (ESM)
// Cookie (aivo_session) içindeki JWT'yi doğrular.
// requireAuth(req, res) -> { email, sub, ...payload } döner veya 401/500 döndürür.

import jwt from "jsonwebtoken";

const COOKIE_NAME = "aivo_session";

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

function normalizeToken(raw) {
  if (!raw) return null;
  let t = String(raw).trim();

  // cookie bazen "..." şeklinde geliyor
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }

  // bazen "Bearer xxx" gibi yanlış set ediliyor
  if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, "").trim();

  // express signed cookie formatı: "s:xxxxx.yyyyy" -> JWT değil, temizle
  if (t.startsWith("s:")) t = t.slice(2);

  return t || null;
}

function isJwtLike(t) {
  // JWT = 3 parça (a.b.c)
  return typeof t === "string" && t.split(".").length === 3;
}

export async function requireAuth(req, res) {
  try {
    const cookies = parseCookies(req);
    const tokenRaw = cookies[COOKIE_NAME];
    const token = normalizeToken(tokenRaw);

    if (!token) {
      res.status(401).json({ ok: false, error: "unauthorized_no_cookie" });
      return null;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      res.status(500).json({ ok: false, error: "jwt_secret_missing" });
      return null;
    }

    // Token JWT değilse: bu sistem JWT bekliyor -> 401 (net teşhis)
    if (!isJwtLike(token)) {
      res.status(401).json({
        ok: false,
        error: "unauthorized_invalid_token",
        reason: "token_not_jwt",
      });
      return null;
    }

    const payload = jwt.verify(token, JWT_SECRET);

    // payload normalize
    const email = payload?.email || payload?.sub || payload?.user?.email || null;
    if (!email) {
      res.status(401).json({
        ok: false,
        error: "unauthorized_invalid_token",
        reason: "missing_email_in_payload",
      });
      return null;
    }

    return { ...payload, email };
  } catch (e) {
    // daha okunur reason (exp vs signature)
    const msg = String(e?.message || e);
    const reason =
      msg.includes("jwt expired") ? "jwt_expired" :
      msg.includes("invalid signature") ? "invalid_signature" :
      msg.includes("jwt malformed") ? "jwt_malformed" :
      "verify_failed";

    res.status(401).json({
      ok: false,
      error: "unauthorized_invalid_token",
      reason,
    });
    return null;
  }
}
