// api/cover/overlay-text.js
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

    const artistText = (artist || "").toUpperCase();
    const titleText = title || "";

    // resmi indir
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // SVG overlay (Spotify style)
    const svg = `
    <svg width="768" height="768">
      <style>
        .artist {
          font-family: Montserrat, Arial, sans-serif;
          font-size: 72px;
          font-weight: 800;
          fill: white;
          text-anchor: middle;
        }
        .title {
          font-family: Playfair Display, serif;
          font-size: 48px;
          font-style: italic;
          fill: white;
          text-anchor: middle;
        }
      </style>

      <!-- shadow -->
      <text x="384" y="120" class="artist" fill="black" opacity="0.5"> ${artistText} </text>
      <text x="384" y="200" class="title" fill="black" opacity="0.5"> ${titleText} </text>

      <!-- main text -->
      <text x="384" y="110" class="artist"> ${artistText} </text>
      <text x="384" y="190" class="title"> ${titleText} </text>
    </svg>
    `;

    const final = await sharp(imgBuffer)
      .resize(768, 768)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    return res.status(200).send(final);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
