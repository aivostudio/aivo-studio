// api/media/proxy.js
// CommonJS - Vercel API Route
// Amaç: Remote video/image URL'lerini güvenli şekilde stream etmek (Range destekli).
// Not: SSRF riskine karşı host whitelist var.

const ALLOWED_HOSTS = new Set([
  "dnznrvs05pmza.cloudfront.net", // senin örnek
  // İleride ihtiyaç olursa ekleyebiliriz:
  // "cdn.runwayml.com",
  // "storage.googleapis.com",
  // "fal.media",
  // "v3.fal.media",
  // vb.
]);

function isAllowedUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    if (!ALLOWED_HOSTS.has(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const raw = String(req.query.url || "").trim();
    if (!raw) return res.status(400).json({ ok: false, error: "url_required" });

    // url paramı zaten encodeURIComponent ile geliyorsa decode eder
    const target = decodeURIComponent(raw);

    if (!isAllowedUrl(target)) {
      return res.status(400).json({ ok: false, error: "url_not_allowed" });
    }

    // Video elementleri mutlaka Range ister; aynen forward ediyoruz
    const headers = {};
    const range = req.headers["range"];
    if (range) headers["range"] = range;

    // Bazı kaynaklar UA/Accept ile naz yapabiliyor
    headers["accept"] = req.headers["accept"] || "*/*";
    headers["user-agent"] = req.headers["user-agent"] || "aivo-proxy";

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      redirect: "follow",
    });

    // Upstream hata ise aynen geçir
    // (CloudFront Invalid JWT -> 403/401 gibi gelir)
    res.status(upstream.status);

    // CORS (same-origin’da şart değil ama media elementleri bazen ister)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Vary", "Origin");

    // Önemli header’ları forward et
    const passHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
      "cache-control",
    ];

    for (const h of passHeaders) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    // Proxy cevabını cache’leme (debug kolay)
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "HEAD") {
      return res.end();
    }

    // Node stream: upstream.body WebStream -> Node readable
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
    console.error("media/proxy error:", err);
    // JSON dönmeyelim; video elementleri bazen JSON görünce daha çok kafayı yiyor
    res.status(500).end("proxy_error");
  }
};
