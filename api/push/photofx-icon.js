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
          <linearGradient id="icon" x1="128" y1="96" x2="390" y2="410" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffd36a"/>
            <stop offset="1" stop-color="#f472ff"/>
          </linearGradient>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="13" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.16" stroke-width="4"/>
        <circle cx="150" cy="114" r="118" fill="#ffffff" fill-opacity="0.06"/>

        <path
          d="M256 82l44.7 158.5L459 285.2 300.7 330 256 488l-44.7-158L53 285.2l158.3-44.7L256 82z"
          fill="url(#icon)"
          filter="url(#glow)"
        />
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[photofx-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
