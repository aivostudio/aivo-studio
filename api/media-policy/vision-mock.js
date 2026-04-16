// api/media-policy/vision-mock.js
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      fileName,
      mimeType,
      app,
    } = req.body || {};

    return res.status(200).json({
      ok: true,
      hasFace: true,
      faceCount: 1,
      publicFigureRisk: 0.95,
      celebrityRisk: 0.95,
      matchedLabel: "recep tayyip erdogan",
      matchedGroup: "public_figure",
      provider: "vision-mock",
      providerVersion: "v1",
      raw: {
        app: app || null,
        fileName: fileName || null,
        mimeType: mimeType || null,
        note: "mock provider response",
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
