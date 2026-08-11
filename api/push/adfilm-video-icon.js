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
          <linearGradient id="bg" x1="50" y1="36" x2="468" y2="474" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4a285d"/>
            <stop offset="0.52" stop-color="#4a342f"/>
            <stop offset="1" stop-color="#15364d"/>
          </linearGradient>
          <linearGradient id="icon" x1="128" y1="116" x2="390" y2="394" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f472ff"/>
            <stop offset="0.52" stop-color="#d99568"/>
            <stop offset="1" stop-color="#60eaff"/>
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
        <circle cx="158" cy="118" r="116" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="25" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <rect x="108" y="164" width="296" height="220" rx="42"/>
          <path d="M186 126h140"/>
        </g>

        <path d="M226 231v88l82-44-82-44z" fill="url(#icon)" filter="url(#glow)"/>

        <g fill="url(#icon)" filter="url(#glow)">
          <circle cx="132" cy="120" r="8"/>
          <circle cx="382" cy="140" r="7"/>
          <circle cx="402" cy="108" r="5"/>
        </g>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[adfilm-video-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
