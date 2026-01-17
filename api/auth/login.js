// /api/auth/login.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod.default || kvMod;
const { kvGetJson, kvSetJson } = kv;

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

// password hash helpers (built-in crypto, no deps)
function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, "hex");
  const key = crypto.scryptSync(String(password || ""), salt, 64);
  return key.toString("hex");
}

function safeEq(a, b) {
  const A = Buffer.from(String(a || ""), "hex");
  const B = Buffer.from(String(b || ""), "hex");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

// Cookie set helper (minimal)
function setCookie(res, name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=/`);
  parts.push(`HttpOnly`);
  parts.push(`SameSite=Lax`);
  if (opts.secure !== false) parts.push(`Secure`);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const body = await readJson(req);
    if (!body) return res.status(400).json({ ok: false, error: "invalid_json" });

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "email_invalid" });
    if (!password) return res.status(400).json({ ok: false, error: "password_required" });

    // 1) BAN kontrol (hard silinen mail tekrar giremesin)
    const banned = await kvGetJson(`ban:${email}`);
    if (banned) {
      return res.status(403).json({ ok: false, error: "banned" });
    }

    // 2) User kaydı şart (hard silinince user:<email> yok olur => giriş yok)
    const user = await kvGetJson(`user:${email}`);
    if (!user) {
      return res.status(401).json({ ok: false, error: "user_not_found" });
    }

    // 3) Disabled kontrol (soft disable)
    if (user.disabled) {
      return res.status(403).json({ ok: false, error: "user_disabled" });
    }

    // 4) Password kontrol
    // Beklenen user formatı:
    // {
    //   email, passwordSalt, passwordHash, disabled, createdAt, updatedAt, role
    // }
    const salt = String(user.passwordSalt || "");
    const storedHash = String(user.passwordHash || "");

    if (!salt || !storedHash) {
      return res.status(500).json({ ok: false, error: "user_password_missing" });
    }

    const calc = hashPassword(password, salt);
    if (!safeEq(calc, storedHash)) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    // 5) Session oluştur
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();

    await kvSetJson(
      `sess:${token}`,
      { email, createdAt: now },
      { ex: 60 * 60 * 24 * 7 } // 7 gün
    );

    setCookie(res, "aivo_sess", token, { maxAge: 60 * 60 * 24 * 7 });

    return res.status(200).json({
      ok: true,
      email,
      role: user.role || "user",
    });
  } catch (e) {
    console.error("[LOGIN_FATAL]", e);
    return res.status(500).json({ ok: false, error: "login_failed" });
  }
}
