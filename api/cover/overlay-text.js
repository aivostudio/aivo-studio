// api/cover/overlay-text.js
export const config = { runtime: "nodejs" };

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
        const sansFontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");
    const serifFontPath = path.join(process.cwd(), "public", "fonts", "NotoSerif-Italic.ttf");

    const [sansFontBuf, serifFontBuf] = await Promise.all([
      readFile(sansFontPath),
      readFile(serifFontPath),
    ]);

    const sansFontBase64 = sansFontBuf.toString("base64");
    const serifFontBase64 = serifFontBuf.toString("base64");

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

    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.42)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.00)" />
    </linearGradient>
  </defs>

  <style>
    @font-face {
      font-family: "AivoSans";
      src: url("data:font/ttf;base64,${sansFontBase64}") format("truetype");
      font-weight: 700;
      font-style: normal;
    }

    @font-face {
      font-family: "AivoSerif";
      src: url("data:font/ttf;base64,${serifFontBase64}") format("truetype");
      font-weight: 400;
      font-style: italic;
    }

    .artist {
      font-family: "AivoSans";
      font-size: 54px;
      font-weight: 700;
      letter-spacing: 1.2px;
      fill: #ffffff;
      text-anchor: middle;
    }

    .title {
      font-family: "AivoSerif";
      font-size: 82px;
      font-style: italic;
      fill: #ffffff;
      text-anchor: middle;
    }
  </style>

  <rect x="0" y="0" width="768" height="280" fill="url(#topFade)"/>

  <g filter="url(#shadow)">
    <text x="384" y="112" class="artist">${esc(artistText)}</text>
    <text x="384" y="205" class="title">${esc(titleText)}</text>
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
