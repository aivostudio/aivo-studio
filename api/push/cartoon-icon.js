const sharp = require("sharp");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return res.status(405).end();
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="bg" x1="60" y1="30" x2="455" y2="485" gradientUnits="userSpaceOnUse">
            <stop stop-color="#44366f"/>
            <stop offset="0.52" stop-color="#252945"/>
            <stop offset="1" stop-color="#14283d"/>
          </linearGradient>
          <linearGradient id="icon" x1="145" y1="128" x2="372" y2="382" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffb86c"/>
            <stop offset="0.52" stop-color="#ff7ccf"/>
            <stop offset="1" stop-color="#ffd36a"/>
          </linearGradient>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="12" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.16" stroke-width="4"/>
        <circle cx="150" cy="114" r="118" fill="#ffffff" fill-opacity="0.06"/>

        <g transform="translate(76 76) scale(15)" fill="none" stroke="url(#icon)" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <circle cx="7.5" cy="7.2" r="2.7"/>
          <circle cx="16.5" cy="7.2" r="2.7"/>
          <path d="M5.2 11.2c0-4.2 3.1-6.3 6.8-6.3s6.8 2.1 6.8 6.3v3.1c0 3.4-2.8 5.8-6.8 5.8s-6.8-2.4-6.8-5.8v-3.1z"/>
          <circle cx="9.4" cy="12.7" r=".7" fill="url(#icon)" stroke="none"/>
          <circle cx="14.6" cy="12.7" r=".7" fill="url(#icon)" stroke="none"/>
          <path d="M11 15.2h2"/>
          <path d="M10.3 16.3c1.1.9 2.3.9 3.4 0"/>
        </g>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[cartoon-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
