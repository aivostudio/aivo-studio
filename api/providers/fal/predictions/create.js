// /api/providers/fal/predictions/create.js
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
    const originalPrompt = (input?.prompt || "").trim();
    const ratio = (input?.ratio || "").trim();
    const style = (input?.style || null); // opsiyonel (şimdilik fal prompt'una karıştırmıyoruz)

    if (!originalPrompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // Ratio -> image_size
    const SIZE_BY_RATIO = {
      "1:1": "square_hd",
      "16:9": "landscape_16_9",
      "9:16": "portrait_9_16",
      "4:3": "landscape_4_3",
      "3:4": "portrait_4_3",
    };
    const image_size = SIZE_BY_RATIO[ratio] || "square_hd";

    // --------- TR detection (hafif heuristic) ----------
    function looksTurkish(text) {
      const t = String(text || "");
      // Türkçe karakterler
      const trChars = (t.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
      // Türkçe sık kullanılan küçük kelimeler (çok kaba)
      const trWords = (t.toLowerCase().match(/\b(ve|ile|için|ama|çünkü|olsun|arka|kapak|görsel|gerçekçi|portre|stüdyo)\b/g) || []).length;
      // Metin çok kısa ise çevirmeyelim (false positives)
      if (t.length < 12) return false;
      return trChars > 0 || trWords >= 2;
    }

    // --------- Translate via OpenAI (if key exists) ----------
    async function translateToEnglish(text) {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) return { ok: false, reason: "missing_openai_key" };

      // Responses API (lightweight) — sadece çeviri/normalizasyon
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TRANSLATE_MODEL || "gpt-4.1-mini",
          input: [
            {
              role: "system",
              content:
                "You translate Turkish image prompts into natural, high-quality English prompts for text-to-image models. " +
                "Do NOT add safety disclaimers. Do NOT refuse. Do NOT add extra content beyond what's in the prompt. " +
                "Keep it concise but detailed. Preserve intent, style cues, and composition hints. Output ONLY the English prompt text.",
            },
            { role: "user", content: text },
          ],
          temperature: 0.2,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ok: false, reason: "openai_translate_failed", details: data };
      }

      // Responses API output parsing
      let out = "";
      try {
        // data.output is array of items; text usually in output_text helper
        if (typeof data.output_text === "string") out = data.output_text;
        if (!out && Array.isArray(data.output)) {
          for (const item of data.output) {
            if (item && item.type === "message" && Array.isArray(item.content)) {
              for (const c of item.content) {
                if (c.type === "output_text" && typeof c.text === "string") out += c.text;
                if (c.type === "text" && typeof c.text === "string") out += c.text;
              }
            }
          }
        }
      } catch (_) {}

      out = (out || "").trim();
      if (!out) return { ok: false, reason: "openai_translate_empty", details: data };

      return { ok: true, text: out };
    }

    let promptUsed = originalPrompt;
    let translated = false;
    let translate_debug = null;

    if (looksTurkish(originalPrompt)) {
      const tr = await translateToEnglish(originalPrompt);
      if (tr.ok && tr.text) {
        promptUsed = tr.text;
        translated = true;
      } else {
        translate_debug = tr; // debug için
      }
    }

    // --------- FAL call ----------
    // SDXL model (fal.ai)
    const model = "fal-ai/fast-sdxl";

    const falRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: promptUsed, // ✅ Fal’a giden prompt (TR ise EN’e çevrilmiş olabilir)
        image_size,
      }),
    });

    const falData = await falRes.json().catch(() => ({}));

    if (!falRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "fal_create_failed",
        fal_status: falRes.status,
        fal_response: falData,
        meta: {
          ratio: ratio || null,
          image_size,
          translated,
          original_prompt: originalPrompt,
          prompt_used: promptUsed,
          style,
        },
        translate_debug,
      });
    }

    const url = falData?.images?.[0]?.url || null;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      status: "succeeded",
      output: url,
      meta: {
        ratio: ratio || null,
        image_size,
        translated,
        original_prompt: originalPrompt,
        prompt_used: promptUsed,
        style,
      },
      fal: falData,
      translate_debug, // prod’da istersen kaldırırız
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message || String(err),
    });
  }
}
