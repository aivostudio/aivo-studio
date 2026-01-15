// /api/auth/login.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const JWT_SECRET = process.env.JWT_SECRET;

// KV helper (Upstash/Vercel KV wrapper)
// /api/_kv.js dosyan var (screenshot)
// Bu dosyada kvGetJson yoksa, alttaki helper'ı kendi fonksiyon isimlerine göre uyarlarsın.
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

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Beklenen parola formatı (önerilen):
 * user.passwordSalt: hex
 * user.passwordHash: hex   (scrypt sonucu)
 *
 * Register tarafında da aynı şekilde üretmelisin:
 * const salt = crypto.randomBytes(16).toString("hex");
 * const hash = crypto.scryptSync(password, salt, 32).toString("hex");
 */
function verifyPasswordScrypt(password, saltHex, hashHex) {
  if (!password || !saltHex || !hashHex) return false;
  const derived = crypto.scryptSync(String(password), String(saltHex), 32).toString("hex");
  return timingSafeEqualStr(derived, String(hashHex));
}

async function getUserByEmail(email) {
  if (!kvGetJson) return null;

  // Önce en olası key: user:${email}
  const u1 = await kvGetJson(`user:${email}`);
  if (u1) return u1;

  // Bazı projelerde users:${email} olabiliyor
  const u2 = await kvGetJson(`users:${email}`);
  if (u2) return u2;

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
    const password = String((req.body || {}).password || "");

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!password) return res.status(400).json({ ok: false, error: "password_required" });

    // ✅ 1) kullanıcıyı bul
    const user = await getUserByEmail(email);
    if (!user) {
      // güvenlik: kullanıcı var/yok sızdırma
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    // ✅ 2) şifre doğru mu?
    // user.passwordSalt + user.passwordHash bekleniyor
    const passwordOk = verifyPasswordScrypt(password, user.passwordSalt, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    // ✅ 3) verified gate (asıl hedef)
    // Alan adı sende verified / emailVerified / verifiedAt olabilir:
    // - verified boolean ise: !!user.verified
    // - verifiedAt varsa: !!user.verifiedAt
    const isVerified =
      user.verified === true ||
      user.emailVerified === true ||
      Boolean(user.verifiedAt);

    if (!isVerified) {
      return res.status(403).json({
        ok: false,
        error: "email_not_verified",
        email,
      });
    }

    // Role: user kaydında role varsa onu kullan, yoksa admin env listesine bak
    const role = user.role || (isAdminEmail(email) ? "admin" : "user");

    // ======= BURADAN AŞAĞISI: SENİN MEVCUT JWT + COOKIE BLOĞUN (aynı) =======
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
