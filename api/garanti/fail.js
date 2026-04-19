export default async function handler(req, res) {
  const oid =
    String(
      req.query?.oid ||
      req.body?.oid ||
      ""
    ).trim();

  const location = oid
    ? `/checkout.html?garanti=fail&oid=${encodeURIComponent(oid)}`
    : `/checkout.html?garanti=fail`;

  res.statusCode = 303;
  res.setHeader("Location", location);
  res.end();
}
