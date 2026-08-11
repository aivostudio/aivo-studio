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
          <linearGradient id="bg" x1="52" y1="38" x2="466" y2="470" gradientUnits="userSpaceOnUse">
            <stop stop-color="#3b3569"/>
            <stop offset="0.5" stop-color="#202745"/>
            <stop offset="1" stop-color="#12324a"/>
          </linearGradient>
          <linearGradient id="icon" x1="136" y1="118" x2="382" y2="388" gradientUnits="userSpaceOnUse">
            <stop stop-color="#8d7cff"/>
            <stop offset="1" stop-color="#60eaff"/>
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="11" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4"/>
        <circle cx="160" cy="120" r="118" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <rect x="118" y="190" width="276" height="190" rx="38"/>
          <path d="M166 142l34 48"/>
          <path d="M272 142l34 48"/>
        </g>

        <path d="M228 242v87l82-43.5L228 242z" fill="url(#icon)" filter="url(#glow)"/>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[video-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
