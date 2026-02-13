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
    const prompt = (input?.prompt || "").trim();
    const ratio = (input?.ratio || "").trim();

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // Ratio -> image_size (desteklenmeyeni square'a düşür)
    const SIZE_BY_RATIO = {
      "1:1": "square_hd",
      "16:9": "landscape_16_9",
      "9:16": "portrait_9_16",
      "4:3": "landscape_4_3",
      "3:4": "portrait_4_3",
    };
    const image_size = SIZE_BY_RATIO[ratio] || "square_hd";

    // SDXL model (fal.ai)
    const model = "fal-ai/fast-sdxl";

    const falRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      // ✅ PROMPT'A DOKUNMA: kullanıcının yazdığı aynen gider
      body: JSON.stringify({ prompt, image_size }),
    });

    const data = await falRes.json().catch(() => ({}));

    if (!falRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "fal_create_failed",
        fal_status: falRes.status,
        fal_response: data,
      });
    }

    const url = data?.images?.[0]?.url || null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      status: "succeeded",
      output: url,
      meta: {
        ratio: ratio || null,
        image_size,
      },
      fal: data,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message || String(err),
    });
  }
}
