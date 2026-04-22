import {
  getAivoRegistry,
  getAivoModule,
  getPricingRegistry,
  findModuleByAlias,
  findActionInModule,
} from "../_lib/assistant/aivo-registry.js";

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
    const intent = typeof body?.intent === "string" ? body.intent.trim() : "";
    const action = typeof body?.action === "string" ? body.action.trim() : "";
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
        ? (
            detectedModule.actions?.find((item) => item?.key === action) ||
            findActionInModule(
              detectedModule.key,
              `${action} ${actionContext} ${currentPanel} ${currentCardType} ${selectedItemType} ${userMessage} ${availableActions.join(" ")}`
            )
          )
        : null;

      const assistantContext = {
      page: page || null,
      module: moduleName || null,
      intent: intent || null,
      action: action || null,
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
         coverDiagnostic:
        body?.coverDiagnostic && typeof body.coverDiagnostic === "object"
          ? body.coverDiagnostic
          : null,

      atmoDiagnostic:
        body?.atmoDiagnostic && typeof body.atmoDiagnostic === "object"
          ? body.atmoDiagnostic
          : null,
    };

      const systemPrompt = `
Eğer atmoDiagnostic mevcutsa:

- policyState === "block" ise:
  kullanıcıya bunun policy kaynaklı olduğunu açıkça söyle.
  Kişi adı, sanatçı adı veya taklit içeren istemlerin engellendiğini belirt.
  Kredi düşmediğini açıkla.
  Promptu kişi adı vermeden, sahneyi ve video hissini tarif edecek şekilde düzeltmesini söyle.

- visibleError === "insufficient_credit" ise:
  bunun kredi yetersizliği olduğunu açıkça söyle.
  Üretimin başlamadığını belirt.
  Kullanıcıyı kredi paketine yönlendir.

- generationState === "processing" ise:
  üretimin başladığını ve işlemin sürdüğünü söyle.
  Video henüz hazır değilse bunun normal olabileceğini belirt.
  Generic hata cevabı verme.

- generationState === "ready" ve lastVideoUrl varsa:
  videonun hazır olduğunu söyle.

- generationState === "failed" ise:
  visibleError varsa hatayı doğrudan buna göre açıkla.
  refundDone === true ise kredinin iade edildiğini söyle.
  refundExpected === true ise iade beklendiğini söyle.
  Generic destek cevabı verme.

ASLA generic “kırmızı uyarı olabilir” veya “bir şey ters gitmiş olabilir” gibi tahmini cevap verme.
Önce atmoDiagnostic varsa onu kullan.

Eğer coverDiagnostic mevcutsa:

- policyState === "block" ise:
  → kullanıcıya bunun policy kaynaklı olduğunu açıkça söyle
  → sanatçı adı, kişi adı veya taklit içeren istemlerin engellendiğini belirt
  → kredi düşmediğini açıkla
  → nasıl düzeltileceğini kısa ve net öner

- generationState === "failed" ve visibleError varsa:
  → hatayı direkt ona göre açıkla, genel cevap verme

- generationState === "ready":
  → üretimin başarılı olduğunu söyle

ASLA generic “kırmızı uyarı olabilir” gibi tahmini cevap verme.
Önce coverDiagnostic varsa onu kullan.
Sen AIVO içindeki ürün içi yardımcı asistansın.

Senin görevin sohbet etmek değil, kullanıcının AIVO içinde bulunduğu ekranı ve gerçek akışı anlayıp doğru yönlendirmeyi yapmaktır.

EN KRİTİK KURAL:
Asla uydurma bilgi verme.
Registry veya mevcut bağlam içinde olmayan bir özellik, kredi bilgisi, süre, buton, menü, modal veya akış varmış gibi konuşma.

ÖNCELİK SIRASI:
1. Önce body içinden gelen intent sinyaline bak. Eğer intent doluysa bunu birincil karar girdisi olarak kullan.
2. Sonra mevcut runtime bağlamına bak.
3. Sonra detectedModule ve detectedAction bilgisine bak.
4. Sonra ilgili pricing veya modül bilgisini kullan.
5. Hâlâ veri yoksa bunu kısa ve dürüst biçimde söyle, ama kullanıcıyı doğru ekran veya doğru aksiyona yönlendir.

CEVAP MANTIĞI:
- Eğer intent varsa önce intent'e göre karar ver, sonra metni yorumla.
- intent "product_action" veya action doluysa önce gerçek ürün içi yolu söyle.
- intent "prompt_help" ise prompt desteğine geç, ama ürün içi aksiyon sorusunu prompt konusuna çevirme.
- intent "pricing_guidance" ise pricing bilgisini öncelikli kullan.
- intent "troubleshooting" ise lastJobStatus, hasSelection, visibleModals ve detectedAction bilgisiyle konuş.
- intent "module_selection" ise en uygun modülü veya en uygun 2 modülü kısa farklarıyla öner.
- Kullanıcının sorusu tek bir gerçek aksiyona gidiyorsa, tek net cevap ver.
- Kullanıcı prompt istemiyorsa prompt tavsiyesi verme.

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

    const brainSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        intent: {
          type: "string",
          enum: [
            "general_help",
            "module_selection",
            "product_action",
            "troubleshooting",
            "pricing_guidance",
            "prompt_help",
          ],
        },
        module: {
          type: ["string", "null"],
        },
        action: {
          type: ["string", "null"],
        },
        answer: {
          type: "string",
        },
        uiTarget: {
          type: ["string", "null"],
        },
        followupAction: {
          type: ["string", "null"],
        },
        needsConfirmation: {
          type: "boolean",
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
      },
      required: [
        "intent",
        "module",
        "action",
        "answer",
        "uiTarget",
        "followupAction",
        "needsConfirmation",
        "confidence",
      ],
    };

    const input = [
      {
        role: "system",
        content:
          systemPrompt +
          `

ÇIKTI KURALI:
Kullanıcıya serbest metin değil, aşağıdaki şemaya uygun TEK bir JSON nesnesi üret.
JSON dışında hiçbir şey yazma.
answer alanı kullanıcıya gösterilecek kısa ve net metindir.
module alanında mümkünse registry module key kullan.
action alanında mümkünse gerçek action key kullan.
uiTarget alanında mümkünse gerçek UI konumu yaz.
followupAction alanında mümkünse bir sonraki önerilen ürün içi aksiyonu yaz.
needsConfirmation true ise işlem öncesi onay veya kredi onayı gerekir.`,
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
        text: {
          format: {
            type: "json_schema",
            name: "aivo_brain_response",
            schema: brainSchema,
            strict: true,
          },
        },
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: data?.error?.message || "OpenAI isteği başarısız oldu.",
        details: data,
      });
    }

    const rawText =
      data?.output_text ||
      data?.output
        ?.flatMap((item) => item?.content || [])
        ?.filter((item) => item?.type === "output_text")
        ?.map((item) => item?.text || "")
        ?.join("\n")
        ?.trim() ||
      "";

    let brain = null;

    try {
      brain = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
      brain = null;
    }

      if (!brain || typeof brain !== "object") {
      const fallbackIntent =
        intent ||
        (action ? "product_action" : "") ||
        (detectedAction?.key ? "product_action" : "") ||
        (detectedModule?.key ? "module_selection" : "") ||
        "general_help";

      const fallbackAction =
        action ||
        detectedAction?.key ||
        null;

      const fallbackModule =
        moduleName ||
        detectedModule?.key ||
        (page === "pricing" ? "pricing" : null);

      let fallbackAnswer =
        "Şu anda net bir yönlendirme üretemedim. Bulunduğun ekrana göre tekrar sorarsan daha doğru yönlendirebilirim.";

      if (fallbackIntent === "pricing_guidance") {
        fallbackAnswer =
          "Paket yönlendirmesi yapabilirim. Şu anki kullanım amacını söylersen en uygun kredi paketini daha net önerebilirim.";
      } else if (fallbackIntent === "troubleshooting") {
        fallbackAnswer =
          "Sorunu çözmek için bulunduğun ekrandaki durum, seçim ve işlem bağlamına bakmam gerekiyor. Aynı ekranda tekrar sorarsan daha net yönlendirebilirim.";
      } else if (fallbackIntent === "prompt_help") {
        fallbackAnswer =
          "Promptunu güçlendirmene yardımcı olabilirim. Ne üretmek istediğini kısa yazman yeterli.";
      } else if (fallbackIntent === "module_selection") {
        fallbackAnswer =
          "İhtiyacına göre doğru modülü seçmene yardımcı olabilirim. Ne üretmek istediğini kısa yaz.";
      } else if (fallbackIntent === "product_action" && fallbackAction) {
        fallbackAnswer =
          "Bu işlem için doğru ürün içi adıma yönlendirme yapabilirim. Aynı ekranda tekrar sorarsan daha net ve doğrudan yol tarif ederim.";
      }

      brain = {
        intent: fallbackIntent,
        module: fallbackModule,
        action: fallbackAction,
        answer: fallbackAnswer,
        uiTarget: actionContext || currentPanel || null,
        followupAction: fallbackAction,
        needsConfirmation: Boolean(
          detectedAction?.confirmationRequired ||
          visibleModals.length
        ),
        confidence: "low",
      };
    }

    const safeAnswer = String(brain.answer || "Şu anda cevap üretilemedi.")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/^\s*-\s+/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return res.status(200).json({
      ok: true,
      id: data?.id || null,
      message: safeAnswer,
      brain: {
        intent: brain.intent || "general_help",
        module: brain.module || null,
        action: brain.action || null,
        answer: safeAnswer,
        uiTarget: brain.uiTarget || null,
        followupAction: brain.followupAction || null,
        needsConfirmation: Boolean(brain.needsConfirmation),
        confidence: brain.confidence || "low",
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Sunucu hatası oluştu.",
      details: error?.message || String(error),
    });
  }
}
