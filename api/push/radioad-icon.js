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

    if (req.method === "HEAD") return res.status(200).end();

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="bg" x1="42" y1="28" x2="472" y2="484" gradientUnits="userSpaceOnUse">
            <stop stop-color="#3b265f"/>
            <stop offset="0.52" stop-color="#263d68"/>
            <stop offset="1" stop-color="#124754"/>
          </linearGradient>
          <linearGradient id="icon" x1="132" y1="126" x2="390" y2="392" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f387ff"/>
            <stop offset="0.5" stop-color="#9aa7ff"/>
            <stop offset="1" stop-color="#62efff"/>
          </linearGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="512" height="512" rx="128" fill="#090b17"/>
        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4"/>
        <circle cx="164" cy="120" r="112" fill="#ffffff" fill-opacity="0.05"/>
        <g fill="none" stroke="url(#icon)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
          <rect x="132" y="172" width="248" height="176" rx="34"/>
          <path d="M170 172l42-54h88l42 54"/>
          <path d="M184 234h144"/>
          <path d="M184 286h76"/>
          <circle cx="322" cy="286" r="24"/>
          <path d="M322 262v48"/>
        </g>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.status(200).send(png);
  } catch (error) {
    console.error("[radioad-icon]", error);
    return res.status(500).json({
      ok: false,
      error: "icon_render_failed",
      message: String(error?.message || error || "unknown_error"),
    });
  }
};
