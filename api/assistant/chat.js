export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY tanımlı değil.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const page = typeof body?.page === "string" ? body.page : "";
    const userMessage =
      typeof body?.message === "string" && body.message.trim()
        ? body.message.trim()
        : messages.length
        ? String(messages[messages.length - 1]?.content || "").trim()
        : "";

    if (!userMessage) {
      return res.status(400).json({ error: "Mesaj boş olamaz." });
    }

    const systemPrompt = `
Sen AIVO içindeki yardımcı asistansın.

Görevlerin:
- Hangi modül ne işe yarar, kısa ve net açıkla.
- Kullanıcının ihtiyacına göre doğru aracı öner.
- Paket seçimi konusunda yönlendir.
- Kredi sistemini sade şekilde anlat.
- Sorun yaşayan kullanıcıya kısa, uygulanabilir çözüm adımları ver.
- Prompt yazarken kullanıcıya daha güçlü prompt önerileri üret.
- Cevapların kısa, net, sıcak ve yönlendirici olsun.
- Gereksiz uzun anlatım yapma.
- AIVO dışı alakasız konulara dağılma.
- Teknik terimleri mümkün olduğunca sade anlat.
- Uygun olduğunda kullanıcıyı ilgili modüle veya sonraki adıma yönlendir.

AIVO sayfa bağlamı:
${page || "Belirtilmedi"}
    `.trim();

    const input = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages
        .filter((msg) => msg && typeof msg.content === "string" && msg.content.trim())
        .map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content.trim(),
        })),
    ];

    if (!messages.length) {
      input.push({
        role: "user",
        content: userMessage,
      });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input,
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: data?.error?.message || "OpenAI isteği başarısız oldu.",
        details: data,
      });
    }

   let text =
  data?.output_text ||
  data?.output
    ?.flatMap((item) => item?.content || [])
    ?.filter((item) => item?.type === "output_text")
    ?.map((item) => item?.text || "")
    ?.join("\n")
    ?.trim() ||
  "Şu anda cevap üretilemedi.";

text = text
  .replace(/\*\*(.*?)\*\*/g, "$1")
  .replace(/^\s*-\s+/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

    return res.status(200).json({
      ok: true,
      message: text,
      id: data?.id || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Sunucu hatası oluştu.",
      details: error?.message || String(error),
    });
  }
}
