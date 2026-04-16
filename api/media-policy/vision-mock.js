// api/media-policy/vision-mock.js
function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(normalize(term)));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      fileName,
      mimeType,
      app,
      prompt,
      title,
      description,
      personName,
      style,
    } = req.body || {};

    const scanText = normalize([
      fileName,
      prompt,
      title,
      description,
      personName,
      style,
    ].filter(Boolean).join(" "));

    const blockedTerms = [
      "recep tayyip erdogan",
      "recep tayyip erdoğan",
      "erdogan",
      "erdoğan",
      "mustafa kemal ataturk",
      "mustafa kemal atatürk",
      "ataturk",
      "atatürk",
      "ekrem imamoglu",
      "ekrem imamoğlu",
      "mansur yavas",
      "mansur yavaş",
      "kemal kilicdaroglu",
      "kemal kılıçdaroğlu",
      "devlet bahceli",
      "devlet bahçeli",
      "meral aksener",
      "meral akşener",
      "ozgur ozel",
      "özgür özel",
      "selahattin demirtas",
      "selahattin demirtaş",
      "umit ozdag",
      "ümit özdağ",
      "muharrem ince",
      "sinan ogan",
      "sinan oğan",
      "ali babacan",
      "ahmet davutoglu",
      "ahmet davutoğlu",
      "hakan fidan",
      "hulusi akar",
      "mehmet simsek",
      "mehmet şimşek",
      "suleyman soylu",
      "süleyman soylu",
      "cumhurbaskani",
      "cumhurbaşkanı",
      "bakan",
      "milletvekili",
      "belediye baskani",
      "belediye başkanı",
      "vali",
      "kaymakam",
      "siyasetci",
      "siyasetçi",
      "politikaci",
      "politikacı",
      "kamu figuru",
      "kamu figürü",
      "tarkan",
      "sezen aksu",
      "ajda pekkan",
      "sertab erener",
      "murat boz",
      "hadise",
      "aleyna tilki",
      "edis",
      "mabel matiz",
      "cem adrian",
      "haluk levent",
      "teoman",
      "ceza",
      "ezhel"
    ];

    const isBlocked = includesAny(scanText, blockedTerms);

    if (isBlocked) {
      return res.status(200).json({
        ok: true,
        hasFace: true,
        faceCount: 1,
        publicFigureRisk: 0.95,
        celebrityRisk: 0.95,
        matchedLabel: "public_figure_text_match",
        matchedGroup: "public_figure",
        provider: "vision-mock",
        providerVersion: "v2",
        raw: {
          app: app || null,
          fileName: fileName || null,
          mimeType: mimeType || null,
          note: "mock provider response: blocked by text match",
          scanText,
        },
      });
    }

    return res.status(200).json({
      ok: true,
      hasFace: false,
      faceCount: 0,
      publicFigureRisk: 0.01,
      celebrityRisk: 0.01,
      matchedLabel: null,
      matchedGroup: null,
      provider: "vision-mock",
      providerVersion: "v2",
      raw: {
        app: app || null,
        fileName: fileName || null,
        mimeType: mimeType || null,
        note: "mock provider response: allow",
        scanText,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "vision_mock_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
};
