export default function handler(req, res) {
  // OPTIONS preflight (genelde şart değil ama zararsız)
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const cookiesToClear = ["session", "aivo_session", "connect.sid"];

  // HTTPS mi? (Vercel/Proxy arkasında x-forwarded-proto gelir)
  const proto = (req.headers["x-forwarded-proto"] || "").toString();
  const isHttps = proto.includes("https");

  // Host üzerinden domain türetme (ör: aivo.tr / www.aivo.tr)
  const host = (req.headers.host || "").toString();
  const apex =
    host.endsWith("aivo.tr") ? ".aivo.tr" : ""; // kendi domainin için pratik

  const baseAttrs = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isHttps) baseAttrs.push("Secure");

  // Aynı cookie’yi hem domain’siz hem Domain=.aivo.tr ile düşürmeye çalış
  const setCookies = [];
  for (const name of cookiesToClear) {
    setCookies.push(`${name}=; ${baseAttrs.join("; ")}`);
    if (apex) setCookies.push(`${name}=; Domain=${apex}; ${baseAttrs.join("; ")}`);
  }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Set-Cookie", setCookies);
  res.status(204).end();
}
