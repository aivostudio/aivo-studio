// api/media/proxy.js
// Public, auth-free media proxy with Range support (video/audio friendly)

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    const url = String(req.query.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      res.statusCode = 400;
      return res.end("missing_or_invalid_url");
    }

    // Forward Range (critical for <video> streaming)
    const headers = {};
    const range = req.headers["range"];
    if (range) headers["range"] = range;

    // Optional: forward user-agent
    if (req.headers["user-agent"]) headers["user-agent"] = req.headers["user-agent"];

    const upstream = await fetch(url, { headers, redirect: "follow" });

    // Pass through status (200 / 206 etc.)
    res.statusCode = upstream.status;

    // CORS (so browser is happy even if called cross-origin later)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, ETag");

    // Cache strategy (tune later)
    res.setHeader("Cache-Control", "public, max-age=3600");

    // Copy safe response headers
    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ];
    for (const h of passthrough) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    // HEAD -> no body
    if (req.method === "HEAD") return res.end();

    // Stream body
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.end(buf);
  } catch (e) {
    console.error("proxy_error", e);
    res.statusCode = 500;
    return res.end("proxy_error");
  }
};
