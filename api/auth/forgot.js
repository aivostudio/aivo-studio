// api/auth/forgot.js
const crypto = require("crypto");
const { kv } = require("@vercel/kv");

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, reason: "method" });
  }

  let body = {};
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (_) {}

  const email = String(body.email || "").trim().toLowerCase();

  // Enumeration riskini azaltmak için:
  if (!email || !email.includes("@")) {
    return json(res, 200, { ok: true });
  }

  // Token üret
  const token = crypto.randomBytes(24).toString("hex"); // 48 char
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const now = Date.now();
  const ttlSeconds = 30 * 60; // 30 dk
  const expiresAt = now + ttlSeconds * 1000;

  // Redis key
  const key = `aivo:reset:${tokenHash}`;

  // Redis'e yaz (TTL ile)
  await kv.set(
    key,
    {
      email,
      expiresAt,
      used: false,
      createdAt: now
    },
    { ex: ttlSeconds }
  );

  const base = getBaseUrl(req);
  const resetUrl = `${base}/reset.html?token=${encodeURIComponent(token)}`;

  // production → debug link gösterme
  const isProd = process.env.VERCEL_ENV === "production";

  return json(res, 200, {
    ok: true,
    ...(isProd ? {} : { debug_reset_url: resetUrl })
  });
};
