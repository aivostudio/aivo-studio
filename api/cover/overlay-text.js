// FILE: api/cover/overlay-text.js
export const config = { runtime: "nodejs" };

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
  const tLen = (title || "").length;
  const aLen = (artist || "").length;

  // 1024x1024 baseline
  let titleSize = 124;
  let artistSize = 44;

  // title küçültme
  if (tLen > 10) titleSize -= (tLen - 10) * 5;
  if (tLen > 18) titleSize -= (tLen - 18) * 3;

  // artist küçültme
  if (aLen > 14) artistSize -= (aLen - 14) * 1.6;

  titleSize = clamp(Math.round(titleSize), 68, 124);
  artistSize = clamp(Math.round(artistSize), 26, 44);

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

    const artistRaw = (artist || "").trim();
    const titleRaw = (title || "").trim();

    if (!artistRaw && !titleRaw) {
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

    // 3) üst bölge parlaklık (top 0..260px)
    const topStats = await base
      .clone()
      .extract({ left: 0, top: 0, width: 1024, height: 260 })
      .stats();

    const c = topStats.channels;
    const meanLum = (c[0].mean + c[1].mean + c[2].mean) / 3;
    const isTopBright = meanLum > 140;

    // 4) renkler
const textMain = "#0B0B0D";
    const scrimTop = isTopBright ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.48)";
    const scrimMid = isTopBright ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.18)";
    const scrimBot = "rgba(0,0,0,0)";

    // 5) text
    const titleText = escapeXml(titleRaw.toUpperCase());
    const artistText = escapeXml(artistRaw.toUpperCase());

    const { titleSize, artistSize } = computeFontSizes(titleText, artistText);

    // Linux’ta en güvenilir: DejaVu Sans (tofu/kutu problemini bitirir)
    const fontStack = `"DejaVu Sans","DejaVu Sans Condensed","Arial Black","Arial",sans-serif`;

    const letterTitle = Math.max(1, Math.round(titleSize * 0.02));
    const letterArtist = Math.max(2, Math.round(artistSize * 0.12));

    const svg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topScrim" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${scrimTop}"/>
      <stop offset="0.65" stop-color="${scrimMid}"/>
      <stop offset="1" stop-color="${scrimBot}"/>
    </linearGradient>

    <filter id="softShadow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur"/>
      <feOffset dx="0" dy="7" result="off"/>
      <feColorMatrix in="off" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 ${isTopBright ? "0.22" : "0.40"} 0" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <style>
      .title {
        font-family: ${fontStack};
        font-weight: 900;
        font-size: ${titleSize}px;
        letter-spacing: ${letterTitle}px;
        fill: ${textMain};
      }
      .titleStroke {
        paint-order: stroke fill;
        stroke: ${isTopBright ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.40)"};
        stroke-width: 3;
      }
      .artist {
        font-family: ${fontStack};
        font-weight: 800;
        font-size: ${artistSize}px;
        letter-spacing: ${letterArtist}px;
        fill: ${textMain};
        opacity: ${isTopBright ? "0.92" : "0.88"};
      }
    </style>
  </defs>

  <!-- üst scrim -->
  <rect x="0" y="0" width="1024" height="340" fill="url(#topScrim)"/>

  <!-- TITLE -->
  <g filter="url(#softShadow)">
    <text x="512" y="150" text-anchor="middle" class="title titleStroke">${titleText}</text>
  </g>

  <!-- ARTIST -->
  <g filter="url(#softShadow)">
    <text x="512" y="228" text-anchor="middle" class="artist">${artistText}</text>
  </g>
</svg>`;

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
