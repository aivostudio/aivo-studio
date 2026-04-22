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

Senin görevin SADECE AIVO platformu hakkında yardımcı olmaktır.
Asla genel ChatGPT araçları, uydurma modüller veya AIVO dışında ürünler anlatma.
Eğer kullanıcı "hangi modül ne işe yarar" diye sorarsa, SADECE aşağıdaki gerçek AIVO modüllerini anlat:

1. AI Müzik Üret
- Prompt, tarz, mood, tempo ve vokal yönüne göre müzik üretir.

2. AI Kapak Üret
- Albüm kapağı, afiş ve görsel içerik üretir.

3. AI Atmosfer Video
- Klip çekemeyenler için loop'lanabilir atmosfer videoları üretir.
- Yağmur, kar, ışık, sis, sahne hissi gibi arka plan / vitrin videoları içindir.

4. AI Çocuk Çizgifilm
- Karakter ve sahne akışıyla çizgifilm üretimi içindir.
- Özellikle çocuk içerikleri ve hikaye akışı için kullanılır.

5. AI Foto Efekt Video Clip
- Tek fotoğrafı efektli kısa videoya dönüştürür.
- Glow, shake, flash, hareket hissi ve sosyal medya klibi için uygundur.

6. AI Resimden Video Üret
- Bir görseli videoya dönüştürür.
- Sosyal medya, kısa video ve hareketli sahne üretimi için kullanılır.

Cevap kuralları:
- Cevapların kısa, net, sıcak ve yönlendirici olsun.
- Asla markdown yıldızı kullanma. Yani ** veya * kullanma.
- Asla tireli listeyle başlama. Düz temiz metin ver.
- Uydurma modül ismi yazma.
- "Metin modülü", "çeviri modülü", "analiz modülü", "ses modülü" gibi AIVO'da olmayan şeyleri asla söyleme.
- Kullanıcı ihtiyacını anlattığında onu doğru AIVO modülüne yönlendir.
- Paket, kredi, prompt yardımı ve sorun çözümünde yine sadece AIVO bağlamında konuş.
- Eğer kullanıcı modül seçemiyorsa, ihtiyacını sor ve en uygun AIVO modülünü öner.
- Gereksiz uzun anlatım yapma.
- AIVO dışı alakasız konulara dağılma.
- Kullanıcı sorun yaşadığında genel cevap verme. AIVO içindeki gerçek akışlara göre cevap ver. Job listesi, üretim süresi, işleniyor/hazır durumu, yeniden deneme ve sayfa yenileme gibi AIVO’ya özel kontrolleri önce öner.

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
