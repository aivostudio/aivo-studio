// /api/auth/login.js
import crypto from "crypto";
import kvMod from "../_kv.js";

// kv helper (projedeki export şekline göre güvenli al)
const kv = kvMod.default || kvMod;
const kvGetJson = kv.kvGetJson || kv.getJson || kv.get || kv.kvGet;
const kvSetJson = kv.kvSetJson || kv.setJson || kv.set || kv.kvSet;

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function readJson(req) {
  try {
    if (req.body && typeof req.body === "object") return req.body;
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function safeJson(res, status, obj) {
  try {
    res.status(status).json(obj);
  } catch {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  }
}

// ✅ KV okuma: hem JSON helper hem raw get + string->JSON parse (çökmesin)
async function kvGetSafe(key) {
  // 1) JSON helper
  if (kvGetJson) {
    try {
      const v = await kvGetJson(key);
      if (v !== undefined && v !== null) return v;
    } catch {}
  }

  // 2) raw get (kv.get / kv.kvGet)
  try {
    const rawGet = kv.get || kv.kvGet;
    if (rawGet) {
      const v = await rawGet.call(kv, key);
      if (v === undefined || v === null) return null;

      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v; // parse edilemiyorsa string kalsın
        }
      }
      return v;
    }
  } catch {}

  return null;
}

// Basit şifre kontrolü (bcrypt yoksa bile sistem çökmesin)
async function verifyPassword(user, password) {
  const hash =
    user?.passwordHash ||
    user?.passHash ||
    user?.hash ||
    user?.password_hash ||
    "";

  if (hash) {
    try {
      const bcrypt = await import("bcryptjs").catch(() => null);
      if (bcrypt?.default?.compare) return await bcrypt.default.compare(password, hash);
      if (bcrypt?.compare) return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  const plain = user?.password || user?.pass || "";
  if (plain) return String(plain) === String(password);

  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return safeJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const body = await readJson(req);
    if (!body) return safeJson(res, 400, { ok: false, error: "invalid_json" });

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@")) return safeJson(res, 400, { ok: false, error: "email_invalid" });
    if (!password) return safeJson(res, 400, { ok: false, error: "user_password_missing" });

    // ✅ BAN kontrolü (hard delete sonrası ban:<email>)
    const banned = await kvGetSafe(`ban:${email}`);
    if (banned) {
      return safeJson(res, 403, { ok: false, error: "user_banned" });
    }

    // ✅ USER kaydı (key fallback)
    const user =
      (await kvGetSafe(`user:${email}`)) ||
      (await kvGetSafe(`users:${email}`));

    if (!user || typeof user !== "object") {
      return safeJson(res, 401, { ok: false, error: "user_not_found" });
    }

    if (user.disabled === true) {
      return safeJson(res, 403, { ok: false, error: "user_disabled" });
    }

    // verified alanı yoksa sorun çıkarmaz (undefined !== false)
    if (user.verified === false) {
      return safeJson(res, 403, { ok: false, error: "email_not_verified" });
    }

    const okPass = await verifyPassword(user, password);
    if (!okPass) {
      return safeJson(res, 401, { ok: false, error: "invalid_credentials" });
    }

    // ✅ session
    const token = crypto.randomBytes(24).toString("hex");
    const sessionKey = `sess:${token}`;
    const session = { email, createdAt: Date.now(), ok: true };

    if (kvSetJson) {
      await kvSetJson(sessionKey, session, { ex: 60 * 60 * 24 * 7 }).catch(() => {});
    } else {
      // kvSetJson yoksa sess yazılamaz, ama yine de login dönelim (çökmesin)
    }

    const cookie = `aivo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Secure`;
    res.setHeader("Set-Cookie", cookie);

    return safeJson(res, 200, { ok: true, email });
  } catch (e) {
    // ✅ JSON dön (çökme yok)
    return safeJson(res, 200, {
      ok: false,
      error: "login_failed",
      message: String(e?.message || e),
    });
  }
}
