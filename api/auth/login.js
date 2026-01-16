LOGİN .JS 
—————


// /api/auth/login.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
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
