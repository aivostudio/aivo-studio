// api/media/proxy.js
// Vercel Serverless – Proper signed video proxy (Runway compatible)

const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  "dnznrvs05pmza.cloudfront.net", // Runway signed
  "media.aivo.tr",
  "file-examples.com",
  "www.file-examples.com",
]);

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      return res.end("method_not_allowed");
    }

    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) {
      res.statusCode = 400;
      return res.end("missing_url");
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.statusCode = 400;
      return res.end("invalid_url");
    }

    if (!/^https?:$/.test(parsed.protocol)) {
      res.statusCode = 400;
      return res.end("invalid_protocol");
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      res.statusCode = 403;
      return res.end("url_not_allowed");
    }

    // 🔥 Forward ALL critical headers for signed URLs
    const forwardHeaders = {};

    if (req.headers.range) forwardHeaders["Range"] = req.headers.range;
    if (req.headers["user-agent"]) forwardHeaders["User-Agent"] = req.headers["user-agent"];
    if (req.headers["referer"]) forwardHeaders["Referer"] = req.headers["referer"];
    if (req.headers["origin"]) forwardHeaders["Origin"] = req.headers["origin"];
    if (req.headers["accept"]) forwardHeaders["Accept"] = req.headers["accept"];

    const upstream = await fetch(rawUrl, {
      method: req.method,
      headers: forwardHeaders,
      redirect: "follow",
    });

    // pass upstream status
    res.statusCode = upstream.status;

    // forward important headers
    const headersToPass = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ];

    headersToPass.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    if (!upstream.ok && upstream.status !== 206) {
      const txt = await upstream.text().catch(() => "");
      return res.end(txt || "upstream_error");
    }

    if (req.method === "HEAD") {
      return res.end();
    }

    if (!upstream.body) {
      return res.end();
    }

    // Proper streaming
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }

    res.end();
  } catch (err) {
    console.error("proxy_error:", err);
    res.statusCode = 500;
    res.end("proxy_failed");
  }
};
