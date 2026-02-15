// api/media/proxy.js
// CommonJS - Vercel Serverless

const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  "dnznrvs05pmza.cloudfront.net", // Runway CDN
  "file-examples.com",           // test için
]);

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) {
      return res.status(400).json({ ok: false, error: "missing_url" });
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_url" });
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return res.status(400).json({ ok: false, error: "url_not_allowed" });
    }

    const range = req.headers.range || undefined;

    const upstream = await fetch(rawUrl, {
      headers: range ? { Range: range } : {},
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({
        ok: false,
        error: "upstream_failed",
        status: upstream.status,
      });
    }

    res.status(range ? 206 : 200);

    // forward important headers
    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error("proxy_error:", err);
    return res.status(500).json({ ok: false, error: "proxy_failed" });
  }
};
