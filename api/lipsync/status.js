export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

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
      status: "ready",
      message: "Lipsync status endpoint hazır. Henüz HeyGen poll yapılmıyor.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_status_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
