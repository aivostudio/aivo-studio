// /api/paytr/fail.js
export default function handler(req, res) {
  const baseUrl = process.env.APP_BASE_URL || "";
  const oid = encodeURIComponent(String(req.query?.oid || ""));

  res.writeHead(302, {
   Location: `${baseUrl}/studio.v2.html#checkout?paytr=fail&oid=${oid}`,
  });
  res.end();
}
