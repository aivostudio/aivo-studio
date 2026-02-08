export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_API_TOKEN" });
    }

    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: "missing_id" });
    }

    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      method: "GET",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        error: "replicate_status_failed",
        replicate_status: r.status,
        replicate_response: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "replicate",
      provider_job_id: data.id,
      status: data.status,
      output: data.output || null,
      replicate: data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || String(err),
    });
  }
}
