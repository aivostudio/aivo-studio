export default async function handler(req, res) {
  const oid = String(req.query?.oid || req.body?.oid || "").trim();
  const plan = String(req.query?.plan || req.body?.plan || "").trim();
  const price = String(req.query?.price || req.body?.price || "").trim();

  const qs = new URLSearchParams();
  qs.set("garanti", "fail");

  if (oid) qs.set("oid", oid);
  if (plan) qs.set("plan", plan);
  if (price) qs.set("price", price);

  res.statusCode = 303;
  res.setHeader("Location", `/checkout.html?${qs.toString()}`);
  res.end();
}
