// /api/garanti/ok.js
export default async function handler(req, res) {
  const oid = String(req.query?.oid || "").trim();
  const qs = new URLSearchParams();

  qs.set("garanti", "ok");
  if (oid) qs.set("oid", oid);

  res.statusCode = 303;
  res.setHeader("Location", `/checkout.html?${qs.toString()}`);
  res.end();
}
