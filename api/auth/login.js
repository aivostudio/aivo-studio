// /api/auth/login.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ SADECE EK: KV'den user çekmek için (varsa)
let kvGetJson;
try {
  ({ kvGetJson } = require("../_kv"));
} catch (_) {
  kvGetJson = null;
}

function isAdminEmail(email) {
  const list = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return false;
  return list.includes(String(email || "").toLowerCase());
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  return `${data}.${signHS256(data, secret)}`;
}

// ✅ SADECE EK: user lookup (toleranslı)
async function getUserByEmail(email) {
  if (!kvGetJson) return null;

  // olası key’ler (senin projede hangisi varsa yakalasın diye)
  const keys = [`user:${email}`, `users:${email}`, `auth:user:${email}`];

  for (const k of keys) {
    try {
      const u = await kvGetJson(k);
      if (u) return u;
    } catch (_) {}
  }
  return null;
}

// ✅ SADECE EK: verified alan adları toleranslı
function isUserVerified(user) {
  if (!user) return null; // bilinmiyor
  if (user.verified === true) return true;
  if (user.emailVerified === true) return true;
  if (user.isVerified === true) return true;
  if (user.verifiedAt) return true;
  if (user.emailVerifiedAt) return true;

  // açıkça false ise false say
  if (user.verified === false) return false;
  if (user.emailVerified === false) return false;
  if (user.isVerified === false) return false;

  // alan yoksa bilinmiyor
  return null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const email = String((req.body || {}).email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    // ✅ TEK DAVRANIŞ DEĞİŞİKLİĞİ: verified gate
    // - user KV’de varsa ve verified değilse -> engelle
    // - user yoksa / verified bilinmiyorsa -> eski gibi devam et (login’i kırma)
    try {
      const user = await getUserByEmail(email);
      const verified = isUserVerified(user);
      if (verified === false) {
        return res.status(403).json({ ok: false, error: "email_not_verified", email });
      }
    } catch (_) {
      // KV hatası olursa login'i bozmayalım
    }

    const role = isAdminEmail(email) ? "admin" : "user";
    const now = Math.floor(Date.now() / 1000);
    const token = makeJWT(
      { sub: email, email, role, iat: now, exp: now + COOKIE_MAX_AGE },
      JWT_SECRET
    );

    const proto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = proto.includes("https");

    const cookieParts = [
      `${COOKIE_NAME}=${token}`,
      "Path=/",
      `Max-Age=${COOKIE_MAX_AGE}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isHttps) cookieParts.push("Secure");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
    res.status(200).json({ ok: true, email, role, token }); // token ekledim (UI gerekirse)

    // event: path düzeltildi -> ../_events/auth
    setTimeout(() => {
      try {
        const { onAuthLogin } = require("../_events/auth");
        const ip =
          String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
          (req.socket && req.socket.remoteAddress) ||
          "";
        const userAgent = String(req.headers["user-agent"] || "");

        Promise.resolve(
          onAuthLogin({ userId: email, email, role, ip, userAgent, at: new Date() })
        ).catch(() => {});
      } catch (_) {}
    }, 0);

    return;
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
