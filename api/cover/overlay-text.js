const sharp = require("sharp");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { imageUrl, artist, title } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: "imageUrl gerekli" });
    }

    const titleText = String(title || "").trim();
    const artistText = String(artist || "").trim().toUpperCase();

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const W = 768;
    const H = 768;

    const base = sharp(imgBuffer).resize(W, H, { fit: "cover" });

    const layers = [];

    // ÜST GRADIENT (Spotify hissi)
    const gradientSvg = `
      <svg width="${W}" height="260">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="black" stop-opacity="0.65"/>
            <stop offset="60%" stop-color="black" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="black" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="260" fill="url(#g)"/>
      </svg>
    `;

    layers.push({
      input: Buffer.from(gradientSvg),
      top: 0,
      left: 0,
    });

   // TITLE
if (titleText) {
  const titlePng = await sharp({
    text: {
      text: titleText,
      width: W - 120,
      align: "centre",
      rgba: true,
      dpi: 300,
      font: "DejaVu Sans Bold",
    },
  })
    .png()
    .toBuffer();

  layers.push({
    input: titlePng,
    top: 52,
    left: 60,
  });
}

// ARTIST
if (artistText) {
  const artistPng = await sharp({
    text: {
      text: artistText,
      width: W - 160,
      align: "centre",
      rgba: true,
      dpi: 220,
      font: "DejaVu Sans Bold",
    },
  })
    .png()
    .toBuffer();

  layers.push({
    input: artistPng,
    top: 128,
    left: 80,
  });
}
