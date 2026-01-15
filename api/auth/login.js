// api/auth/login.js
import crypto from "crypto";

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

// --- Password verify (scrypt) ---
// KV'de user kaydı şu formatta olmalı:
// {
//   email: "...",
//   name: "...",
//   salt: "<hex>",
//   hash: "<hex>",
//   verified: true
// }
function scryptHash(password, saltHex) {
  const salt = Buffer.from(saltHex, "hex");
  const buf = crypto.scryptSync(String(password), salt, 32);
  return buf.toString("hex");
}

function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a || ""), "hex");
    const bb = Buffer.from(String(b || ""), "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// --- JWT (HS256) no dependency ---
function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sig}`;
}

function setSessionCookie(res, token, maxAgeSeconds) {
  const secure = env("COOKIE_SECURE", "1") !== "0"; // prod: 1
  const sameSite = env("COOKIE_SAMESITE", "Lax");  // Lax öneri
  const domain = env("COOKIE_DOMAIN", "");         // ister boş bırak
  const parts = [
    `aivo_session=${token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push("Secure");
  if (domain) parts.push(`Domain=${domain}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = await readJson(req);
    if (!body) {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email_invalid" });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    // KV load (opsiyonel) — fonksiyon içinde import, çakılmaz
    let kv = null;
    try {
      const mod = await import("@vercel/kv");
      kv = mod?.kv || null;
    } catch {
      kv = null;
    }

    const SESSION_SECRET = env("SESSION_SECRET");
    if (!SESSION_SECRET) {
      // 500 verme, net misconfig
      return res.status(503).json({ ok: false, error: "misconfigured", detail: "SESSION_SECRET missing" });
    }
    if (!kv) {
      return res.status(503).json({ ok: false, error: "misconfigured", detail: "KV not available" });
    }

    const userKey = `user:${email}`;
    const user = await kv.get(userKey);

    if (!user) {
      return res.status(401).json({ ok: false, error: "user_not_found" });
    }
    if (user.verified === false) {
      return res.status(403).json({ ok: false, error: "email_not_verified" });
    }

    const saltHex = String(user.salt || "");
    const hashHex = String(user.hash || "");
    if (!saltHex || !hashHex) {
      return res.status(503).json({ ok: false, error: "misconfigured", detail: "user has no password hash" });
    }

    const computed = scryptHash(password, saltHex);
    const passOk = safeEqualHex(computed, hashHex);
    if (!passOk) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    // session token
    const now = Math.floor(Date.now() / 1000);
    const maxAge = Number(env("SESSION_MAX_AGE", String(60 * 60 * 24 * 30))); // 30 gün
    const payload = {
      sub: email,
      name: user.name || "",
      iat: now,
      exp: now + maxAge,
    };

    const token = signJwt(payload, SESSION_SECRET);
    setSessionCookie(res, token, maxAge);

    return res.status(200).json({
      ok: true,
      email,
      name: user.name || "",
    });
  } catch (e) {
    console.error("[LOGIN_FATAL]", e);
    // patlamasın: gene de 500 ama kontrollü
    return res.status(500).json({ ok: false, error: "login_failed" });
  }
}
