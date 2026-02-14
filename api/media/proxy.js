// api/media/proxy.js
import { Readable } from "stream";

export default async function handler(req, res) {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,OPTIONS");
      res.setHeader("access-control-allow-headers", "Range,Content-Type");
      res.setHeader(
        "access-control-expose-headers",
        "Content-Type,Content-Length,Content-Range,Accept-Ranges,Cache-Control,ETag,Last-Modified"
      );
      return res.status(204).end();
    }

    let url = req.query.url;
    if (Array.isArray(url)) url = url[0];

    if (!url) return res.status(400).send("missing_url");

    // tolerate already-encoded values (avoid throwing on %)
    try {
      if (/%[0-9A-Fa-f]{2}/.test(url)) url = decodeURIComponent(url);
    } catch {
      // ignore decode errors, fall back to raw
    }

    if (!/^https?:\/\//i.test(url)) return res.status(400).send("invalid_url");

    // allow only known hosts (security)
    const allowedHosts = new Set([
      // ✅ include BOTH to avoid typos breaking prod
      "dnznrvs05pmza.cloudfront.net",
      "d2fnzrnvs0bpmza.cloudfront.net",

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
    // Range forward for video seeking
    if (req.headers.range) headers["range"] = req.headers.range;

    const upstream = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });

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
    res.setHeader(
      "access-control-expose-headers",
      "Content-Type,Content-Length,Content-Range,Accept-Ranges,Cache-Control,ETag,Last-Modified"
    );

    // stream body (avoid buffering whole mp4 in memory)
    if (!upstream.body) return res.end();

    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on("error", () => res.end());
    return nodeStream.pipe(res);
  } catch (e) {
    return res.status(500).send("proxy_failed: " + String(e?.message || e));
  }
}
