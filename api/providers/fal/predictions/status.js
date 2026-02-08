// api/providers/fal/predictions/status.js
export default async function handler(req, res) {
  try {
    const request_id = String(req.query.request_id || "").trim();
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    const key = process.env.FAL_KEY;
    if (!key) {
      return res.status(500).json({ ok: false, error: "missing_FAL_KEY" });
    }

    // fal.ai async result endpoint (request_id ile)
    const url = `https://fal.run/fal-ai/any/status/${encodeURIComponent(request_id)}`;
    // ^ Eğer fal tarafında kullandığın "status" endpoint farklıysa,
    // video/status.js’te hangi domain/path kullandıysan onu buraya kopyala.

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Key ${key}`,
        "Content-Type": "application/json",
      },
    });

    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // passthrough
    return res.status(r.status).json(data);

  } catch (e) {
    console.error("[fal.predictions.status] error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
