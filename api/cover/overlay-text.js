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

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: "image indirilemedi" });
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const W = 768;
    const H = 768;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="190" fill="#000000" fill-opacity="0.30"/>

  <text
    x="${W / 2}"
    y="78"
    text-anchor="middle"
    fill="#F8E7BF"
    font-family="Helvetica, Arial, sans-serif"
    font-size="52"
    font-weight="900"
  >${titleText}</text>

  <text
    x="${W / 2}"
    y="126"
    text-anchor="middle"
    fill="#FFF7DC"
    font-family="Helvetica, Arial, sans-serif"
    font-size="22"
    font-weight="700"
    letter-spacing="3"
  >${artistText}</text>
</svg>
`;

    const final = await sharp(imgBuffer)
      .resize(W, H, { fit: "cover" })
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
