// api/cover/overlay-text.js
const sharp = require("sharp");
const fetch = require("node-fetch");

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

  <!-- TOP AREA CLEANER (AI text suppression) -->
  <rect x="0" y="0" width="1024" height="360" fill="#08111d" opacity="0.55"/>
  <rect x="0" y="0" width="1024" height="360" fill="url(#topFade)"/>

  ${
    titleText
      ? `
  <g filter="url(#softShadow)">
    <text
      x="512"
      y="110"
      text-anchor="middle"
      font-family="Impact, Arial Black, Helvetica, sans-serif"
      font-size="120"
      font-weight="900"
      letter-spacing="2"
      fill="url(#goldFill)"
      stroke="#5a2f00"
      stroke-width="10"
      paint-order="stroke fill"
    >${esc(titleText)}</text>
  </g>
      `
      : ""
  }

  ${
  ${
  artistText
    ? `
<g filter="url(#hardShadow)">
  <text
    x="512"
    y="190"
    text-anchor="middle"
    font-family="Impact, Arial Black, Helvetica, sans-serif"
    font-size="46"
    font-weight="900"
    letter-spacing="3"
    fill="url(#goldFill)"
    stroke="#5a2f00"
    stroke-width="4"
    paint-order="stroke fill"
  >${esc(artistText)}</text>

  <text
    x="512"
    y="190"
    text-anchor="middle"
    font-family="Impact, Arial Black, Helvetica, sans-serif"
    font-size="46"
    font-weight="900"
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
}
