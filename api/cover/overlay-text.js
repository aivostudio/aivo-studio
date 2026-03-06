// api/cover/overlay-text.js
export const config = { runtime: "nodejs" };

import sharp from "sharp";
import opentype from "opentype.js";
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

    const artistText = String(artist || "").toUpperCase().trim();
    const titleText = String(title || "").trim();

    // resmi indir
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // local font dosyaları
    const sansFontPath = path.join(process.cwd(), "api", "cover", "fonts", "NotoSans-Bold.ttf");
    const serifFontPath = path.join(process.cwd(), "api", "cover", "fonts", "NotoSerif-Italic.ttf");

    const [sansFontBuf, serifFontBuf] = await Promise.all([
      readFile(sansFontPath),
      readFile(serifFontPath),
    ]);

    // opentype parse için doğru ArrayBuffer slice
    const sansFont = opentype.parse(
      sansFontBuf.buffer.slice(
        sansFontBuf.byteOffset,
        sansFontBuf.byteOffset + sansFontBuf.byteLength
      )
    );

    const serifFont = opentype.parse(
      serifFontBuf.buffer.slice(
        serifFontBuf.byteOffset,
        serifFontBuf.byteOffset + serifFontBuf.byteLength
      )
    );

    function buildCenteredPath(font, text, fontSize, centerX, baselineY) {
      if (!text) return "";
      const glyphPath = font.getPath(text, 0, 0, fontSize);
      const box = glyphPath.getBoundingBox();
      const width = box.x2 - box.x1;
      const offsetX = centerX - (width / 2) - box.x1;
      const offsetY = baselineY;
      return glyphPath.toPathData(2).replace(
        /^/,
        `M0 0 `
      ), { pathData: glyphPath.toPathData(2), offsetX, offsetY };
    }

    const artistSize = 54;
    const titleSize = 82;

    const artistGlyph = artistText ? sansFont.getPath(artistText, 0, 0, artistSize) : null;
    const titleGlyph = titleText ? serifFont.getPath(titleText, 0, 0, titleSize) : null;

    const artistBox = artistGlyph ? artistGlyph.getBoundingBox() : null;
    const titleBox = titleGlyph ? titleGlyph.getBoundingBox() : null;

    const artistWidth = artistBox ? (artistBox.x2 - artistBox.x1) : 0;
    const titleWidth = titleBox ? (titleBox.x2 - titleBox.x1) : 0;

    const artistOffsetX = artistBox ? 384 - (artistWidth / 2) - artistBox.x1 : 0;
    const titleOffsetX = titleBox ? 384 - (titleWidth / 2) - titleBox.x1 : 0;

    const artistPathData = artistGlyph ? artistGlyph.toPathData(2) : "";
    const titlePathData = titleGlyph ? titleGlyph.toPathData(2) : "";

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
    ${artistPathData ? `<path d="${artistPathData}" fill="#ffffff" transform="translate(${artistOffsetX},112)" />` : ""}
    ${titlePathData ? `<path d="${titlePathData}" fill="#ffffff" transform="translate(${titleOffsetX},205)" />` : ""}
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
