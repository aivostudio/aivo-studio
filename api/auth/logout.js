// /api/auth/logout.js
const COOKIE_NAME = "aivo_session";

function buildCookie({ value, maxAge, expires, domain, secure }) {
  const parts = [];
  parts.push(`${COOKIE_NAME}=${value}`);
  parts.push(`Path=/`);
  // domain opsiyonel ama prod'da bazen şart olur
  if (domain) parts.push(`Domain=${domain}`);
  parts.push(`HttpOnly`);
  parts.push(`SameSite=Lax`);
  if (secure) parts.push(`Secure`);
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  return parts.join("; ");
}

module.exports = (req, res) => {
  // CORS yoksa bile cache kapat
  res.setHeader("Cache-Control", "no-store");

  const secure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const past = new Date(0);

  // Birden fazla varyant göndermek en garantisi (domain/path mismatch yakalar)
  const cookies = [
    // host-only (domain yok)
    buildCookie({ value: "", maxAge: 0, expires: past, secure }),

    // domain'li denemeler (gerekirse)
    buildCookie({ value: "", maxAge: 0, expires: past, domain: "aivo.tr", secure }),
    buildCookie({ value: "", maxAge: 0, expires: past, domain: ".aivo.tr", secure }),
  ];

  res.setHeader("Set-Cookie", cookies);
  return res.status(200).json({ ok: true });
};
