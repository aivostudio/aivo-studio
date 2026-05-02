export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

    res.setHeader("Cache-Control", "no-store");

    const apiKey = String(process.env.HEYGEN_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_heygen_api_key",
        message: "HEYGEN_API_KEY env bulunamadı.",
      });
    }

    return res.status(200).json({
      ok: true,
      app: "lipsync",
      provider: "heygen",
      message: "HeyGen API key bulundu. Generate endpoint hazır.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_generate_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
