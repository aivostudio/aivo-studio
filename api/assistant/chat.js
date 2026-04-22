import {
  getAivoRegistry,
  getAivoModule,
  getPricingRegistry,
  findModuleByAlias,
  findActionInModule,
} from "../../lib/assistant/aivo-registry.js";

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

    const page = typeof body?.page === "string" ? body.page.trim() : "";
    const moduleName = typeof body?.module === "string" ? body.module.trim() : "";
    const actionContext =
      typeof body?.actionContext === "string" ? body.actionContext.trim() : "";
    const currentPanel =
      typeof body?.currentPanel === "string" ? body.currentPanel.trim() : "";
    const currentCardType =
      typeof body?.currentCardType === "string" ? body.currentCardType.trim() : "";
    const selectedItemType =
      typeof body?.selectedItemType === "string" ? body.selectedItemType.trim() : "";
    const lastJobStatus =
      typeof body?.lastJobStatus === "string" ? body.lastJobStatus.trim() : "";
    const userCredits =
      Number.isFinite(Number(body?.userCredits)) ? Number(body.userCredits) : null;
    const creditsNeeded =
      Number.isFinite(Number(body?.creditsNeeded)) ? Number(body.creditsNeeded) : null;
    const hasSelection =
      typeof body?.hasSelection === "boolean" ? body.hasSelection : null;

    const availableActions = Array.isArray(body?.availableActions)
      ? body.availableActions
          .filter((v) => typeof v === "string" && v.trim())
          .map((v) => v.trim())
      : [];

    const visibleModals = Array.isArray(body?.visibleModals)
      ? body.visibleModals
          .filter((v) => typeof v === "string" && v.trim())
          .map((v) => v.trim())
      : [];

    const currentProductCards = Array.isArray(body?.currentProductCards)
      ? body.currentProductCards
          .filter((v) => v && typeof v === "object")
          .map((v) => ({
            key: typeof v.key === "string" ? v.key : null,
            label: typeof v.label === "string" ? v.label : null,
            priceTRY: Number.isFinite(Number(v.priceTRY)) ? Number(v.priceTRY) : null,
            credits: Number.isFinite(Number(v.credits)) ? Number(v.credits) : null,
          }))
      : [];

    const uiState =
      body?.uiState && typeof body.uiState === "object" && !Array.isArray(body.uiState)
        ? body.uiState
        : {};

    const userMessage =
      typeof body?.message === "string" && body.message.trim()
        ? body.message.trim()
        : messages.length
        ? String(messages[messages.length - 1]?.content || "").trim()
        : "";

    if (!userMessage) {
      return res.status(400).json({ error: "Mesaj boş olamaz." });
    }

    const registry = getAivoRegistry();
    const pricingRegistry = getPricingRegistry();

    const detectedModule =
      getAivoModule(moduleName) ||
      getAivoModule(page) ||
      findModuleByAlias(`${moduleName} ${page} ${actionContext} ${userMessage}`);

    const detectedAction =
      detectedModule?.key
        ? findActionInModule(
            detectedModule.key,
            `${actionContext} ${currentPanel} ${currentCardType} ${selectedItemType} ${userMessage} ${availableActions.join(" ")}`
          )
        : null;

    const assistantContext = {
      page: page || null,
      module: moduleName || null,
      detectedModule: detectedModule
        ? {
            key: detectedModule.key,
            page: detectedModule.page,
            label: detectedModule.label,
            purpose: detectedModule.purpose,
            actions: detectedModule.actions || [],
            troubleshooting: detectedModule.troubleshooting || [],
          }
        : null,
      detectedAction: detectedAction || null,
      actionContext: actionContext || null,
      currentPanel: currentPanel || null,
      currentCardType: currentCardType || null,
      selectedItemType: selectedItemType || null,
      lastJobStatus: lastJobStatus || null,
      userCredits,
      creditsNeeded,
      hasSelection,
      availableActions,
      visibleModals,
      currentProductCards,
      uiState,
      pricing: {
        page: pricingRegistry?.page || "pricing",
        label: pricingRegistry?.label || "Fiyatlandırma",
        packages: pricingRegistry?.packages || [],
        recommendationRules: pricingRegistry?.recommendationRules || [],
      },
      registrySummary: {
        app: registry?.app || null,
        moduleKeys: registry?.modules ? Object.keys(registry.modules) : [],
      },
    };

    const systemPrompt = `
Sen AIVO içindeki ürün içi yardımcı asistansın.

Senin görevin sohbet etmek değil, kullanıcının AIVO içinde bulunduğu ekranı ve gerçek akışı anlayıp doğru yönlendirmeyi yapmaktır.

EN KRİTİK KURAL:
Asla uydurma bilgi verme.
Registry veya mevcut bağlam içinde olmayan bir özellik, kredi bilgisi, süre, buton, menü, modal veya akış varmış gibi konuşma.

ÖNCELİK SIRASI:
1. Önce mevcut runtime bağlamına bak.
2. Sonra detectedModule ve detectedAction bilgisine bak.
3. Sonra ilgili pricing veya modül bilgisini kullan.
4. Hâlâ veri yoksa bunu kısa ve dürüst biçimde söyle, ama kullanıcıyı doğru ekran veya doğru aksiyona yönlendir.

CEVAP MANTIĞI:
- Kullanıcı bir işlemin nasıl yapıldığını soruyorsa, önce gerçek ürün içi yolu söyle.
- Kullanıcı prompt istemiyorsa prompt tavsiyesi verme.
- Kullanıcı kredi veya paket soruyorsa pricing bilgisini kullan.
- Kullanıcı sorun çözme soruyorsa lastJobStatus, hasSelection, visibleModals ve detectedAction bilgisiyle konuş.
- Kullanıcı bir modül seçmeye çalışıyorsa en uygun modülü veya en uygun 2 modülü kısa farklarıyla öner.
- Kullanıcının sorusu tek bir gerçek aksiyona gidiyorsa, tek net cevap ver.

ÖZEL KURAL: MÜZİK
Kullanıcı kanal ayırma, stem, vokal ayırma, enstrüman ayırma gibi bir şey soruyorsa bunu prompt konusu sanma.
Eğer detectedModule music ise ve detectedAction channel_separation ise kullanıcıyı müzik kartı > 3 nokta menü > Kanal Ayırma akışına yönlendir.
Eğer creditCost ve confirmationRequired bilgisi varsa bunu açıkça söyle.

ÖZEL KURAL: PAKET VE KREDİ
Kullanıcı hangi paketi alması gerektiğini, kaç kredi gerektiğini veya paket farklarını soruyorsa pricing.packages ve recommendationRules bilgisini kullan.
Elinde paket verisi varken “bilmiyorum” deme.
Ancak registry’de olmayan bir kredi tüketim kuralını kesin sayı gibi uydurma.
Örneğin çizgifilmde 3 dakika 4 karakter için net kredi hesabı registry’de yoksa bunu dürüstçe söyle ve kesin sayı verme.

ÖZEL KURAL: DURUM VE HATA
Asla “internetini kontrol et” gibi generic destek cevabı verme.
Önce şu olasılıklarla konuş:
işlem sürüyor olabilir
ilgili kart hazır olmayabilir
seçim yapılmamış olabilir
onay modalı bekliyor olabilir
kredi yetersiz olabilir
kullanıcı yanlış modülde olabilir

YAZIM KURALI:
- Markdown kullanma
- Madde imi kullanma
- Kısa paragraf kullan
- Net ol
- Emin olmadığın şeyi kesin söyleme
- AIVO dışı araç önermeme

Eğer kullanıcı sadece genel selamlama veya boş başlangıç yaptıysa, kısa şekilde AIVO içinde hangi konuda yardım edebileceğini söyle.
Eğer kullanıcı çok spesifik ürün içi soru sorduysa doğrudan cevaba gir.

Mevcut AIVO bağlamı:
${JSON.stringify(assistantContext, null, 2)}
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
