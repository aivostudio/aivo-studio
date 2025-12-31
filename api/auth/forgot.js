// api/auth/forgot.js
const crypto = require("crypto");

// ------------------------------------------------------------------
// MVP TOKEN STORE (GEÇİCİ)
// Not: Serverless'ta kalıcılık garanti değil. Test için.
// Canlı: DB/KV (Upstash Redis / Postgres / vb.) kullanılacak.
// ------------------------------------------------------------------
global.__AIVO_RESET_STORE__ = global.__AIVO_RESET_STORE__ || new Map();

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function getBaseUrl(req) {
  // Vercel'de host header genelde doğru gelir
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  // CORS (gerekirse)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return json(res, 405, { ok: false, reason: "method" });

  let body = {};
  try { body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}"); } catch (_) {}

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    // Enumeration riskini azaltmak için yine “ok:true” dönebilirsin
    return json(res, 200, { ok: true });
  }

  // Token üret
  const token = crypto.randomBytes(24).toString("hex"); // 48 chars
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const now = Date.now();
  const expiresAt = now + 30 * 60 * 1000; // 30 dk

  // Store: tokenHash -> { email, expiresAt, used }
  global.__AIVO_RESET_STORE__.set(tokenHash, {
    email,
    expiresAt,
    used: false,
    createdAt: now
  });

  const base = getBaseUrl(req);
  const resetUrl = `${base}/reset.html?token=${encodeURIComponent(token)}`;

  // TEST MODU: mail yerine link döndür
  // Canlı: burada mail göndereceğiz (SendGrid, Resend, Amazon SES, vb.)
  return json(res, 200, {
    ok: true,
    // testte gösterilecek debug alanı:
    debug_reset_url: resetUrl
  });
};
