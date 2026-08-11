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
          <linearGradient id="bg" x1="44" y1="34" x2="470" y2="474" gradientUnits="userSpaceOnUse">
            <stop stop-color="#40245f"/>
            <stop offset="0.52" stop-color="#233f69"/>
            <stop offset="1" stop-color="#17465b"/>
          </linearGradient>
          <linearGradient id="icon" x1="128" y1="122" x2="390" y2="392" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f58cff"/>
            <stop offset="0.52" stop-color="#a89cff"/>
            <stop offset="1" stop-color="#66ecff"/>
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
        <circle cx="156" cy="118" r="112" fill="#ffffff" fill-opacity="0.05"/>

        <g fill="none" stroke="url(#icon)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <rect x="112" y="126" width="288" height="260" rx="38"/>
          <circle cx="194" cy="205" r="34"/>
          <path d="M144 342l74-78 54 52 48-46 48 72"/>
        </g>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[cover-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
