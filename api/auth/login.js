// /api/auth/logout.js  (SERVER-SIDE)
// Clears session cookie and returns {ok:true}

const COOKIE_NAME = "aivo_session";

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const proto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = proto.includes("https");

    // expire cookie
    const cookieParts = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "Max-Age=0",
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isHttps) cookieParts.push("Secure");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
