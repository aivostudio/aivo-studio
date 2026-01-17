// /api/auth/verify.js
import crypto from "crypto";
import kvMod from "../_kv.js";

// kv helper (export şekline göre güvenli al)
const kv = kvMod.default || kvMod;
const kvGetJson = kv.kvGetJson || kv.getJson || kv.get || kv.kvGet;
const kvSetJson = kv.kvSetJson || kv.setJson || kv.set || kv.kvSet;
const kvDel = kv.kvDel || kv.del || kv.kvDelKey || null;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function kvGetSafe(key) {
  if (kvGetJson) {
    try {
      const v = await kvGetJson(key);
      if (v !== undefined && v !== null) return v;
    } catch {}
  }
  try {
    const rawGet = kv.get || kv.kvGet;
    if (rawGet) {
      const v = await rawGet.call(kv, key);
      if (v === undefined || v === null) return null;
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return v; }
      }
      return v;
    }
  } catch {}
  return null;
}

async function kvSetSafe(key, value, opts) {
  if (kvSetJson) {
    try {
      await kvSetJson(key, value, opts);
      return true;
    } catch {}
  }
  try {
    const rawSet = kv.set || kv.kvSet;
    if (rawSet) {
      await rawSet.call(kv, key, typeof value === "string" ? value : JSON.stringify(value));
      return true;
    }
  } catch {}
  return false;
}

async function kvDelSafe(key) {
  if (kvDel) {
    try { await kvDel(key); return true; } catch {}
  }
  // del yoksa sessiz geç
  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const token = (req.query?.token || "").toString().trim();
    if (!token) return json(res, 400, { ok: false, error: "missing_token" });

    const verifyKey = `verify:${token}`;
    const payload = await kvGetSafe(verifyKey);

    if (!payload || typeof payload !== "object") {
      return json(res, 400, { ok: false, error: "invalid_or_expired_token" });
    }

    const email = normalizeEmail(payload.email);
    if (!email || !email.includes("@")) {
      return json(res, 400, { ok: false, error: "bad_payload_missing_email" });
    }

    // ✅ BAN kontrolü: silinen mail verify ile geri dönemesin
    const banned = await kvGetSafe(`ban:${email}`);
    if (banned) {
      // token yine de temizlenebilir
      await kvDelSafe(verifyKey);
      return json(res, 403, { ok: false, error: "user_banned" });
    }

    // ✅ USER kaydını KV'ye yaz (login'in baktığı key)
    const now = Date.now();

    // şifre alanı payload içinde olabilir (register ne yazdıysa)
    const user = {
      id: payload.id || crypto.randomUUID(),
      email,
      role: payload.role || "user",
      createdAt: payload.createdAt || now,
      updatedAt: now,
      verified: true,
      disabled: false,
      // password / passwordHash payload’dan gelebilir:
      password: payload.password || payload.pass || undefined,
      passwordHash: payload.passwordHash || payload.passHash || payload.hash || undefined,
    };

    // undefined alanları temizle
    Object.keys(user).forEach((k) => user[k] === undefined && delete user[k]);

    // hem user: hem users: yaz (sizde key karmaşası varsa iki tarafa da)
    await kvSetSafe(`user:${email}`, user);
    await kvSetSafe(`users:${email}`, user);

    // token invalidate
    await kvDelSafe(verifyKey);

    // ✅ Beklenen UX: siteye geri dön
    // İstersen "/login.html?verified=1" de yapabilirsin
    res.statusCode = 302;
    res.setHeader("Location", "/?verified=1");
    res.end();
  } catch (e) {
    return json(res, 200, { ok: false, error: "verify_failed", message: String(e?.message || e) });
  }
}
