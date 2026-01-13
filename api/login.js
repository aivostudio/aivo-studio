// /api/login.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün (saniye)
const JWT_SECRET = process.env.JWT_SECRET;

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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

function makeJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const s = signHS256(data, secret);
  return `${data}.${s}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    // Basit JWT payload
    const now = Math.floor(Date.now() / 1000);
    const token = makeJWT(
      {
        sub: email,
        email,
        iat: now,
        exp: now + COOKIE_MAX_AGE,
      },
      JWT_SECRET
    );

    // Cookie set
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    // JSON dönelim ki r.json() patlamasın
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
