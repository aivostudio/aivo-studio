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

    layers.push({
      input: {
        create: {
          width: W,
          height: 190,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0.34 },
        },
      },
      top: 0,
      left: 0,
    });

    if (titleText) {
      const titlePng = await sharp({
        text: {
          text: titleText,
          width: W - 80,
          height: 84,
          align: "center",
          rgba: true,
          dpi: 220,
          font: "Arial Bold 56",
        },
      })
        .png()
        .toBuffer();

      layers.push({
        input: titlePng,
        top: 38,
        left: 40,
      });
    }

    if (artistText) {
      const artistPng = await sharp({
        text: {
          text: artistText,
          width: W - 120,
          height: 40,
          align: "center",
          rgba: true,
          dpi: 220,
          font: "Arial Bold 24",
        },
      })
        .png()
        .toBuffer();

      layers.push({
        input: artistPng,
        top: 108,
        left: 60,
      });
    }

    const final = await base.composite(layers).jpeg({ quality: 95 }).toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(final);
  } catch (e) {
    console.error("[overlay-text] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
