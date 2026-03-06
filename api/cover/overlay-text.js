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
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05070d" stop-opacity="0.70"/>
      <stop offset="32%" stop-color="#05070d" stop-opacity="0.30"/>
      <stop offset="62%" stop-color="#05070d" stop-opacity="0.00"/>
    </linearGradient>

    <linearGradient id="titleFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff6d8"/>
      <stop offset="100%" stop-color="#f6d58f"/>
    </linearGradient>

    <filter id="titleShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000000" flood-opacity="0.42"/>
    </filter>

    <filter id="artistShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.30"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${Math.round(H * 0.33)}" fill="url(#topFade)"/>

  <text
    x="${W / 2}"
    y="126"
    text-anchor="middle"
    filter="url(#titleShadow)"
    style="
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 900;
      font-size: 82px;
      font-style: italic;
      letter-spacing: 0.5px;
      fill: url(#titleFill);
      stroke: rgba(110,42,72,0.65);
      stroke-width: 4px;
      paint-order: stroke fill;
    "
  >${titleText}</text>

  <text
    x="${W / 2}"
    y="196"
    text-anchor="middle"
    filter="url(#artistShadow)"
    style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-weight: 800;
      font-size: 28px;
      letter-spacing: 6px;
      fill: rgba(255,245,220,0.96);
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
