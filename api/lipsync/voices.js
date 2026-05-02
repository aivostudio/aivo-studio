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

    const heygenRes = await fetch("https://api.heygen.com/v3/voices", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        accept: "application/json",
      },
    });

    const text = await heygenRes.text().catch(() => "");
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!heygenRes.ok) {
      return res.status(heygenRes.status).json({
        ok: false,
        error: "heygen_voices_failed",
        provider_status: heygenRes.status,
        payload,
      });
    }

    return res.status(200).json({
      ok: true,
      app: "lipsync",
      provider: "heygen",
      voices:
        payload?.data?.voices ||
        payload?.voices ||
        payload?.data ||
        [],
      payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_voices_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
