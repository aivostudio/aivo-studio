/* =========================================================
   1) api/_events/auth.js  (veya global auth middleware'in neredeyse orası)
   Proxy endpointini AUTH'tan muaf tut.
   ========================================================= */

export default async function authEvent(req, res, next) {
  try {
    const url = new URL(req.url, "http://local"); // req.url relative olabilir
    const pathname = url.pathname || "";

    // ✅ media proxy public kalsın (video tag istekleri 401 yemesin)
    if (pathname.startsWith("/api/media/proxy")) {
      return next(); // veya senin yapında "return handler(req,res)" neyse
    }

    // ... mevcut auth/guard mantığın aynen devam
    return next();
  } catch (e) {
    // fallback: auth çökmesin
    return next();
  }
}


/* =========================================================
   2) api/media/proxy.js
   allowedHosts listesine doğru cloudfront hostlarını ekle.
   ========================================================= */

// api/media/proxy.js
export default async function handler(req, res) {
  try {
    const url = req.query.url;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,OPTIONS");
      res.setHeader("access-control-allow-headers", "Range,Content-Type");
      return res.status(204).end();
    }

    if (!url) return res.status(400).send("missing_url");
    if (!/^https?:\/\//i.test(url)) return res.status(400).send("invalid_url");

    // allow only known hosts (security)
    const allowedHosts = new Set([
      // ✅ doğru olan (konsoldaki)
      "dnznrvs05pmza.cloudfront.net",
      // ✅ bazen farklı dağıtım/yanlış yazım olursa diye (zararsız)
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
    // video seek için Range forward
    if (req.headers.range) headers["range"] = req.headers.range;

    const upstream = await fetch(url, { method: "GET", headers });

    res.status(upstream.status);

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

    res.setHeader("access-control-allow-origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (e) {
    return res.status(500).send("proxy_failed: " + String(e?.message || e));
  }
}
