export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_heygen_api_key"
      });
    }

    const url = "https://api.heygen.com/v3/voices?language=Turkish&limit=20";

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey
      }
    });

    const data = await r.json().catch(() => null);

    return res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      data
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "heygen_voices_error",
      detail: err && err.message ? String(err.message) : String(err)
    });
  }
}
