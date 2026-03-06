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

    const artistText = String(artist || "").toUpperCase().trim();
    const titleText = String(title || "").trim();

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const svg = `
<svg width="768" height="768" viewBox="0 0 768 768" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.55"/>
    </filter>

    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="768" height="280" fill="url(#topFade)"/>

  <g filter="url(#shadow)">
    ${
      artistText
        ? `<text x="384" y="112"
            fill="#ffffff"
            font-size="54"
            font-weight="700"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif">${esc(artistText)}</text>`
        : ""
    }

    ${
      titleText
        ? `<text x="384" y="205"
            fill="#ffffff"
            font-size="82"
            font-style="italic"
            text-anchor="middle"
            font-family="Georgia, Times New Roman, serif">${esc(titleText)}</text>`
        : ""
    }
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
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
