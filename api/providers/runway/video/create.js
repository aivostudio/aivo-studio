export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });

    const { prompt, model = "runway/Gen-4 Turbo", seconds = 8, aspect_ratio = "16:9" } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });

    const r = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWAYML_API_SECRET}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model,
        prompt,
        seconds,
        // Runway tarafında alan adı farklı olabilir; gerekirse status response’una göre mapleriz.
        aspect_ratio,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: "runway_create_failed", details: data });

    // Runway genelde { id: "...", ... } döner
    const request_id = data.id || data.task_id || data.request_id;
    return res.status(200).json({ ok: true, request_id, status: "IN_QUEUE", raw: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
