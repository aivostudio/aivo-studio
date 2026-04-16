// api/media-policy/vision-aws.js
const { RekognitionClient, DetectFacesCommand, RecognizeCelebritiesCommand } = require("@aws-sdk/client-rekognition");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      app,
      fileName,
      mimeType,
      imageBase64,
    } = req.body || {};

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

    const faceDetails = Array.isArray(facesResp && facesResp.FaceDetails) ? facesResp.FaceDetails : [];
    const celebrityFaces = Array.isArray(celebResp && celebResp.CelebrityFaces) ? celebResp.CelebrityFaces : [];
    const unrecognizedFaces = Array.isArray(celebResp && celebResp.UnrecognizedFaces) ? celebResp.UnrecognizedFaces : [];

    const faceCount = faceDetails.length;
    const hasFace = faceCount > 0;

    const bestCelebrity = pickBestCelebrity(celebrityFaces);
    const celebrityRisk = bestCelebrity ? Math.min(1, safeNumber(bestCelebrity.confidence, 0) / 100) : 0;
    const publicFigureRisk = celebrityRisk;

    return res.status(200).json({
      ok: true,
      hasFace,
      faceCount,
      publicFigureRisk,
      celebrityRisk,
      matchedLabel: bestCelebrity ? bestCelebrity.name : null,
      matchedGroup: bestCelebrity ? "public_figure" : null,
      provider: "aws-rekognition",
      providerVersion: "2026-04-17",
      raw: {
        app: app || null,
        fileName: fileName || null,
        mimeType: mimeType || null,
        region: String(process.env.AWS_REGION || "eu-central-1").trim(),
        detectFacesFaceCount: faceCount,
        celebrityFaceCount: celebrityFaces.length,
        unrecognizedFaceCount: unrecognizedFaces.length,
        celebrityFaces: celebrityFaces.map((item) => ({
          name: item && item.Name ? item.Name : null,
          matchConfidence: safeNumber(item && item.MatchConfidence, 0),
          id: item && item.Id ? item.Id : null,
          urls: Array.isArray(item && item.Urls) ? item.Urls : [],
        })),
        note: bestCelebrity
          ? "aws rekognition celebrity match detected"
          : hasFace
            ? "aws rekognition face detected but no celebrity match"
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
