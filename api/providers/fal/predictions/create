export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const { input } = req.body || {};
    const prompt = input?.prompt;

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // SDXL model (fal.ai)
    const model = "fal-ai/fast-sdxl";

    const falRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd"
      }),
    });

    const data = await falRes.json();

    if (!falRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "fal_create_failed",
        fal_status: falRes.status,
        fal_response: data
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      status: "succeeded",
      output: data?.images?.[0]?.url || null,
      fal: data
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err.message
    });
  }
}
