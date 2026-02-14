// api/media/proxy.js
export default async function handler(req, res) {
  try {
    const url = req.query.url;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,OPTIONS");
      res.setHeader("access-control-allow-headers", "Range,Content-Type");
      return res.status(204).end();
    }

    if (!url) return res.status(400).send("missing_url");
    if (!/^https?:\/\//i.test(url)) return res.status(400).send("invalid_url");

    // allow only known hosts (security)
    const allowedHosts = new Set([
      "dnznrvs05pmza.cloudfront.net",
      "storage.googleapis.com",
      "cdn.runwayml.com",
      "api.runwayml.com",
    ]);

    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return res.status(400).send("bad_url");
    }

    if (!allowedHosts.has(host)) {
      return res.status(403).send("host_not_allowed");
    }

    const headers = {};
    // 🔥 video seek için Range forward
    if (req.headers.range) headers["range"] = req.headers.range;

    const upstream = await fetch(url, { method: "GET", headers });

    // status
    res.status(upstream.status);

    // important headers
    const passHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
    ];

    passHeaders.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    // CORS
    res.setHeader("access-control-allow-origin", "*");

    // stream body
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (e) {
    return res.status(500).send("proxy_failed: " + String(e?.message || e));
  }
}
