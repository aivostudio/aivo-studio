export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });
    }

    // UI payload (bizim taraf)
    const {
      prompt,
      mode = "text",          // "text" | "image"
      image_url = null,       // mode==="image" için zorunlu
      model = "veo3.1_fast",

      // ✅ UI bazı yerlerde duration/ratio gönderiyor, bazı yerlerde seconds/aspect_ratio
      seconds: _seconds = 8,
      duration = undefined,

      aspect_ratio: _aspect_ratio = "16:9",
      ratio = undefined,
    } = req.body || {};

    // ✅ normalize: duration -> seconds, ratio -> aspect_ratio
    const seconds = (typeof duration === "number" ? duration : _seconds);
    const aspect_ratio = (typeof ratio === "string" && ratio ? ratio : _aspect_ratio);

    if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });
    if (mode === "image" && !image_url) {
      return res.status(400).json({ ok: false, error: "missing_image_url" });
    }

    // ✅ Runway tarafına giden payload’ı mapliyoruz:
    // promptText + duration + ratio (+ mode=image ise promptImage)
    const ratioMap = {
      "16:9": "1280:720",
      "9:16": "720:1280",
      "4:3": "1104:832",
      "1:1": "960:960",
      "3:4": "832:1104",
    };

    const runwayPayload = {
      model,
      promptText: prompt,
      duration: seconds,
      ratio: ratioMap[aspect_ratio] || ratioMap["16:9"],
    };

    // ✅ mode=image ise: endpoint + promptImage
    const endpoint =
      mode === "image"
        ? "https://api.dev.runwayml.com/v1/image_to_video"
        : "https://api.dev.runwayml.com/v1/text_to_video";

    if (mode === "image") {
      runwayPayload.promptImage = image_url;
    }

    const r = await fetch(endpoint, {
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
        sent: runwayPayload, // debug için çok faydalı
        endpoint,            // debug
      });
    }

    // Runway genelde { id: "..."} döndürüyor
    const request_id = data.id || data.task_id || data.request_id;
    if (!request_id) {
      return res
        .status(500)
        .json({ ok: false, error: "runway_missing_request_id", raw: data });
    }

    // ✅ UI tek format:
    return res.status(200).json({
      ok: true,
      job_id: request_id, // UI job_id bekliyorsa
      request_id,         // debug/geriye dönük
      status: "IN_QUEUE",
      outputs: [],        // hazır değil
      raw: data,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}
