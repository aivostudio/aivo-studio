const COOKIE_NAME = "aivo_session";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok:false });

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

  // 1) host-only clear
  const c1 = base.join("; ");

  // 2) domain clear (subdomain case)
  const c2 = [...base, "Domain=.aivo.tr"].join("; ");

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", [c1, c2]);
  return res.status(200).json({ ok: true });
};
