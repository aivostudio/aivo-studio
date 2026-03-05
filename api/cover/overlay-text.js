// FILE: api/cover/overlay-text.js
import sharp from "sharp";

function escapeXml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { imageUrl, artist, title } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: "imageUrl gerekli" });
    }

    const artistText = escapeXml((artist || "").trim().toUpperCase());
    const titleText = escapeXml((title || "").trim());

    // resmi indir
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Not: Vercel'de custom font yok -> sadece güvenli sistem fontları
    // Spotify/Apple Music uyumlu: üstte title büyük, altta artist küçük
    const W = 768;
    const H = 768;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- Üstte okunurluk için hafif gradient -->
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="55%" stop-color="rgba(0,0,0,0.00)"/>
    </linearGradient>

    <!-- Yumuşak gölge -->
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
      <feOffset dx="0" dy="3" result="off"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.55"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Üst overlay -->
  <rect x="0" y="0" width="${W}" height="${Math.round(H * 0.34)}" fill="url(#topFade)"/>

  <!-- TITLE -->
  <text
    x="${W / 2}"
    y="128"
    text-anchor="middle"
    dominant-baseline="middle"
    filter="url(#softShadow)"
    style="
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 900;
      font-size: 84px;
      letter-spacing: 1px;
      fill: #F6E7C8;
    "
  >${titleText}</text>

  <!-- ARTIST -->
  <text
    x="${W / 2}"
    y="210"
    text-anchor="middle"
    dominant-baseline="middle"
    filter="url(#softShadow)"
    style="
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 700;
      font-size: 34px;
      letter-spacing: 4px;
      fill: rgba(255,255,255,0.92);
    "
  >${artistText}</text>
</svg>
`;

    const final = await sharp(imgBuffer)
      .resize(W, H, { fit: "cover" })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(final);
  } catch (e) {
    console.error("[overlay-text] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
