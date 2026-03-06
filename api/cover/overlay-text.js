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
          text: `<span foreground="#F8E7BF">${titleText}</span>`,
          width: W - 120,
          align: "center",
          rgba: true,
          font: "Arial Bold 60"
        },
      })
        .png()
        .toBuffer();

      layers.push({
        input: titlePng,
        top: 60,
        left: 60,
      });
    }

    // ARTIST
    if (artistText) {
      const artistPng = await sharp({
        text: {
          text: `<span foreground="#FFFFFF">${artistText}</span>`,
          width: W - 160,
          align: "center",
          rgba: true,
          font: "Arial Bold 26"
        },
      })
        .png()
        .toBuffer();

      layers.push({
        input: artistPng,
        top: 140,
        left: 80,
      });
    }

    const final = await base
      .composite(layers)
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
