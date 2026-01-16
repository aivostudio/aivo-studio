// /api/auth/logout.js
const COOKIE_NAME = "aivo_session";

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const isProd = process.env.NODE_ENV === "production";

    const base = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "HttpOnly",
      "SameSite=Lax",
    ];

    if (isProd) base.push("Secure");

    const hostOnly = base.join("; ");
    const domainRootDot = base.concat("Domain=.aivo.tr").join("; ");
    const domainRoot = base.concat("Domain=aivo.tr").join("; ");
    const domainWww = base.concat("Domain=www.aivo.tr").join("; ");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", [hostOnly, domainRootDot, domainRoot, domainWww]);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
