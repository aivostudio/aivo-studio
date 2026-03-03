// api/media/archive-r2.js
// Vercel Serverless (CommonJS)
// Amaç: dış mp3/wav URL -> R2'ye kopyala (presign-put ile) ve public_url döndür
// Kullanım: POST { url, filename?, folder?, contentType? }

const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  // replicate delivery (stems)
  "replicate.delivery",
  "cdn.replicate.delivery",

  // runway signed cloudfront
  "dnznrvs05pmza.cloudfront.net",

  // R2 custom domain (outputs) - gerekirse kaynak oradan da alınabilir
  "media.aivo.tr",

  // test
  "file-examples.com",
  "www.file-examples.com",
]);

function safeName(s) {
  return String(s || "")
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 180);
}

function safeFolder(s) {
  // folder için "/" istemiyoruz; sadece basit slug
  return String(s || "stems")
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "stems";
}

function guessContentTypeByName(name) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".mp3")) return "audio/mpeg";
  return "";
}

module.exports = async (req, res) => {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const rawUrl = String(body.url || body.source_url || "").trim();
    if (!rawUrl) return res.status(400).json({ ok: false, error: "missing_url" });

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

    // İsim / klasör
    const folder = safeFolder(body.folder || "stems");
    const filename = safeName(body.filename || "audio.wav");
    const extCt = guessContentTypeByName(filename);

    // Content-Type: body.contentType > filename'den tahmin > upstream header
    let contentType = String(body.contentType || "").trim() || extCt;

    // 1) Kaynağı çek
    const upstream = await fetch(rawUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "aivo-archive/1.0",
      },
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      return res.status(502).json({
        ok: false,
        error: "upstream_fetch_failed",
        upstream_status: upstream.status,
        upstream_preview: String(txt || "").slice(0, 600),
      });
    }

    const upstreamCT = upstream.headers.get("content-type") || "";
    if (!contentType && upstreamCT) contentType = upstreamCT;

    if (!contentType) contentType = "application/octet-stream";

    const upstreamLen = upstream.headers.get("content-length");
    const contentLength = upstreamLen && /^\d+$/.test(upstreamLen) ? upstreamLen : "";

    // 2) R2 presign al
    // presign-put beklenen: { filename, contentType, key? }
    const key = `outputs/${folder}/${Date.now()}-${filename}`;

    const pres = await fetch("https://aivo.tr/api/r2/presign-put", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        filename,
        contentType,
        key,
      }),
    });

    const presJ = await pres.json().catch(() => null);

    if (!pres.ok || !presJ || !presJ.ok) {
      return res.status(500).json({
        ok: false,
        error: "presign_failed",
        presign_status: pres.status,
        presign_response: presJ,
      });
    }

    // ✅ BURASI: upload_url/public_url değişkenlerini doğru al
    const { upload_url, public_url, key: outKey } = presJ;

    if (!upload_url || !public_url) {
      return res.status(500).json({
        ok: false,
        error: "presign_missing_urls",
        presign_response: presJ,
      });
    }

    const uploadUrl = String(upload_url);
    const publicUrl = String(public_url);
    const finalKey = String(outKey || key);

    // 3) Stream ederek R2'ye PUT
    const putHeaders = { "Content-Type": contentType };
    if (contentLength) putHeaders["Content-Length"] = contentLength;

    let putResp;

    if (upstream.body) {
      // ✅ Node fetch stream gönderirken duplex şart
      putResp = await fetch(uploadUrl, {
        method: "PUT",
        duplex: "half",
        headers: putHeaders,
        body: upstream.body,
      });
    } else {
      // fallback
      const buf = Buffer.from(await upstream.arrayBuffer());
      putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { ...putHeaders, "Content-Length": String(buf.length) },
        body: buf,
      });
    }

    if (!putResp.ok) {
      const t = await putResp.text().catch(() => "");
      return res.status(502).json({
        ok: false,
        error: "r2_put_failed",
        r2_status: putResp.status,
        r2_preview: String(t || "").slice(0, 600),
        key: finalKey,
      });
    }

    return res.status(200).json({
      ok: true,
      key: finalKey,
      contentType,
      contentLength: contentLength || null,
      public_url: publicUrl,
      source_url: rawUrl,
    });
  } catch (err) {
    console.error("archive_r2_error:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
};
