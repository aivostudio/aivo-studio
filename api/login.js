// /api/login.js
const crypto = require("crypto");
const { onAuthLogin } = require("./_events/auth"); // event hub

const COOKIE_NAME = "aivo_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün (saniye)
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
  const s = signHS256(data, secret);
  return `${data}.${s}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const role = isAdminEmail(email) ? "admin" : "user";

    // JWT payload
    const now = Math.floor(Date.now() / 1000);
    const token = makeJWT(
      {
        sub: email,
        email,
        role,
        iat: now,
        exp: now + COOKIE_MAX_AGE,
      },
      JWT_SECRET
    );

    // HTTPS mi? (Vercel/Proxy arkasında)
    const proto = (req.headers["x-forwarded-proto"] || "").toString();
    const isHttps = proto.includes("https");

    // Cookie set (Secure sadece HTTPS’te)
    const cookieParts = [
      `${COOKIE_NAME}=${token}`,
      "Path=/",
      `Max-Age=${COOKIE_MAX_AGE}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isHttps) cookieParts.push("Secure");

    res.setHeader("Set-Cookie", cookieParts.join("; "));

    // ✅ ÖNCE HEMEN DÖN (pending biter)
    res.status(200).json({ ok: true, email, role });

    // ✅ Event: asla await etme (arkada dene, takılsa da login dönmüş olur)
    try {
      const ip =
        (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
        (req.socket && req.socket.remoteAddress) ||
        "";
      const userAgent = (req.headers["user-agent"] || "").toString();

      Promise.resolve(
        onAuthLogin({
          userId: email,
          email,
          role,
          ip,
          userAgent,
          at: new Date(),
        })
      ).catch(() => {});
    } catch (_) {
      // sessiz
    }

    return;
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }
};
