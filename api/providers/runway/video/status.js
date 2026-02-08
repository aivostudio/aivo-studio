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

    const st = data?.status || data?.state;

    // AIVO normalize status
    let status = "IN_PROGRESS";
    if (st === "SUCCEEDED" || st === "COMPLETED") status = "COMPLETED";
    if (st === "FAILED" || st === "ERROR") status = "FAILED";
    if (st === "PENDING" || st === "QUEUED" || st === "IN_QUEUE") status = "IN_QUEUE";

    // video_url: mümkün olan tüm şemalardan güvenli şekilde topla
    const pickUrl = (v) => {
      if (!v) return null;
      if (typeof v === "string" && v.startsWith("http")) return v;
      if (typeof v === "object" && v.url && String(v.url).startsWith("http")) return String(v.url);
      if (typeof v === "object" && v.video_url && String(v.video_url).startsWith("http")) return String(v.video_url);
      return null;
    };

    let video_url = null;

    // 1) output / outputs / result
    const output = data.output ?? data.outputs ?? data.result;

    if (Array.isArray(output)) {
      for (const item of output) {
        const u = pickUrl(item);
        if (u) { video_url = u; break; }
      }
    } else {
      video_url = pickUrl(output);
    }

    // 2) fallback: nested output obj
    if (!video_url) video_url = pickUrl(data?.output);

    // sadece COMPLETED iken döndür
    return res.status(200).json({
      ok: true,
      request_id,
      status,
      video_url: status === "COMPLETED" ? video_url : null,
      raw: data,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
