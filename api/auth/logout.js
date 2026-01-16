// /api/logout.js
const COOKIE_NAME = "aivo_session";

function makeClearCookie({ domain, path, secure }) {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=${path || "/"}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

module.exports = (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");

    const proto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = proto.includes("https");

    const cookies = [];
    cookies.push(makeClearCookie({ path: "/", secure: isHttps }));
    cookies.push(makeClearCookie({ path: "/", secure: false }));
    cookies.push(makeClearCookie({ domain: "aivo.tr", path: "/", secure: isHttps }));
    cookies.push(makeClearCookie({ domain: ".aivo.tr", path: "/", secure: isHttps }));
    cookies.push(makeClearCookie({ domain: "aivo.tr", path: "/", secure: false }));
    cookies.push(makeClearCookie({ domain: ".aivo.tr", path: "/", secure: false }));
    cookies.push(makeClearCookie({ path: "/studio.html", secure: isHttps }));
    cookies.push(makeClearCookie({ path: "/studio.html", secure: false }));

    res.setHeader("Set-Cookie", cookies);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
