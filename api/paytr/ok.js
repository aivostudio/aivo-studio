
// /api/paytr/ok.js
export default function handler(req, res) {
  const baseUrl = process.env.APP_BASE_URL || "";
  const oid = encodeURIComponent(String(req.query?.oid || ""));

  // Not: Bu sadece redirect. Asıl doğrulama notify + verify ile yapılır.
  res.writeHead(302, {
    Location: `${baseUrl}/studio.html?page=checkout&paytr=ok&oid=${oid}`,
  });
  res.end();
}
