// api/media/proxy.js
// CommonJS - Vercel Serverless
// Range destekli video proxy (mp4 stream için şart)

const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  "dnznrvs05pmza.cloudfront.net", // runway signed cloudfront
  "media.aivo.tr",               // R2 custom domain (outputs)
  "file-examples.com",           // test
  "www.file-examples.com",       // test
]);

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
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

    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ ok: false, error: "invalid_protocol" });
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return res.status(403).json({
        ok: false,
        error: "url_not_allowed",
        host: parsed.hostname,
      });
    }

    const range = req.headers.range;

    const upstream = await fetch(rawUrl, {
      method: req.method,
      headers: range ? { Range: range } : {},
      redirect: "follow",
    });

    // upstream fail ise aynen geçir
    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status);
      const txt = await upstream.text().catch(() => "");
      return res.end(txt || "upstream_error");
    }

    // status forward
    res.status(upstream.status);

    // gerekli headerlar
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);

    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);

    const cr = upstream.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);

    const ar = upstream.headers.get("accept-ranges");
    if (ar) res.setHeader("Accept-Ranges", ar);
    else res.setHeader("Accept-Ranges", "bytes");

    res.setHeader("Cache-Control", "no-store");

    if (req.method === "HEAD") {
      return res.end();
    }

    if (!upstream.body) {
      return res.end();
    }

    // stream response (buffer değil, gerçek stream)
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }

    res.end();
  } catch (err) {
    console.error("proxy_error:", err);
    return res.status(500).end("proxy_failed");
  }
};
