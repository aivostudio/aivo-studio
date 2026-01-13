const jwt = require("jsonwebtoken");

const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const token = jwt.sign(
      { sub: email, email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
