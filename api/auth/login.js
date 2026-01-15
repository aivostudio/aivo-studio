// /api/auth/verify.js
const crypto = require("crypto");
const { kvGetJson, kvSetJson, kvDel } = require("../_kv");

// ==== SESSION (login.js ile AYNI mantık) ====
const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün
const JWT_SECRET = process.env.JWT_SECRET;

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

function setSessionCookie(req, res, email, role) {
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

  res.setHeader("Set-Cookie", cookieParts.join("; "));
  return token;
}

// ==== HELPERS ====
function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function getTokenFromReq(req) {
  // Vercel: req.query olabilir
  const q = req.query || {};
  const fromQuery = q.token || q.t;
  if (fromQuery) return String(fromQuery);

  // raw url parse fallback
  try {
    const u = new URL(req.url, "https://aivo.tr");
    return u.searchParams.get("token") || u.searchParams.get("t") || "";
  } catch {
    return "";
  }
}

function looksLikeHtmlRequest(req) {
  const accept = String(req.headers["accept"] || "");
  // Mail linki -> browser genelde text/html ister
  return accept.includes("text/html") || accept.includes("application/xhtml+xml") || accept.includes("*/*");
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

// ==== MAIN ====
module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const token = getTokenFromReq(req);
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    // Token KV anahtarı (birden fazla ihtimali dene)
    const keyCandidates = [
      `verify:${token}`,
      `auth:verify:${token}`,
      `auth_verify:${token}`,
      `email_verify:${token}`,
      `verifyToken:${token}`,
      token, // en kötü ihtimal: token direkt key olarak yazılmış olabilir
    ];

    let foundKey = "";
    let rec = null;

    for (const k of keyCandidates) {
      const v = await kvGetJson(k);
      if (v != null) {
        foundKey = k;
        rec = v;
        break;
      }
    }

    if (!rec) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(400).json({ ok: false, error: "invalid_or_expired_token" });
    }

    // rec farklı formatlarda olabilir:
    // { email, exp } veya { email, expiresAt } veya string email
    let email = "";
    let exp = 0;

    if (typeof rec === "string") {
      email = normalizeEmail(rec);
    } else if (typeof rec === "object") {
      email = normalizeEmail(rec.email || rec.to || rec.userEmail);
      exp = Number(rec.exp || rec.expiresAt || rec.expires || 0) || 0;
    } else {
      email = "";
    }

    if (!email || !email.includes("@")) {
      // bozuk token kaydı
      res.setHeader("Cache-Control", "no-store");
      return res.status(400).json({ ok: false, error: "token_record_invalid" });
    }

    // süre kontrolü (exp saniye timestamp ise)
    if (exp && Math.floor(Date.now() / 1000) > exp) {
      // tokenı temizle
      if (foundKey) await kvDel(foundKey).catch(() => {});
      res.setHeader("Cache-Control", "no-store");
      return res.status(400).json({ ok: false, error: "invalid_or_expired_token" });
    }

    // User kaydı (varsa bul, yoksa oluştur)
    const userKeyCandidates = [`user:${email}`, `users:${email}`];
    let userKey = userKeyCandidates[0];
    let user = null;

    for (const uk of userKeyCandidates) {
      const u = await kvGetJson(uk);
      if (u) {
        userKey = uk;
        user = u;
        break;
      }
    }

    const created = !user;
    if (!user || typeof user !== "object") {
      user = { id: uuid(), email, createdAt: new Date().toISOString() };
    }

    user.email = email;
    user.verified = true;
    user.verifiedAt = new Date().toISOString();

    // kaydet (hem user: hem users: yazmak istersen ikisini de yazabilirsin; burada tek key kullanıyorum)
    await kvSetJson(userKey, user);

    // token tek kullanımlık: sil
    if (foundKey) await kvDel(foundKey).catch(() => {});

    // session cookie set (AUTO LOGIN)
    const role = isAdminEmail(email) ? "admin" : "user";
    const sessionToken = setSessionCookie(req, res, email, role);

    res.setHeader("Cache-Control", "no-store");

    // Browser’dan geliyorsa redirect (mail link)
    const html = looksLikeHtmlRequest(req);
    const q = req.query || {};
    const wantJson = String(q.json || "") === "1" || String(q.format || "") === "json";

    if (html && !wantJson) {
      // Studio route’un sende rewrite ile /studio olabilir
      const location = "/studio?verified=1";
      res.statusCode = 302;
      res.setHeader("Location", location);
      return res.end();
    }

    // API olarak çağırıyorsan JSON
    return res.status(200).json({
      ok: true,
      verified: true,
      user: { id: user.id, email, created },
      role,
      token: sessionToken, // debug/opsiyonel
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
