// /api/auth/verify.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod.default || kvMod;

// KV helpers (projede farklı exportlar olabilir)
const kvGetJson = kv.kvGetJson || kv.getJson || kv.get || kv.kvGet;
const kvSetJson = kv.kvSetJson || kv.setJson || kv.set || kv.kvSet;
const kvDelFn   = kv.kvDel || kv.del || kv.kvDelKey || null;

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();
const env = (k, d = "") => String(process.env[k] || d).trim();

function sendJson(res, status, data) {
  try {
    res.status(status).json(data);
  } catch {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data, null, 2));
  }
}

async function kvGetSafe(key) {
  if (kvGetJson) {
    try {
      const v = await kvGetJson(key);
      return v ?? null;
    } catch {}
  }
  return null;
}

async function kvSetSafe(key, val, opts) {
  if (kvSetJson) {
    try {
      await kvSetJson(key, val, opts);
      return true;
    } catch {}
  }
  return false;
}

async function kvDelSafe(key) {
  if (!kvDelFn) return false;
  try { await kvDelFn(key); return true; } catch { return false; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const token = (req.query?.token || "").toString().trim();
    if (!token) return sendJson(res, 400, { ok: false, error: "missing_token" });

    const verifyKey = `verify:${token}`;
    const payload = await kvGetSafe(verifyKey);

    if (!payload || typeof payload !== "object") {
      return sendJson(res, 400, { ok: false, error: "invalid_or_expired_token" });
    }

    const email = normalizeEmail(payload.email);
    if (!email || !email.includes("@")) {
      return sendJson(res, 400, { ok: false, error: "bad_payload_missing_email" });
    }

    // BAN kontrolü
    const banned = await kvGetSafe(`ban:${email}`);
    if (banned) {
      await kvDelSafe(verifyKey);
      return sendJson(res, 403, { ok: false, error: "user_banned" });
    }

    const now = Date.now();

    // Mevcut user varsa çek (şifre/hash burada duruyor olmalı)
    const userKey = `user:${email}`;
    const existing = await kvGetSafe(userKey);

    // ✅ user kaydını verified=true yap (şifreyi burada üretmeye çalışma!)
    const user = {
      ...(existing && typeof existing === "object" ? existing : {}),
      email,
      verified: true,
      disabled: false,
      updatedAt: now,
      createdAt: (existing && existing.createdAt) ? existing.createdAt : (payload.createdAt || now),
      role: (existing && existing.role) ? existing.role : (payload.role || "user"),
      id: (existing && existing.id) ? existing.id : (payload.id || crypto.randomUUID()),
    };

    await kvSetSafe(userKey, user);

    // users:list index varsa güncelle (opsiyonel)
    // (burayı istersen kaldırabilirsin; admin panel için faydalı)
    try {
      const LIST_KEY = "users:list";
      const list = (await kvGetSafe(LIST_KEY)) || [];
      if (Array.isArray(list)) {
        const idx = list.findIndex((u) => String(u?.email || "").toLowerCase() === email);
        const row = {
          email,
          role: user.role || "user",
          disabled: !!user.disabled,
          createdAt: user.createdAt || now,
          updatedAt: now,
        };
        if (idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.unshift(row);
        await kvSetSafe(LIST_KEY, list);
      }
    } catch {}

    // token invalidate
    await kvDelSafe(verifyKey);

    // ✅ AUTO-LOGIN: session üret + cookie bas
    const sessToken = crypto.randomBytes(24).toString("hex");
    const sessKey = `sess:${sessToken}`;
    const session = { ok: true, email, createdAt: now };

    // 7 gün
    await kvSetSafe(sessKey, session, { ex: 60 * 60 * 24 * 7 });

    // cookie
    const isProd = env("NODE_ENV", "production") === "production";
    const cookie =
      `aivo_session=${sessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7};` +
      (isProd ? " Secure;" : "");

    res.setHeader("Set-Cookie", cookie);

    // ✅ Studio'ya gönder
    res.statusCode = 302;
    res.setHeader("Location", "/studio.html?verified=1");
    res.end();
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "verify_failed",
      message: String(e?.message || e),
    });
  }
}
