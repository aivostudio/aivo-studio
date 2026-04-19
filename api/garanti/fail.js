// /api/garanti/fail.js
export default async function handler(req, res) {
  const oid = String(req.query?.oid || "").trim();
  const qs = new URLSearchParams();

  qs.set("garanti", "fail");
  if (oid) qs.set("oid", oid);

  return res.redirect(`/checkout.html?${qs.toString()}`);
}
