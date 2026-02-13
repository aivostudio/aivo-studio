export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const app = String(req.query?.app || "").trim() || "cover";

    const { input } = req.body || {};
    const userPrompt = (input?.prompt || "").trim();
    const style = (input?.style || "").trim();     // UI’dan opsiyonel
    const ratio = (input?.ratio || "").trim();     // UI’dan opsiyonel: "1:1", "16:9", "9:16"...
    const seed = (Number.isFinite(input?.seed) ? input.seed : undefined);

    if (!userPrompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // 1) Style helper (kullanıcı prompt’unu override etmez, sadece güçlendirir)
    const STYLE_SUFFIX = {
      "Gerçekçi": "photorealistic, high detail, natural lighting, sharp focus",
      "Fotoğrafik": "photorealistic, studio photography, 85mm lens, shallow depth of field, ultra detailed",
      "Sanatsal": "artistic illustration, painterly, rich texture, cinematic lighting",
      "Çizgi Film": "cute 3D cartoon, animated film style, soft lighting, vibrant colors, clean shapes",
      "Anime": "anime style, clean lineart, cel shading, vibrant",
      "Soyut": "abstract, geometric, minimal, modern composition",
    };

    // app bazlı küçük yönlendirme (cover/social farkı varsa)
    const APP_SUFFIX = {
      cover: "album cover, centered composition, high quality, no text",
      social: "social media post, eye-catching, high quality, no text",
    };

    const styleHint = STYLE_SUFFIX[style] || (style ? String(style) : "");
    const appHint = APP_SUFFIX[app] || "";

    // 2) Negatif prompt (sapmayı azaltır)
    const negative_prompt =
      "text, watermark, logo, caption, low quality, blurry, deformed, extra limbs, bad anatomy, jpeg artifacts";

    // 3) Ratio -> image_size mapping (desteklenmeyeni square’a düşür)
    const SIZE_BY_RATIO = {
      "1:1": "square_hd",
      "16:9": "landscape_16_9",
      "9:16": "portrait_9_16",
      "4:3": "landscape_4_3",
      "3:4": "portrait_4_3",
    };
    const image_size = SIZE_BY_RATIO[ratio] || "square_hd";

    // 4) Final prompt: kullanıcı prompt’u + (opsiyonel) yönlendirme ekleri
    // Kullanıcının isteğini bozmamak için ekleri SONUNA ekliyoruz.
    const prompt = [
      userPrompt,
      appHint ? `(${appHint})` : "",
      styleHint ? `(${styleHint})` : "",
    ].filter(Boolean).join(", ");

    // SDXL model (fal.ai) — hızlı
    const model = "fal-ai/fast-sdxl";

    const body = {
      prompt,
      image_size,
      negative_prompt,
    };
    if (typeof seed === "number") body.seed = seed;

    const falRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await falRes.json().catch(() => ({}));

    if (!falRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "fal_create_failed",
        fal_status: falRes.status,
        fal_response: data,
        sent: body,
      });
    }

    const url = data?.images?.[0]?.url || null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      status: "succeeded",
      output: url,
      meta: {
        app,
        style: style || null,
        ratio: ratio || null,
        image_size,
      },
      fal: data,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err),
    });
  }
}
