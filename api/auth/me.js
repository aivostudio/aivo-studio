// /api/auth/me.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;

function b64urlDecode(str) {
  str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function verifyJWT(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = signHS256(data, secret);
  if (expected !== s) return null;

  const payload = JSON.parse(b64urlDecode(p));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;

  return payload;
}

module.exports = (req, res) => {
  try {
    if (!JWT_SECRET) {
      // crash yerine temiz cevap
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ ok: false, error: "no_session" });

    const payload = verifyJWT(token, JWT_SECRET);
    if (!payload) return res.status(401).json({ ok: false, error: "invalid_session" });

    return res.status(200).json({
      ok: true,
      email: payload.email || payload.sub,
      role: payload.role || "user",
      exp: payload.exp || null,
    });
  } catch (e) {
    // crash yerine JSON hata
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
