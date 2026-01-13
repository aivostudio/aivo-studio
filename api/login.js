// api/login.js
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET; // Vercel Env'e ekle
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { email } = req.body || {};
    const userEmail = String(email || "").trim().toLowerCase();
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    // JWT payload
    const token = jwt.sign(
      { sub: userEmail, email: userEmail },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Cookie set
    res.setHeader("Set-Cookie", [
     ${COOKIE_NAME}=${token}; Path=/; Domain=.aivo.tr; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax

    ]);

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
