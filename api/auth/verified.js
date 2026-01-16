// /api/auth/verified.js
const crypto = require("crypto");
const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;

let kvGetJson;
try { ({ kvGetJson } = require("../_kv")); } catch (_) { kvGetJson = null; }

function b64urlDecode(str) {
  str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function signHS256(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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
  if (signHS256(data, secret) !== s) return null;
  const payload = JSON.parse(b64urlDecode(p));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

function isUserVerified(user) {
  if (!user) return null;
  if (user.verified === true) return true;
  if (user.emailVerified === true) return true;
  if (user.isVerified === true) return true;
  if (user.verifiedAt) return true;
  if (user.emailVerifiedAt) return true;
  if (user.verified === false) return false;
  if (user.emailVerified === false) return false;
  if (user.isVerified === false) return false;
  return null;
}

async function getUserByEmail(email) {
  if (!kvGetJson) return null;
  const keys = [`user:${email}`, `users:${email}`, `auth:user:${email}`];
  for (const k of keys) {
    try {
      const u = await kvGetJson(k);
      if (u) return u;
    } catch (_) {}
  }
  return null;
}

module.exports = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (!JWT_SECRET) return res.status(500).json({ ok: false, error: "jwt_secret_missing" });

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ ok: false, error: "no_session" });

    const payload = verifyJWT(token, JWT_SECRET);
    if (!payload) return res.status(401).json({ ok: false, error: "invalid_session" });

    const email = String(payload.email || payload.sub || "").toLowerCase();
    const user = await getUserByEmail(email);
    const verified = isUserVerified(user);

    // verified null => bilinmiyor (key mismatch vs). Bu durumda false yapmayıp "unknown" dönüyoruz.
    return res.status(200).json({
      ok: true,
      email,
      verified: verified === true,
      unknown: verified === null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
