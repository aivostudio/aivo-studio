export default function handler(req, res) {
  // Preflight (zararsız)
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Sadece gerçekten gerekenler
  const cookiesToClear = ["aivo_session"];

  const proto = String(req.headers["x-forwarded-proto"] || "");
  const isHttps = proto.includes("https");

  const host = String(req.headers.host || "");
  const apex = host.endsWith("aivo.tr") ? ".aivo.tr" : "";

  const baseAttrs = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isHttps) baseAttrs.push("Secure");

  const setCookies = [];
  for (const name of cookiesToClear) {
    // Domain’siz
    setCookies.push(`${name}=; ${baseAttrs.join("; ")}`);
    // Apex domain (www ↔ root garanti)
    if (apex) {
      setCookies.push(`${name}=; Domain=${apex}; ${baseAttrs.join("; ")}`);
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", setCookies);
  res.status(200).json({ ok: true });
}
