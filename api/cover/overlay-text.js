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

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const W = 1024;
    const H = 1024;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="55%" stop-color="rgba(0,0,0,0.00)"/>
    </linearGradient>

    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="black" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${Math.round(H * 0.35)}" fill="url(#topFade)"/>

  <text
    x="${W/2}"
    y="180"
    text-anchor="middle"
    filter="url(#shadow)"
    style="
      font-family: DejaVu Sans, Liberation Sans, Arial, sans-serif;
      font-weight: 900;
      font-size: 120px;
      letter-spacing: 2px;
      fill: #F6E7C8;
      stroke: rgba(0,0,0,0.6);
      stroke-width: 6px;
      paint-order: stroke fill;
    "
  >${titleText}</text>

  <text
    x="${W/2}"
    y="300"
    text-anchor="middle"
    filter="url(#shadow)"
    style="
      font-family: DejaVu Sans, Liberation Sans, Arial, sans-serif;
      font-weight: 700;
      font-size: 48px;
      letter-spacing: 6px;
      fill: rgba(255,255,255,0.95);
      stroke: rgba(0,0,0,0.5);
      stroke-width: 3px;
      paint-order: stroke fill;
    "
  >${artistText}</text>
</svg>
`;

    const final = await sharp(imgBuffer)
      .resize(W, H, { fit: "cover" })
      .composite([{ input: Buffer.from(svg) }])
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
