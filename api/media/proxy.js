// api/media/proxy.js
// CommonJS - Stable version

const https = require("https");
const http = require("http");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).end("Method Not Allowed");
      return;
    }

    const url = String(req.query.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).end("missing_or_invalid_url");
      return;
    }

    const client = url.startsWith("https") ? https : http;

    const options = new URL(url);

    if (req.headers.range) {
      options.headers = {
        Range: req.headers.range,
      };
    }

    const upstream = client.request(options, (upstreamRes) => {
      res.statusCode = upstreamRes.statusCode || 200;

      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Range, Accept-Ranges, ETag"
      );

      // Forward important headers
      const passthrough = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
      ];

      passthrough.forEach((h) => {
        const v = upstreamRes.headers[h];
        if (v) res.setHeader(h, v);
      });

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      upstreamRes.pipe(res);
    });

    upstream.on("error", (err) => {
      console.error("proxy_error:", err);
      res.status(500).end("proxy_error");
    });

    upstream.end();
  } catch (err) {
    console.error("proxy_crash:", err);
    res.status(500).end("proxy_crash");
  }
};
