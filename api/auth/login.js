// /api/auth/login.js
import crypto from "crypto";
import kvMod from "../_kv.js";

// ---- KV resolver (tüm varyantları yakala)
const kvObj = kvMod?.default || kvMod || {};
const kvGet =
  kvObj.kvGetJson ||
  kvObj.getJson ||
  kvObj.kvGet ||
  kvObj.get ||
  kvObj.readJson ||
  null;

const kvSet =
  kvObj.kvSetJson ||
  kvObj.setJson ||
  kvObj.kvSet ||
  kvObj.set ||
  kvObj.writeJson ||
  null;

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

// Basit şifre kontrolü (bcrypt yoksa bile çökmesin)
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

    // KV zorunlu (session yazacağız)
    if (!kvGet || !kvSet) {
      return safeJson(res, 503, {
        ok: false,
        error: "kv_not_available",
        hint: "kvGet/kvSet export bulunamadı (_kv.js export mapping kontrol)",
      });
    }

    const body = await readJson(req);
    if (!body) return safeJson(res, 400, { ok: false, error: "invalid_json" });

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@")) {
      return safeJson(res, 400, { ok: false, error: "email_invalid" });
    }
    if (!password) {
      return safeJson(res, 400, { ok: false, error: "user_password_missing" });
    }

    // ✅ BAN
    const banKey = `ban:${email}`;
    const banned = await kvGet(banKey).catch(() => null);
    if (banned) return safeJson(res, 403, { ok: false, error: "user_banned" });

    // ✅ user
    const userKey = `user:${email}`;
    const user = await kvGet(userKey).catch(() => null);
    if (!user) return safeJson(res, 401, { ok: false, error: "user_not_found" });

    if (user.disabled === true) {
      return safeJson(res, 403, { ok: false, error: "user_disabled" });
    }

    // verified alanı varsa enforce et
    if (user.verified === false) {
      return safeJson(res, 403, { ok: false, error: "email_not_verified" });
    }

    const okPass = await verifyPassword(user, password);
    if (!okPass) return safeJson(res, 401, { ok: false, error: "invalid_credentials" });

    // ✅ session token
    const token = crypto.randomBytes(24).toString("hex");
    const sessionKey = `sess:${token}`;
    const session = { ok: true, email, createdAt: Date.now() };

    // KV’ye yazmak ZORUNLU — yazamazsa login başarısız say
    const ttl = 60 * 60 * 24 * 7;
    try {
      await kvSet(sessionKey, session, { ex: ttl });
    } catch (e) {
      return safeJson(res, 503, {
        ok: false,
        error: "session_write_failed",
        message: String(e?.message || e),
      });
    }

    // cookie
    const cookie =
      `aivo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}; Secure`;
    res.setHeader("Set-Cookie", cookie);

    // ✅ frontend uyumlu response
    return safeJson(res, 200, { ok: true, user: { email } });

  } catch (e) {
    return safeJson(res, 500, { ok: false, error: "login_failed", message: String(e?.message || e) });
  }
}
