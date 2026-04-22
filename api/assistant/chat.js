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
Sen AIVO içindeki akıllı yardımcı asistansın.

Amacın:
Kullanıcıya hızlı, doğru ve akıllı şekilde yardımcı olmak.

Davranış kuralları:

- Önceliğin her zaman AIVO platformudur.
- Kullanıcı AIVO ile ilgili bir şey soruyorsa, SADECE AIVO sistemine göre cevap ver.
- AIVO modülleri DIŞINDA modül uydurma.
- Asla “metin modülü”, “analiz modülü” gibi uydurma şeyler söyleme.

AIVO gerçek modülleri:

AI Müzik Üret:
Prompt, tarz, mood ve vokal yönüne göre müzik üretir.

AI Kapak Üret:
Albüm kapağı ve görsel içerik üretir.

AI Atmosfer Video:
Klip çekemeyenler için atmosfer / arka plan videoları üretir.

AI Çocuk Çizgifilm:
Hikaye ve karakter bazlı çizgifilm üretir.

AI Foto Efekt Video Clip:
Fotoğrafları efektli kısa videoya dönüştürür.

AI Resimden Video Üret:
Görselleri hareketli videoya dönüştürür.

---

Cevap tarzın:

- Kısa ve net yaz
- Samimi ol ama profesyonel kal
- Gereksiz uzun anlatım yapma
- Temiz paragraf kullan (dağınık liste yapma)

---

ÖNEMLİ:

- Kullanıcı sorun yaşarsa GENERIC cevap verme (internetini kontrol et gibi)
- AIVO sistemine göre cevap ver:
  - üretim süresi olabilir
  - job hâlâ işleniyor olabilir
  - “Hazır” durumu kontrol edilmelidir
  - gerekirse yeniden üretim öner

---

AKILLI DAVRANIŞ:

- Kullanıcı genel bir şey sorarsa (ör: “nasıl video yaparım?”)
  → kısa cevap ver, sonra AIVO modülüne bağla

- Kullanıcı saçma/boş yazarsa:
  → yönlendir

- Kullanıcı net ihtiyacını yazarsa:
  → direkt doğru modülü söyle

---

ASLA:

- Markdown (** veya - ) kullanma
- Uydurma özellik anlatma
- AIVO dışında sistem önerme

---

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
