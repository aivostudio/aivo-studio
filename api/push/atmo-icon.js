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
          <linearGradient id="icon" x1="128" y1="120" x2="390" y2="400" gradientUnits="userSpaceOnUse">
            <stop stop-color="#a78bfa"/>
            <stop offset="0.5" stop-color="#60a5fa"/>
            <stop offset="1" stop-color="#67e8f9"/>
          </linearGradient>
          <filter id="glow" x="-55%" y="-55%" width="210%" height="210%">
            <feGaussianBlur stdDeviation="9" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="512" height="512" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4"/>
        <circle cx="150" cy="116" r="112" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <path d="M166 326H356C397 326 430 294 430 254C430 220 407 192 375 184C369 136 328 100 279 100C235 100 196 128 182 169C175 167 167 166 159 166C114 166 78 201 78 245C78 290 113 326 166 326Z"/>
          <path d="M174 374H230"/>
          <path d="M256 374H338"/>
          <path d="M206 414H306"/>
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
