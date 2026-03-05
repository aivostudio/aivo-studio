// FILE: api/cover/overlay-text.js
import sharp from "sharp";

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeFontSizes(title, artist) {
  // Title: büyük & iddialı, uzunluk artınca küçülsün
  const tLen = (title || "").length;
  const aLen = (artist || "").length;

  // 1024x1024 cover için iyi baseline
  let titleSize = 132; // default
  let artistSize = 46; // default

  // Title küçültme
  if (tLen > 10) titleSize -= (tLen - 10) * 6;
  if (tLen > 18) titleSize -= (tLen - 18) * 4;

  // Artist küçültme
  if (aLen > 14) artistSize -= (aLen - 14) * 1.8;

  titleSize = clamp(Math.round(titleSize), 72, 132);
  artistSize = clamp(Math.round(artistSize), 28, 46);

  return { titleSize, artistSize };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { imageUrl, artist, title } = req.body || {};
    const url = (imageUrl || "").trim();
    if (!url) return res.status(400).json({ ok: false, error: "imageUrl gerekli" });

    const artistText = (artist || "").trim();
    const titleText = (title || "").trim();

    if (!artistText && !titleText) {
      // hiçbir şey basmayacaksak raw görseli döndürmek yerine hata verelim
      return res.status(400).json({ ok: false, error: "artist/title boş" });
    }

    // 1) resmi indir
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // 2) 1024x1024 normalize
    const base = sharp(imgBuffer).resize(1024, 1024, { fit: "cover" });

    // 3) Üst bölgede parlaklık ölç (auto-contrast)
    //    Top area: 0..260px
    const topStats = await base
      .clone()
      .extract({ left: 0, top: 0, width: 1024, height: 260 })
      .stats();

    const c = topStats.channels; // r,g,b,a
    const meanLum = (c[0].mean + c[1].mean + c[2].mean) / 3;

    const isTopBright = meanLum > 140;

    // 4) Renkler
    const textMain = isTopBright ? "#0B0B0D" : "#FFFFFF";
    const textSoft = isTopBright ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.45)";
    const scrimTop = isTopBright ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.42)";
    const scrimMid = isTopBright ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.18)";
    const scrimBot = "rgba(0,0,0,0)";

    // 5) Font size hesapla
    const { titleSize, artistSize } = computeFontSizes(titleText, artistText);

    // 6) SVG overlay (Spotify/iTunes vibe)
    const safeTitle = escapeXml(titleText);
    const safeArtist = escapeXml(artistText);

    // Yerleşim: üstte centered title, altında artist
    // max-width: 900px, metin ortalanmış
    const svg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topScrim" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${scrimTop}"/>
      <stop offset="0.65" stop-color="${scrimMid}"/>
      <stop offset="1" stop-color="${scrimBot}"/>
    </linearGradient>

    <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
      <feOffset dx="0" dy="6" result="offsetBlur"/>
      <feColorMatrix in="offsetBlur" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 ${isTopBright ? "0.25" : "0.35"} 0" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <style>
      .title {
        font-family: "Montserrat", "Arial Black", Arial, sans-serif;
        font-weight: 900;
        font-size: ${titleSize}px;
        letter-spacing: ${Math.max(1, Math.round(titleSize * 0.02))}px;
        fill: ${textMain};
        text-transform: uppercase;
      }
      .artist {
        font-family: "Montserrat", Arial, sans-serif;
        font-weight: 700;
        font-size: ${artistSize}px;
        letter-spacing: ${Math.max(2, Math.round(artistSize * 0.12))}px;
        fill: ${textMain};
        opacity: ${isTopBright ? "0.92" : "0.88"};
        text-transform: uppercase;
      }
      .hintStroke {
        paint-order: stroke fill;
        stroke: ${isTopBright ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"};
        stroke-width: 2;
      }
    </style>
  </defs>

  <!-- üst scrim: yazının her kapakta okunması için -->
  <rect x="0" y="0" width="1024" height="340" fill="url(#topScrim)"/>

  <!-- TITLE -->
  <g filter="url(#softShadow)">
    <text x="512" y="150" text-anchor="middle" class="title hintStroke">${safeTitle}</text>
  </g>

  <!-- ARTIST -->
  <g filter="url(#softShadow)">
    <text x="512" y="225" text-anchor="middle" class="artist">${safeArtist}</text>
  </g>

  <!-- çok hafif underline vibe (pro) -->
  <rect x="272" y="252" width="480" height="4" rx="2" fill="${textSoft}" opacity="${isTopBright ? "0.22" : "0.28"}"/>
</svg>
`;

    // 7) composite + export
    const final = await base
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 95, mozjpeg: true })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(final);
  } catch (e) {
    console.error("[cover/overlay-text] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
