// api/cover/overlay-text.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { imageUrl, artist, title } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: "imageUrl gerekli" });
    }

    const artistText = String(artist || "").trim().toUpperCase();
    const titleText = String(title || "").trim();

    // Fontu oku ve base64'e çevir
    const fontPath = path.join(process.cwd(), "api/cover/fonts/NotoSans-Bold.ttf");
    const fontBase64 = fs.readFileSync(fontPath).toString("base64");

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
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">

  <defs>

    <style>
      @font-face {
        font-family: "CoverFont";
        src: url(data:font/truetype;base64,${fontBase64}) format("truetype");
        font-weight: 700;
      }
    </style>

    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#08111d" stop-opacity="0.92"/>
      <stop offset="50%" stop-color="#08111d" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#08111d" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe7a3"/>
      <stop offset="45%" stop-color="#f7c861"/>
      <stop offset="100%" stop-color="#c98a23"/>
    </linearGradient>

    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
    </filter>

    <filter id="hardShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="8" flood-color="#000000" flood-opacity="0.6"/>
    </filter>

  </defs>

  <rect x="0" y="0" width="1024" height="360" fill="#08111d" opacity="0.55"/>
  <rect x="0" y="0" width="1024" height="360" fill="url(#topFade)"/>

  ${
    ${
    titleText
      ? `
  <g filter="url(#hardShadow)">
    <text
      x="512"
      y="132"
      text-anchor="middle"
      font-family="CoverFont"
      font-size="132"
      font-style="italic"
      font-weight="700"
      letter-spacing="1"
      fill="#ffd79a"
      stroke="#b44f7b"
      stroke-width="14"
      paint-order="stroke fill"
      transform="rotate(-3 512 132)"
    >${esc(titleText)}</text>

    <text
      x="512"
      y="132"
      text-anchor="middle"
      font-family="CoverFont"
      font-size="132"
      font-style="italic"
      font-weight="700"
      letter-spacing="1"
      fill="none"
      stroke="#fff1cc"
      stroke-opacity="0.55"
      stroke-width="4"
      transform="rotate(-3 512 132)"
    >${esc(titleText)}</text>
  </g>
      `
      : ""
  }

  ${
    artistText
      ? `
  <g filter="url(#hardShadow)">
    <text
      x="512"
      y="210"
      text-anchor="middle"
      font-family="CoverFont"
      font-size="48"
      font-weight="700"
      letter-spacing="3"
      fill="url(#goldFill)"
      stroke="#5a2f00"
      stroke-width="4"
      paint-order="stroke fill"
    >${esc(artistText)}</text>

    <text
      x="512"
      y="210"
      text-anchor="middle"
      font-family="CoverFont"
      font-size="48"
      font-weight="700"
      letter-spacing="3"
      fill="none"
      stroke="#ffefbf"
      stroke-opacity="0.55"
      stroke-width="2"
    >${esc(artistText)}</text>
  </g>
      `
      : ""
  }

</svg>
`;

    const final = await sharp(imgBuffer)
      .resize(1024, 1024, { fit: "cover" })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 96 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(final);

  } catch (e) {
    console.error("cover/overlay-text error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
};
