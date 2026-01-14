// /api/login.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün
const JWT_SECRET = process.env.JWT_SECRET;

function isAdminEmail(email) {
  const list = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return false;
  return list.includes(String(email || "").toLowerCase());
}

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
  return `${data}.${signHS256(data, secret)}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const email = String((req.body || {}).email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const role = isAdminEmail(email) ? "admin" : "user"
