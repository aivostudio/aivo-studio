// /api/auth/login.js
import crypto from "crypto";
import kvMod from "../_kv.js";

// kv helper (projedeki export şekline göre güvenli al)
const kv = kvMod.default || kvMod;
const kvGetJson = kv.kvGetJson || kv.getJson || kv.get || kv.kvGet;
const kvSetJson = kv.kvSetJson || kv.setJson || kv.set || kv.kvSet;

const env = (k, d = "") => String(process.env[k] || d).trim();
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
    // Vercel/Node edge durumlarında son çare
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  }
}

// Basit şifre kontrolü (bcrypt yoksa bile sistem çökmesin)
async function verifyPassword(user, password) {
  // 1) bcrypt hash varsa dene
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
      // bcrypt patlarsa false'a düş
      return false;
    }
  }

  // 2) düz şifre saklanıyorsa (dev/test)
  const plain = user?.password || user?.pass || "";
  if (plain) return String(plain) === String(password);

  // 3) hiç bir şey yoksa
  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return safeJson(res, 405, { ok: false, error: "method_not_allowed" });

    const body = await readJson(req);
    if (!body) return safeJson(res, 400, { ok: false, error: "invalid_json" });

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@")) return safeJson(res, 400, { ok: false, error: "email_invalid" });
    if (!password) return safeJson(res, 400, { ok: false, error: "user_password_missing" });

    // ✅ BAN kontrolü: admin hard delete sonrası ban:<email> yazacağız
    const banKey = `ban:${email}`;
    const banned = kvGetJson ? await kvGetJson(banKey).catch(() => null) : null;
    if (banned) {
      return safeJson(res, 403, { ok: false, error: "user_banned" });
    }

    // ✅ user kaydı
    const userKey = `user:${email}`;
    const user = kvGetJson ? await kvGetJson(userKey).catch(() => null) : null;
    if (!user) {
      // user yoksa 401 dön; 500 asla verme
      return safeJson(res, 401, { ok: false, error: "user_not_found" });
    }

    // ✅ disabled engeli
    if (user.disabled === true) {
      return safeJson(res, 403, { ok: false, error: "user_disabled" });
    }

    // ✅ verify zorunluluğu (istersen açık kalsın)
    // eğer sisteminde verified alanı yoksa sorun olmaz
    if (user.verified === false) {
      return safeJson(res, 403, { ok: false, error: "email_not_verified" });
    }

    // ✅ şifre doğrula
    const okPass = await verifyPassword(user, password);
    if (!okPass) {
      return safeJson(res, 401, { ok: false, error: "invalid_credentials" });
    }

    // ✅ session token (basit)
    const token = crypto.randomBytes(24).toString("hex");
    const sessionKey = `sess:${token}`;
    const session = {
      email,
      createdAt: Date.now(),
      ok: true,
    };

    // 7 gün
    if (kvSetJson) {
      await kvSetJson(sessionKey, session, { ex: 60 * 60 * 24 * 7 }).catch(() => {});
    }

    // cookie set
    const cookie = `aivo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Secure`;
    res.setHeader("Set-Cookie", cookie);

    return safeJson(res, 200, { ok: true, email });
  } catch (e) {
    // ✅ burada bile asla 500 raw patlama yok
    return safeJson(res, 500, {
      ok: false,
      error: "login_failed",
      message: String(e?.message || e),
    });
  }
}
