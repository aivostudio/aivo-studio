// api/cover/overlay-text.js
export const config = { runtime: "nodejs" };

import sharp from "sharp";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { imageUrl, artist, title } = req.body || {};

    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: "imageUrl gerekli" });
    }

    const artistText = (artist || "").toUpperCase().trim();
    const titleText = (title || "").trim();

    // resmi indir
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // SVG overlay (Spotify style)
    // Not: SVG içinde user input kullanıyoruz; minimal kaçış uyguluyoruz.
    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const svg = `
<svg width="768" height="768" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <style>
    .artist {
      font-family: Montserrat, Arial, sans-serif;
      font-size: 72px;
      font-weight: 800;
      letter-spacing: 1px;
      fill: #ffffff;
      text-anchor: middle;
    }
    .title {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 48px;
      font-style: italic;
      fill: #ffffff;
      text-anchor: middle;
    }
  </style>

  <!-- subtle top gradient plate for readability -->
  <rect x="0" y="0" width="768" height="260" fill="rgba(0,0,0,0.18)"/>

  <!-- text (shadow filter) -->
  <g filter="url(#shadow)">
    <text x="384" y="120" class="artist">${esc(artistText)}</text>
    <text x="384" y="190" class="title">${esc(titleText)}</text>
  </g>
</svg>
`;

    const final = await sharp(imgBuffer)
      .resize(768, 768, { fit: "cover" })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(final);
  } catch (e) {
    console.error("cover/overlay-text error:", e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Server error" });
  }
}
