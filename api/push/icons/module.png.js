const sharp = require("sharp");

const ICONS = {
  music: {
    colors: ["#a78bfa", "#60eaff"],
    body: `<path d="M94 166V69l101-17v83" fill="none" stroke="url(#iconGradient)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><circle cx="69" cy="166" r="23" fill="none" stroke="url(#iconGradient)" stroke-width="18"/><circle cx="170" cy="149" r="23" fill="none" stroke="url(#iconGradient)" stroke-width="18"/>`,
  },
  cover: {
    colors: ["#f472ff", "#7dd3ff"],
    body: `<rect x="59" y="59" width="138" height="138" rx="26" fill="none" stroke="url(#iconGradient)" stroke-width="16"/><path d="M84 158l32-32 23 23 35-47 22 25" fill="none" stroke="url(#iconGradient)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><path d="M176 76l6 15 15 6-15 6-6 15-6-15-15-6 15-6z" fill="url(#iconGradient)"/>`,
  },
  atmo: {
    colors: ["#a78bfa", "#60eaff"],
    body: `<path d="M68 158h117c24 0 43-19 43-43s-19-43-43-43c-9 0-17 2-24 7-11-26-36-44-66-44-36 0-65 25-72 58-22 5-39 25-39 49 0 28 23 50 51 50h33" transform="translate(4 -6) scale(.86)" fill="none" stroke="url(#iconGradient)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="M82 190h92M101 216h54" fill="none" stroke="url(#iconGradient)" stroke-width="16" stroke-linecap="round"/>`,
  },
};

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function buildSvg(app) {
  const icon = ICONS[app];
  if (!icon) return "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="bgGradient" x1="30" y1="20" x2="226" y2="236" gradientUnits="userSpaceOnUse">
          <stop stop-color="#43386f"/>
          <stop offset=".52" stop-color="#252748"/>
          <stop offset="1" stop-color="#11182e"/>
        </linearGradient>
        <linearGradient id="iconGradient" x1="58" y1="48" x2="205" y2="210" gradientUnits="userSpaceOnUse">
          <stop stop-color="${icon.colors[0]}"/>
          <stop offset="1" stop-color="${icon.colors[1]}"/>
        </linearGradient>
        <radialGradient id="shine" cx="0" cy="0" r="1" gradientTransform="translate(72 50) rotate(45) scale(150)">
          <stop stop-color="#ffffff" stop-opacity=".20"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect x="18" y="18" width="220" height="220" rx="68" fill="url(#bgGradient)" stroke="#ffffff" stroke-opacity=".18" stroke-width="5"/>
      <rect x="20" y="20" width="216" height="216" rx="66" fill="url(#shine)"/>
      <g filter="url(#shadow)">${icon.body}</g>
    </svg>`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).end();
    }

    const app = clean(req.query?.app);
    const svg = buildSvg(app);

    if (!svg) {
      return res.status(404).json({ ok: false, error: "unknown_module_icon" });
    }

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    return res.status(200).send(png);
  } catch (error) {
    console.error("[push-module-icon]", error);
    return res.status(500).json({ ok: false, error: "icon_render_failed" });
  }
};
