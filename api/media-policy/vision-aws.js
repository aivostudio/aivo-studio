// api/media-policy/vision-aws.js
const {
  RekognitionClient,
  DetectFacesCommand,
  RecognizeCelebritiesCommand,
} = require("@aws-sdk/client-rekognition");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function base64ToBytes(imageBase64) {
  if (!imageBase64) return null;
  try {
    return Buffer.from(String(imageBase64), "base64");
  } catch (_) {
    return null;
  }
}

function buildClient() {
  const region = String(process.env.AWS_REGION || "eu-central-1").trim();

  return new RekognitionClient({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: String(process.env.AWS_ACCESS_KEY_ID).trim(),
            secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY).trim(),
          }
        : undefined,
  });
}

function pickBestCelebrity(celebrityFaces = []) {
  if (!Array.isArray(celebrityFaces) || celebrityFaces.length === 0) return null;

  let best = null;
  for (const item of celebrityFaces) {
    const confidence = safeNumber(item && item.MatchConfidence, 0);
    if (!best || confidence > best.confidence) {
      best = {
        name: item && item.Name ? String(item.Name) : null,
        confidence,
        id: item && item.Id ? String(item.Id) : null,
        urls: Array.isArray(item && item.Urls) ? item.Urls : [],
      };
    }
  }

  return best;
}

// Buraya SADECE gerçekten engellenmesi gereken isimleri koy.
// Mantık: default allow. Sadece açık koruma listesi + çok yüksek confidence => block riski.
const PROTECTED_PERSONS = new Set(
  [
    // TURKIYE - SIYASET
    "recep tayyip erdogan",
    "recep tayyip erdoğan",
    "kemal kilicdaroglu",
    "kemal kılıçdaroğlu",
    "devlet bahceli",
    "devlet bahçeli",
    "ekrem imamoglu",
    "ekrem imamoğlu",
    "mansur yavas",
    "mansur yavaş",
    "selahattin demirtas",
    "selahattin demirtaş",
    "meral aksener",
    "meral akşener",
    "abdullah gul",
    "abdullah gül",
    "ahmet davutoglu",
    "ahmet davutoğlu",
    "ali babacan",

    // TURKIYE - MUZIK / MAGAZIN / MEDYA
    "tarkan",
    "sibel can",
    "sezen aksu",
    "ajda pekkan",
    "ibrahim tatlises",
    "ibrahim tatlıses",
    "gulben ergen",
    "gülben ergen",
    "hadise",
    "demet akalin",
    "demet akalın",
    "mustafa sandal",
    "kenan dogulu",
    "kenan doğulu",

    // TURKIYE - OYUNCU / EKRAN YUZLERI
    "kivanc tatlitug",
    "kıvanc tatlıtuğ",
    "kivanc tatlıtuğ",
    "kıvanç tatlitug",
    "kıvanç tatlıtuğ",
    "kenan imirzalioglu",
    "kenan imirzalıoğlu",
    "haluk bilginer",
    "cem yilmaz",
    "cem yılmaz",
    "sahan gokbakar",
    "şahan gökbakar",
    "acun ilicali",
    "acun ılıcalı",
    "muge anli",
    "müge anlı",
    "esra erol",
    "burak ozcivit",
    "burak özçivit",
    "serenay sarikaya",
    "serenay sarıkaya",

    // DUNYA - SIYASET / DEVLET
    "donald trump",
    "joe biden",
    "barack obama",
    "vladimir putin",
    "volodymyr zelenskyy",
    "xi jinping",
    "narendra modi",
    "emmanuel macron",
    "benjamin netanyahu",
    "kim jong un",

    // DUNYA - TEKNOLOJI / IS DUNYASI
    "elon musk",
    "bill gates",
    "mark zuckerberg",
    "jeff bezos",
    "tim cook",
    "sam altman",
    "warren buffett",
    "jensen huang",

    // DUNYA - MUZIK / POP KULTUR
    "rihanna",
    "taylor swift",
    "beyonce",
    "beyoncé",
    "drake",
    "justin bieber",
    "ariana grande",
    "ed sheeran",
    "the weeknd",
    "bad bunny",
    "dua lipa",

    // DUNYA - SINEMA / TV
    "leonardo dicaprio",
    "brad pitt",
    "angelina jolie",
    "tom cruise",
    "dwayne johnson",
    "jennifer lawrence",
    "margot robbie",
    "scarlett johansson",
    "keanu reeves",
    "robert downey jr",
    "robert downey junior",

    // DUNYA - SPOR
    "cristiano ronaldo",
    "lionel messi",
    "lebron james",
    "michael jordan",
    "kylian mbappe",
    "kylian mbappé",
    "neymar",
    "serena williams",
    "novak djokovic",
    "novak djoković",

    // DUNYA - ESTATE / OLUM SONRASI RISKLI IKONLAR
    "michael jackson",
    "elvis presley",
    "marilyn monroe",
    "freddie mercury",
    "prince",
    "whitney houston",
  ].map(normalize)
);

// SADECE dogruladigin Rekognition celebrity Id degerlerini burada tut.
// Bilinmeyen Id'leri uydurma ekleme. Isim bazli koruma zaten aktif.
// Yeni Id buldukca bu listeye ekleyebilirsin.
const PROTECTED_PERSON_IDS = new Set([
  "1DE0PR", // Recep Tayyip Erdoğan
  "I4ma5e", // Donald Trump
]);

function isProtectedCelebrityMatch(bestCelebrity) {
  if (!bestCelebrity || !bestCelebrity.name) return false;

  const normalizedName = normalize(bestCelebrity.name);
  const celebId = String(bestCelebrity.id || "").trim();
  const confidence = safeNumber(bestCelebrity.confidence, 0);

  const isProtectedByName = PROTECTED_PERSONS.has(normalizedName);
  const isProtectedById = celebId && PROTECTED_PERSON_IDS.has(celebId);

  // Çok net olmayan eşleşmeleri block sebebi yapmıyoruz.
  const isVeryHighConfidence = confidence >= 99.5;

  return (isProtectedByName || isProtectedById) && isVeryHighConfidence;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { app, fileName, mimeType, imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        ok: false,
        error: "missing_image_base64",
      });
    }

    const imageBytes = base64ToBytes(imageBase64);
    if (!imageBytes) {
      return res.status(400).json({
        ok: false,
        error: "invalid_image_base64",
      });
    }

    const client = buildClient();

    const [facesResp, celebResp] = await Promise.all([
      client.send(
        new DetectFacesCommand({
          Image: { Bytes: imageBytes },
          Attributes: ["DEFAULT"],
        })
      ),
      client.send(
        new RecognizeCelebritiesCommand({
          Image: { Bytes: imageBytes },
        })
      ),
    ]);

    const faceDetails = Array.isArray(facesResp && facesResp.FaceDetails)
      ? facesResp.FaceDetails
      : [];
    const celebrityFaces = Array.isArray(celebResp && celebResp.CelebrityFaces)
      ? celebResp.CelebrityFaces
      : [];
    const unrecognizedFaces = Array.isArray(celebResp && celebResp.UnrecognizedFaces)
      ? celebResp.UnrecognizedFaces
      : [];

    const faceCount = faceDetails.length;
    const hasFace = faceCount > 0;

    const bestCelebrity = pickBestCelebrity(celebrityFaces);
    const bestConfidence = bestCelebrity ? safeNumber(bestCelebrity.confidence, 0) : 0;
    const protectedMatch = isProtectedCelebrityMatch(bestCelebrity);

    // Ana kural:
    // - Korunan kişi değilse block riski üretme
    // - Korunan kişi + çok yüksek confidence ise risk üret
    const celebrityRisk = protectedMatch ? Math.min(1, bestConfidence / 100) : 0;
    const publicFigureRisk = 0;

    return res.status(200).json({
      ok: true,
      hasFace,
      faceCount,
      publicFigureRisk,
      celebrityRisk,
      matchedLabel: protectedMatch && bestCelebrity ? bestCelebrity.name : null,
      matchedGroup: protectedMatch ? "public_figure" : null,
      provider: "aws-rekognition",
      providerVersion: "2026-04-17-protected-list",
      raw: {
        app: app || null,
        fileName: fileName || null,
        mimeType: mimeType || null,
        region: String(process.env.AWS_REGION || "eu-central-1").trim(),
        detectFacesFaceCount: faceCount,
        celebrityFaceCount: celebrityFaces.length,
        unrecognizedFaceCount: unrecognizedFaces.length,
        bestCelebrity: bestCelebrity
          ? {
              name: bestCelebrity.name,
              matchConfidence: bestConfidence,
              id: bestCelebrity.id,
              urls: bestCelebrity.urls,
            }
          : null,
        protectedMatch,
        celebrityFaces: celebrityFaces.map((item) => ({
          name: item && item.Name ? item.Name : null,
          matchConfidence: safeNumber(item && item.MatchConfidence, 0),
          id: item && item.Id ? item.Id : null,
          urls: Array.isArray(item && item.Urls) ? item.Urls : [],
        })),
        note: protectedMatch
          ? "aws rekognition protected person match detected"
          : bestCelebrity
            ? "aws rekognition celebrity-like match ignored because not in protected list"
            : hasFace
              ? "aws rekognition face detected but no protected person match"
              : "aws rekognition no face detected",
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "vision_aws_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
};
