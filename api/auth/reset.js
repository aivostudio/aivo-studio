// api/auth/reset.js
const crypto = require("crypto");

global.__AIVO_RESET_STORE__ = global.__AIVO_RESET_STORE__ || new Map();

// MVP USER STORE (GEÇİCİ)
// Canlı: gerçek kullanıcı DB (email -> password_hash) olacak.
global.__AIVO_USER_STORE__ = global.__AIVO_USER_STORE__ || new Map();

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function hashPassword(password, saltHex) {
  // Basit PBKDF2 (MVP). Canlıda argon2/bcrypt tercih edilir.
  const salt = Buffer.from(saltHex, "hex");
  const derived = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256");
  return derived.toString("hex");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return json(res, 405, { ok: false, reason: "method" });

  let body = {};
  try { body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}"); } catch (_) {}

  const token = String(body.token || "").trim();
  const password = String(body.password || "");

  if (!token || token.length < 16) return json(res, 200, { ok: false, reason: "invalid" });
  if (!password || password.length < 8) return json(res, 200, { ok: false, reason: "weak" });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const rec = global.__AIVO_RESET_STORE__.get(tokenHash);

  if (!rec) return json(res, 200, { ok: false, reason: "invalid" });
  if (rec.used) return json(res, 200, { ok: false, reason: "used" });

  const now = Date.now();
  if (now > rec.expiresAt) {
    // expired -> silmek mantıklı
    global.__AIVO_RESET_STORE__.delete(tokenHash);
    return json(res, 200, { ok: false, reason: "expired" });
  }

  // “Şifre güncelleme” (MVP user store)
  const email = rec.email;

  const saltHex = crypto.randomBytes(16).toString("hex");
  const passHash = hashPassword(password, saltHex);

  global.__AIVO_USER_STORE__.set(email, {
    password_hash: passHash,
    salt: saltHex,
    updatedAt: now
  });

  // Token tek kullanımlık -> used işaretle veya sil
  rec.used = true;
  rec.usedAt = now;
  global.__AIVO_RESET_STORE__.set(tokenHash, rec);

  return json(res, 200, { ok: true });
};
