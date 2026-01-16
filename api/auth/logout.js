// /api/auth/logout.js
const COOKIE_NAME = "aivo_session";

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const proto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = proto.includes("https");

    // Host-only + ayrıca subdomain ihtimaline karşı Domain'li iki farklı Set-Cookie gönderiyoruz.
    const base = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isHttps) base.push("Secure");

    const cookie1 = base.join("; ");                    // host-only (aivo.tr)
    const cookie2 = base.concat("Domain=.aivo.tr").join("; "); // www vs. için

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", [cookie1, cookie2]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
