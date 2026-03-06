// FILE: api/cover/overlay-text.js
import sharp from "sharp";

function escapeXml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { imageUrl, artist, title } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: "imageUrl gerekli" });
    }

    const artistText = escapeXml((artist || "").trim().toUpperCase());
    const titleText = escapeXml((title || "").trim());

    // resmi indir
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Not: Vercel'de custom font yok -> sadece güvenli sistem fontları
    // Spotify/Apple Music uyumlu: üstte title büyük, altta artist küçük
    const W = 768;
    const H = 768;

    // --- AUTO CONTRAST (read top band brightness) ---
    const topH = Math.max(1, Math.round(H * 0.34));

    // Resize once, reuse for sampling + final composite
    const base = sharp(imgBuffer).resize(W, H, { fit: "cover" });

    // Sample the top area where title/artist sit
    const topRaw = await base
      .clone()
      .extract({ left: 0, top: 0, width: W, height: topH })
      .removeAlpha()
      .raw()
      .toBuffer();

    // Compute average luminance (0..255)
    let sum = 0;
    const pxCount = Math.floor(topRaw.length / 3);
    for (let i = 0; i < topRaw.length; i += 3) {
      const r = topRaw[i];
      const g = topRaw[i + 1];
      const b = topRaw[i + 2];
      // Rec. 709 luma
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const avgLuma = pxCount ? sum / pxCount : 0;
    const isBright = avgLuma >= 150;

    // Theme picks (auto)
    const TITLE_FILL = isBright ? "#0B0B0F" : "#F6E7C8";
    const TITLE_STROKE = isBright ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";

    const ARTIST_FILL = isBright ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.92)";
    const ARTIST_STROKE = isBright ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- Üstte okunurluk için hafif gradient -->
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="55%" stop-color="rgba(0,0,0,0.00)"/>
    </linearGradient>

    <!-- Yumuşak gölge -->
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
      <feOffset dx="0" dy="3" result="off"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.55"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Üst overlay -->
  <rect x="0" y="0" width="${W}" height="${topH}" fill="url(#topFade)"/>

  <!-- TITLE -->
  <text
    x="${W / 2}"
    y="128"
    text-anchor="middle"
    dominant-baseline="middle"
    filter="url(#softShadow)"
    style="
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 900;
      font-size: 84px;
      letter-spacing: 1px;
      fill: ${TITLE_FILL};
      stroke: ${TITLE_STROKE};
      stroke-width: 10px;
      paint-order: stroke fill;
      stroke-linejoin: round;
    "
  >${titleText}</text>

  <!-- ARTIST -->
  <text
    x="${W / 2}"
    y="210"
    text-anchor="middle"
    dominant-baseline="middle"
    filter="url(#softShadow)"
    style="
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 700;
      font-size: 34px;
      letter-spacing: 4px;
      fill: ${ARTIST_FILL};
      stroke: ${ARTIST_STROKE};
      stroke-width: 6px;
      paint-order: stroke fill;
      stroke-linejoin: round;
    "
  >${artistText}</text>
</svg>
`;

    const final = await base
      .clone()
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(final);
  } catch (e) {
    console.error("[overlay-text] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
