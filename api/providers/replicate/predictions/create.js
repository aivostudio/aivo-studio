export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    const version = process.env.REPLICATE_VERSION_ID; // full hash id

    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_API_TOKEN" });
    }
    if (!version) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_VERSION_ID" });
    }

    const body = req.body || {};
    const input = body.input || { prompt: "a futuristic neon city at night" };

    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version, input }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        error: "replicate_create_failed",
        replicate_status: r.status,
        replicate_response: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "replicate",
      provider_job_id: data.id,
      status: data.status,
      output: data.output ?? null,
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
