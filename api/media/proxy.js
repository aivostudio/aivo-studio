// api/media/proxy.js
// CommonJS - Vercel Serverless
// Range destekli proxy (mp4/audio stream için şart)
// ✅ Download-friendly: Content-Disposition attachment + filename param
// ✅ Debug: X-AIVO-Proxy header

const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  "dnznrvs05pmza.cloudfront.net", // runway signed cloudfront
  "media.aivo.tr",                // R2 custom domain (outputs)
  "file-examples.com",            // test
  "www.file-examples.com",        // test

  // ✅ stems / replicate
  "replicate.delivery",
  "cdn.replicate.delivery",

  // ✅ FAL signed media
  "v3b.fal.media",
  "fal.media",
]);
function safeFilename(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  // keep it simple & safe for headers across browsers
  const cleaned = s
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  return cleaned;
}

function extFromContentType(ct) {
  if (!ct) return "";
  const t = ct.split(";")[0].trim().toLowerCase();
  if (t === "audio/mpeg") return ".mp3";
  if (t === "audio/wav" || t === "audio/x-wav" || t === "audio/wave") return ".wav";
  if (t === "audio/mp4" || t === "audio/aac") return ".m4a";
  if (t === "audio/ogg") return ".ogg";
  if (t === "video/mp4") return ".mp4";
  if (t === "application/octet-stream") return "";
  return "";
}

function pickFilename(reqFilename, urlObj, contentType) {
  // Priority: explicit query param > URL pathname basename > fallback
  const fromQuery = safeFilename(reqFilename);
  if (fromQuery) return fromQuery;

  let base = "";
  try {
    const p = String(urlObj.pathname || "");
    const last = p.split("/").filter(Boolean).pop() || "";
    base = safeFilename(decodeURIComponent(last));
  } catch {
    base = "";
  }

  if (!base) base = "download";

  // If no extension present, try to add from content-type
  const hasExt = /\.[a-z0-9]{1,6}$/i.test(base);
  if (!hasExt) {
    const ext = extFromContentType(contentType);
    if (ext) base += ext;
  }
  return base;
}

module.exports = async (req, res) => {
  try {
    // ✅ CORS (Safari/Chrome sorunsuz)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range,Content-Type");

    // ✅ Debug marker: confirms you're hitting THIS proxy route
    res.setHeader("X-AIVO-Proxy", "1");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

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

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status);
      const txt = await upstream.text().catch(() => "");
      return res.end(txt || "upstream_error");
    }

    res.status(upstream.status);

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

    // ✅ Force "download" instead of "open a new page"
    // UI can pass &filename=Vocals.wav (or .mp3, etc.)
    const reqFilename = req.query.filename;
    const filename = pickFilename(reqFilename, parsed, ct);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

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
