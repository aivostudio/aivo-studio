import jwt from "jsonwebtoken";
import cookie from "cookie";

export default async function handler(req, res) {
  try {
    // Sadece GET
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false });
    }

    // Cookie oku
    const cookies = cookie.parse(req.headers.cookie || "");
    const token = cookies.aivo_session;

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "no_session",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "jwt_secret_missing",
      });
    }

    // JWT doğrula
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // email JWT içinden gelir
    const email = payload.email;

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "invalid_session",
      });
    }

    // ŞİMDİLİK SABİT (ileride DB)
    return res.json({
      ok: true,
      email,
      credits: 0,
    });

  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: "invalid_or_expired_session",
    });
  }
}
