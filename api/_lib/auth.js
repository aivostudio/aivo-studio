// lib/auth.js
// Amaç: Cookie (aivo_session) üzerinden auth doğrulamak
// Kullanım: requireAuth(req, res) → user objesi döner veya 401 verir

const jwt = require("jsonwebtoken");

const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET; // Vercel Env'e eklenecek

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map(v => {
      const i = v.indexOf("=");
      if (i === -1) return [];
      return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))];
    }).filter(Boolean)
  );
}

function requireAuth(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      res.status(401).json({ ok: false, error: "unauthorized_no_cookie" });
      return null;
    }

    if (!JWT_SECRET) {
      res.status(500).json({ ok: false, error: "jwt_secret_missing" });
      return null;
    }

    const payload = jwt.verify(token, JWT_SECRET);
    // payload örn: { sub: userId/email, email, iat, exp }

    return payload;
  } catch (e) {
    res.status(401).json({ ok: false, error: "unauthorized_invalid_token" });
    return null;
  }
}

module.exports = { requireAuth };
