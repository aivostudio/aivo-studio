export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({
        ok: false,
        error: "missing_REPLICATE_API_TOKEN",
      });
    }

    const model = process.env.REPLICATE_MODEL;
    if (!model) {
      return res.status(500).json({
        ok: false,
        error: "missing_REPLICATE_MODEL",
      });
    }

    const body = req.body || {};
    const input = body.input || { prompt: "a cute cat astronaut in space" };

    const replicatePayload = {
      input,
    };

    const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(replicatePayload),
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
