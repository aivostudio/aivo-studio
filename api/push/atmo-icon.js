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
          <linearGradient id="bg" x1="52" y1="32" x2="462" y2="474" gradientUnits="userSpaceOnUse">
            <stop stop-color="#2f275d"/>
            <stop offset="0.48" stop-color="#173f68"/>
            <stop offset="1" stop-color="#124b55"/>
          </linearGradient>
          <linearGradient id="icon" x1="136" y1="126" x2="388" y2="388" gradientUnits="userSpaceOnUse">
            <stop stop-color="#a78bfa"/>
            <stop offset="0.5" stop-color="#60a5fa"/>
            <stop offset="1" stop-color="#67e8f9"/>
          </linearGradient>
          <filter id="glow" x="-55%" y="-55%" width="210%" height="210%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4"/>
        <circle cx="150" cy="116" r="112" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <path d="M142 310c0-44 35-80 80-80 10-42 48-72 92-72 54 0 98 44 98 98 0 5 0 10-1 14 28 9 49 36 49 67 0 39-32 71-71 71H194c-46 0-84-37-84-83 0-6 1-11 2-17 8 1 19 2 30 2z"/>
          <path d="M198 422h116"/>
          <path d="M232 454h48"/>
        </g>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[atmo-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
