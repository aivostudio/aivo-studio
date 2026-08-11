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
          <linearGradient id="bg" x1="48" y1="34" x2="470" y2="474" gradientUnits="userSpaceOnUse">
            <stop stop-color="#17394b"/>
            <stop offset="0.5" stop-color="#152f3d"/>
            <stop offset="1" stop-color="#153426"/>
          </linearGradient>
          <linearGradient id="icon" x1="132" y1="112" x2="390" y2="390" gradientUnits="userSpaceOnUse">
            <stop stop-color="#60eaff"/>
            <stop offset="1" stop-color="#22c55e"/>
          </linearGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="11" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4"/>
        <circle cx="154" cy="118" r="116" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="25" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <path d="M251 122c-69 0-124 55-124 124s55 124 124 124"/>
          <path d="M251 122v248"/>
          <path d="M318 190c28 18 43 40 43 66s-15 48-43 66"/>
          <path d="M370 158c42 31 63 64 63 98s-21 67-63 98"/>
        </g>

        <circle cx="214" cy="221" r="9" fill="url(#icon)" filter="url(#glow)"/>
        <path d="M201 286c18 13 35 13 52 0" fill="none" stroke="url(#icon)" stroke-width="15" stroke-linecap="round" filter="url(#glow)"/>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[lipsync-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
