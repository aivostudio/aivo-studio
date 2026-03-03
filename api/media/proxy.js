// api/media/proxy.js
// CommonJS - Vercel Serverless
// Range destekli proxy (mp4 stream için şart) + download=1 için attachment indir

const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  "dnznrvs05pmza.cloudfront.net", // runway signed cloudfront
  "media.aivo.tr",                // R2 custom domain (outputs)
  "replicate.delivery",           // ✅ stems / replicate output
  "file-examples.com",            // test
  "www.file-examples.com",        // test
]);

function safeFilename(s, fallback = "file.bin") {
  const name = String(s || "").trim();
  if (!name) return fallback;
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function guessContentType(urlStr, upstreamCT) {
  const ct = String(upstreamCT || "").toLowerCase();
  if (ct && !ct.includes("application/json")) return upstreamCT;

  const u = String(urlStr || "").toLowerCase();
  if (u.includes(".mp3")) return "audio/mpeg";
  if (u.includes(".wav")) return "audio/wav";
  if (u.includes(".m4a")) return "audio/mp4";
  if (u.includes(".mp4")) return "video/mp4";
  return upstreamCT || "application/octet-stream";
}

module.exports = async (req, res) => {
  try {
    // ✅ CORS (Safari/Chrome sorunsuz)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range,Content-Type");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).end("method_not_allowed");
    }

    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) {
      return res.status(400).end("missing_url");
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).end("invalid_url");
    }

    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).end("invalid_protocol");
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      // ⚠️ JSON dönmeyelim, Safari proxy.json diye indiriyor
      return res.status(403).end("url_not_allowed");
    }

    const range = req.headers.range;

    const upstream = await fetch(rawUrl, {
      method: req.method,
      headers: range ? { Range: range } : {},
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status);
      const txt = await upstream.text().catch(() => "");
      return res.end(txt || "upstream_error");
    }

    res.status(upstream.status);

    // Content-Type
    const upstreamCT = upstream.headers.get("content-type");
    const ct = guessContentType(rawUrl, upstreamCT);
    if (ct) res.setHeader("Content-Type", ct);

    // Content-Length / Range headers
    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);

    const cr = upstream.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);

    const ar = upstream.headers.get("accept-ranges");
    if (ar) res.setHeader("Accept-Ranges", ar);
    else res.setHeader("Accept-Ranges", "bytes");

    res.setHeader("Cache-Control", "no-store");

    // ✅ download=1 ise: dosya gibi indir (sekme açtırma / proxy.json değil)
    const isDownload = String(req.query.download || "") === "1";
    if (isDownload) {
      const fn = safeFilename(req.query.filename, "audio.mp3");
      res.setHeader("Content-Disposition", `attachment; filename="${fn}"`);
    }

    if (req.method === "HEAD") {
      return res.end();
    }

    if (!upstream.body) {
      return res.end();
    }

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
