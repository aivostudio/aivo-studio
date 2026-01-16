// /api/auth/logout.js
const COOKIE_NAME = "aivo_session";

module.exports = (req, res) => {
  try {
    const proto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = proto.includes("https");

    const parts = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "Max-Age=0",
      "HttpOnly",
      "SameSite=Lax",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];
    if (isHttps) parts.push("Secure");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", parts.join("; "));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
