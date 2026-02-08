export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });
    }

   const { prompt, model = "gen3a_turbo", seconds = 8, aspect_ratio = "16:9" } = req.body || {};

    if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });

    // Runway text_to_video expects: promptText (string), duration (number), ratio (one of allowed)
    const ratioMap = {
      "16:9": "1280:720",
      "9:16": "720:1280",
      "4:3": "1104:832",
      "1:1": "906:960",
      "3:4": "832:1104",
    };

    const runwayPayload = {
      model,
      promptText: prompt,
      duration: Number(seconds),
      ratio: ratioMap[aspect_ratio] || "1280:720",
    };

    // Guard: duration must be a number
    if (!Number.isFinite(runwayPayload.duration)) {
      return res.status(400).json({ ok: false, error: "invalid_seconds" });
    }

    const r = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(runwayPayload),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "runway_create_failed",
        details: data,
        sent: runwayPayload, // debug için (istersen kaldırırız)
      });
    }

    // Runway usually returns { id: "uuid", ... }
    const request_id = data.id || data.task_id || data.request_id;
    return res.status(200).json({ ok: true, request_id, status: "IN_QUEUE", raw: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
