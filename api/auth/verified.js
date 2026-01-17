// /api/auth/verified.js
const crypto = require("crypto");

const COOKIE_NAMES = ["aivo_session", "aivo_sess"];
const JWT_SECRET = process.env.JWT_SECRET;

// KV loader (toleransli)
let kvGetJson = null;
try {
  const kvMod = require("../_kv"); // ✅ senin projede genelde bu sekil
  const kv = kvMod?.default || kvMod || {};
  kvGetJson = kv.kvGetJson || null;
} catch (_) {
  kvGetJson = null;
}

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
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const data = `${h}.${p}`;
    if (signHS256(data, secret) !== s) return null;

    const payload = JSON.parse(b64urlDecode(p));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
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

    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const cookies = parseCookies(req.headers.cookie);

    let token = "";
    for (const name of COOKIE_NAMES) {
      if (cookies[name]) { token = cookies[name]; break; }
    }

    // ✅ 401 yerine 200: guest durumda kirmizi olmasin
    if (!token) {
      return res.status(200).json({
        ok: true,
        authenticated: false,
        verified: false,
        unknown: false,
        reason: "no_session",
      });
    }

    const payload = verifyJWT(token, JWT_SECRET);

    // ✅ invalid token => 200 guest
    if (!payload) {
      return res.status(200).json({
        ok: true,
        authenticated: false,
        verified: false,
        unknown: false,
        reason: "invalid_session",
      });
    }

    const email = String(payload.email || payload.sub || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(200).json({
        ok: true,
        authenticated: false,
        verified: false,
        unknown: false,
        reason: "bad_token_payload",
      });
    }

    // ✅ KRITIK: KV yoksa Studio’yu asla logout’a dusurme
    if (typeof kvGetJson !== "function") {
      return res.status(200).json({
        ok: true,
        authenticated: true,
        email,
        verified: true,     // ✅ fail-open
        unknown: true,      // ✅ KV yok / okunamadi
        reason: "kv_not_available",
      });
    }

    const user = await getUserByEmail(email);
    const v = isUserVerified(user);

    // ✅ user bulunamadiysa da fail-open (yine logout olmasin)
    if (!user || v === null) {
      return res.status(200).json({
        ok: true,
        authenticated: true,
        email,
        verified: true,     // ✅ fail-open
        unknown: true,      // user bulunamadi / key mismatch
        reason: "user_not_found_or_unknown",
      });
    }

    // KV var, net bilgi var
    return res.status(200).json({
      ok: true,
      authenticated: true,
      email,
      verified: v === true,
      unknown: false,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
