export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });
    }

    const request_id = req.query.request_id;
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(request_id)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
        "X-Runway-Version": "2024-11-06",
      },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: "runway_status_failed", details: data });
    }

    const st = data.status || data.state;

    // AIVO normalize status
    let status = "IN_PROGRESS";
    if (st === "SUCCEEDED" || st === "COMPLETED") status = "COMPLETED";
    if (st === "FAILED" || st === "ERROR") status = "FAILED";
    if (st === "PENDING" || st === "QUEUED" || st === "IN_QUEUE") status = "IN_QUEUE";

    // Output URL yakala (Runway response formatı değişebiliyor)
    let video_url = null;
    const output = data.output || data.outputs || data.result;

    if (typeof output === "string" && output.startsWith("http")) video_url = output;

    if (Array.isArray(output)) {
      const hit = output.find(
        (x) =>
          (typeof x === "string" && x.startsWith("http")) ||
          (x?.url && String(x.url).startsWith("http"))
      );
      video_url = typeof hit === "string" ? hit : hit?.url || null;
    }

    if (!video_url && data?.output?.video_url) video_url = data.output.video_url;

    // ✅ UI için TEK format:
    // - tamamlandıysa outputs[0].url dolu
    // - değilse outputs boş
    const outputs = status === "COMPLETED" && video_url
      ? [{ type: "video", url: video_url }]
      : [];

    return res.status(200).json({
      ok: true,
      request_id,
      status,
      outputs,
      raw: data, // debug için kalsın
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
