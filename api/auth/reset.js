// api/auth/reset.js
const crypto = require("crypto");
const { kv } = require("@vercel/kv");

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
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (_) {}

  const token = String(body.token || "").trim();
  const password = String(body.password || "");

  if (!token || token.length < 16) return json(res, 200, { ok: false, reason: "invalid" });
  if (!password || password.length < 8) return json(res, 200, { ok: false, reason: "weak" });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const key = `aivo:reset:${tokenHash}`;

  // Redis'ten oku
  const rec = await kv.get(key);

  if (!rec) return json(res, 200, { ok: false, reason: "invalid" });
  if (rec.used) return json(res, 200, { ok: false, reason: "used" });

  const now = Date.now();
  if (now > Number(rec.expiresAt || 0)) {
    // expired → temizle
    await kv.del(key);
    return json(res, 200, { ok: false, reason: "expired" });
  }

  // “Şifre güncelleme” (password-update.js ile aynı KV JSON mantığı)
  const email = String(rec.email || "").toLowerCase();
  if (!email) {
    await kv.del(key);
    return json(res, 200, { ok: false, reason: "invalid" });
  }

  const kvMod = require("../_kv.js");
  const kvApi = kvMod?.default || kvMod || {};
  const kvGetJson = kvApi.kvGetJson;
  const kvSetJson = kvApi.kvSetJson;
  const bcrypt = require("bcryptjs");

  if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
    await kv.del(key);
    return json(res, 200, { ok: false, reason: "kv_not_available" });
  }

  const userKeyPrimary = `user:${email}`;
  const userKeyLegacy = `users:${email}`;

  const u1 = await kvGetJson(userKeyPrimary).catch(() => null);
  const u2 = await kvGetJson(userKeyLegacy).catch(() => null);

  const existingUser =
    u1 && typeof u1 === "object"
      ? u1
      : (u2 && typeof u2 === "object" ? u2 : null);

  if (!existingUser) {
    await kv.del(key);
    return json(res, 200, { ok: false, reason: "user_not_found" });
  }

  const pwField =
    existingUser.passwordHash ? "passwordHash" :
    existingUser.password_hash ? "password_hash" :
    existingUser.passHash ? "passHash" :
    existingUser.hash ? "hash" :
    "password";

  const nextValue =
    pwField === "password"
      ? String(password || "")
      : await bcrypt.hash(String(password || ""), 10);

  const nowTs = Date.now();

  const nextUser = {
    ...existingUser,
    email,
    updatedAt: nowTs,
    [pwField]: nextValue
  };

  if (pwField !== "password" && Object.prototype.hasOwnProperty.call(nextUser, "password")) {
    delete nextUser.password;
  }

  await kvSetJson(userKeyPrimary, nextUser);

  if (u2 && typeof u2 === "object") {
    const nextLegacy = {
      ...u2,
      email,
      updatedAt: nowTs,
      [pwField]: nextValue
    };

    if (pwField !== "password" && Object.prototype.hasOwnProperty.call(nextLegacy, "password")) {
      delete nextLegacy.password;
    }

    await kvSetJson(userKeyLegacy, nextLegacy);
  }

  // Tek kullanımlık: token'ı sil
  await kv.del(key);

  return json(res, 200, { ok: true });
};
