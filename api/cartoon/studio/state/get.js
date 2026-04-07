export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
  }

  try {
    return res.status(200).json({
      ok: true,
      format: "16:9",
      scenes: [],
      voice: {
        fileName: "",
        fileUrl: "",
        uploadStatus: "idle"
      },
      logo: {
        fileName: "",
        fileUrl: "",
        uploadStatus: "idle"
      }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "studio_state_get_failed"
    });
  }
}
