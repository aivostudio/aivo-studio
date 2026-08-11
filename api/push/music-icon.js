const sharp = require("sharp");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return res.status(405).end();
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
    );

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="bg" x1="52" y1="36" x2="470" y2="474" gradientUnits="userSpaceOnUse">
            <stop stop-color="#37205f"/>
            <stop offset="0.52" stop-color="#17335c"/>
            <stop offset="1" stop-color="#103f48"/>
          </linearGradient>
          <linearGradient id="icon" x1="140" y1="112" x2="382" y2="398" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f472ff"/>
            <stop offset="0.5" stop-color="#8b9dff"/>
            <stop offset="1" stop-color="#5ff6ff"/>
          </linearGradient>
          <filter id="glow" x="-55%" y="-55%" width="210%" height="210%">
            <feGaussianBlur stdDeviation="11" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4"/>
        <circle cx="150" cy="116" r="112" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <path d="M230 156v184"/>
          <path d="M230 172l154-34v180"/>
          <path d="M230 232l154-34"/>
        </g>

        <g fill="url(#icon)" filter="url(#glow)">
          <ellipse cx="184" cy="354" rx="56" ry="42" transform="rotate(-14 184 354)"/>
          <ellipse cx="338" cy="332" rx="56" ry="42" transform="rotate(-14 338 332)"/>
        </g>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[music-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
