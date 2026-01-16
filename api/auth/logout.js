// /api/auth/logout.js
const COOKIE_NAME = "aivo_session";

module.exports = async (req, res) => {
  try {
    // GET/POST fark etmesin
    const proto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = proto.includes("https");

    const base = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "Max-Age=0",
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isHttps) base.push("Secure");

    // Bazı tarayıcılar Expires ister (ek garanti)
    const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT";

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", base.join("; ") + "; " + expires);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
