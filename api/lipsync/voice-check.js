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
      });
    }

    const voiceId = String(req.query.voice_id || req.query.voiceId || "").trim();

    if (!voiceId) {
      return res.status(400).json({
        ok: false,
        error: "voice_id_required",
      });
    }

    const heygenRes = await fetch(
      `https://api.heygen.com/v3/voices/${encodeURIComponent(voiceId)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          accept: "application/json",
        },
      }
    );

    const text = await heygenRes.text().catch(() => "");
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return res.status(heygenRes.status).json({
      ok: heygenRes.ok,
      provider: "heygen",
      voice_id: voiceId,
      provider_status: heygenRes.status,
      payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_voice_check_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
