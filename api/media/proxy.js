// api/media/proxy.js
import { Readable } from "node:stream";

export default async function handler(req, res) {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,OPTIONS");
      res.setHeader("access-control-allow-headers", "Range,Content-Type");
      return res.status(204).end();
    }

    // url param (string | array) güvenli parse
    const raw = req.query.url ?? req.query.u;
    const url = Array.isArray(raw) ? raw[0] : raw;

    if (!url) return res.status(400).send("missing_url");
    if (typeof url !== "string") return res.status(400).send("invalid_url");
    if (!/^https?:\/\//i.test(url)) return res.status(400).send("invalid_url");

    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return res.status(400).send("bad_url");
    }

    // ✅ Host allowlist (CloudFront dağıtımı değişebildiği için pattern)
    const allowedHostPatterns = [
      /\.cloudfront\.net$/i,
      /^storage\.googleapis\.com$/i,
      /\.runwayml\.com$/i,
    ];

    const okHost = allowedHostPatterns.some((re) => re.test(host));
    if (!okHost) return res.status(403).send("host_not_allowed");

    // Range forward (seek için şart)
    const headers = {};
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
    res.setHeader("access-control-expose-headers", "Content-Range,Accept-Ranges,Content-Length");

    // stream body (bufferlama yok -> büyük mp4’te 500 riskini azaltır)
    if (!upstream.body) return res.end();
    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on("error", () => {
      try { res.end(); } catch {}
    });
    return nodeStream.pipe(res);
  } catch (e) {
    return res.status(500).send("proxy_failed: " + String(e?.message || e));
  }
}
