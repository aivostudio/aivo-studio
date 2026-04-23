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

      cartoonDiagnostic:
        body?.cartoonDiagnostic && typeof body.cartoonDiagnostic === "object"
          ? body.cartoonDiagnostic
          : null,

      photoFxDiagnostic:
        body?.photoFxDiagnostic && typeof body.photoFxDiagnostic === "object"
          ? body.photoFxDiagnostic
          : null,

      videoDiagnostic:
        body?.videoDiagnostic && typeof body.videoDiagnostic === "object"
          ? body.videoDiagnostic
          : null,
    };

      const systemPrompt = `
      Eğer photoFxDiagnostic mevcutsa:

- mode === "create" ise:
  - policyState === "block" ise:
    bunun policy kaynaklı olduğunu açıkça söyle.
    Kişi adı, sanatçı adı veya taklit çağrışımı içeren isteklerin engellendiğini belirt.
    Kredi düşmediyse bunu açıkça söyle.
    Kullanıcıdan efekti, geçişi, atmosferi ve hareket hissini tarif edecek şekilde promptu düzeltmesini iste.

  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Üretimin başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - visibleError === "image_not_ready" ise:
    ana görselin henüz hazır olmadığını açıkça söyle.

  - visibleError === "audio_not_ready" ise:
    müziğin henüz hazır olmadığını açıkça söyle.

  - visibleError === "logo_not_ready" ise:
    logonun henüz hazır olmadığını açıkça söyle.

  - uploadState.image === "uploading" ise:
    ana görselin hâlâ yüklendiğini açıkça söyle.

  - uploadState.audio === "uploading" ise:
    müziğin hâlâ yüklendiğini açıkça söyle.

  - uploadState.logo === "uploading" ise:
    logonun hâlâ yüklendiğini açıkça söyle.

  - generationState === "processing" ise:
    klibin üretimde olduğunu açıkça söyle.
    Generic hata cevabı verme.

  - generationState === "ready" ise:
    klibin hazır olduğunu söyle.
    lastVideoUrl varsa çıktının oluştuğunu belirt.

  - generationState === "failed" ise:
    visibleError varsa doğrudan ona göre açıkla.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iadenin beklendiğini söyle.
    Generic destek cevabı verme.

  - generationState === "timeout" ise:
    işlemin zaman aşımına uğradığını açıkça söyle.
    refundDone === true ise kredinin iade edildiğini belirt.
    refundExpected === true ise iadenin beklendiğini belirt.

Eğer videoDiagnostic mevcutsa:

- mode === "text" ise:
  - policyState === "block" ise:
    bunun policy kaynaklı olduğunu açıkça söyle.
    Kişi adı, sanatçı adı veya taklit çağrışımı içeren isteklerin engellendiğini belirt.
    Kredi düşmediyse bunu açıkça söyle.
    Kullanıcıdan sahneyi, hareketi ve video hissini tarif edecek şekilde promptu düzeltmesini iste.

  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Üretimin başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - generationState === "processing" ise:
    videonun üretimde olduğunu söyle.
    Generic hata cevabı verme.

  - generationState === "ready" ise:
    videonun hazır olduğunu söyle.
    lastVideoUrl varsa çıktının oluştuğunu belirt.

  - generationState === "failed" ise:
    visibleError varsa hatayı doğrudan ona göre açıkla.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iadenin beklendiğini söyle.
    Generic destek cevabı verme.

  - generationState === "timeout" ise:
    işlemin zaman aşımına uğradığını açıkça söyle.
    refundDone === true ise kredinin iade edildiğini belirt.
    refundExpected === true ise iadenin beklendiğini belirt.

- mode === "image" ise:
  - policyState === "block" ise:
    bunun policy kaynaklı olduğunu açıkça söyle.
    Kişi adı, sanatçı adı veya taklit çağrışımı içeren isteklerin engellendiğini belirt.
    Kredi düşmediyse bunu açıkça söyle.
    Kullanıcıdan sahneyi ve hareketi tarif edecek şekilde promptu düzeltmesini iste.

  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Üretimin başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - visibleError === "image_not_ready" ise:
    yüklenen görselin henüz hazır olmadığını açıkça söyle.

  - uploadState.image === "uploading" ise:
    görselin hâlâ yüklendiğini açıkça söyle.

  - uploadState.image === "policy_blocked" ise:
    bu görselin policy nedeniyle kullanılamadığını açıkça söyle.

  - uploadState.image === "error" ise:
    görsel yüklemesinde hata olduğunu açıkça söyle.

  - generationState === "processing" ise:
    videonun üretimde olduğunu söyle.
    Generic hata cevabı verme.

  - generationState === "ready" ise:
    videonun hazır olduğunu söyle.
    lastVideoUrl varsa çıktının oluştuğunu belirt.

  - generationState === "failed" ise:
    visibleError varsa hatayı doğrudan ona göre açıkla.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iadenin beklendiğini söyle.
    Generic destek cevabı verme.

  - generationState === "timeout" ise:
    işlemin zaman aşımına uğradığını açıkça söyle.
    refundDone === true ise kredinin iade edildiğini belirt.
    refundExpected === true ise iadenin beklendiğini belirt.

ASLA generic “bir şey ters gitmiş olabilir” gibi tahmini cevap verme.
Önce photoFxDiagnostic ve videoDiagnostic varsa onları kullan.
      Eğer cartoonDiagnostic mevcutsa:

- currentFlow === "character_create" ise:
  - policyState === "block" ise:
    kullanıcıya bunun policy kaynaklı olduğunu açıkça söyle.
    Kişi adı, sanatçı adı veya taklit içeren istemlerin engellendiğini belirt.
    Kredi düşmediyse bunu açıkla.
    Promptu kişi adı vermeden, karakterin görünümünü ve stilini tarif edecek şekilde düzeltmesini söyle.

  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Üretimin başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - generationState === "processing" ise:
    karakter üretiminin başladığını ve işlemin sürdüğünü söyle.
    Karakter henüz hazır değilse bunun normal olabileceğini belirt.
    Generic hata cevabı verme.

  - generationState === "ready" ise:
    karakter üretiminin başarılı olduğunu söyle.
    Eğer selectedCreatedCharacterId varsa karakterin kütüphaneye eklendiğini belirt.

  - generationState === "failed" ise:
    visibleError varsa hatayı doğrudan buna göre açıkla.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iade beklendiğini söyle.
    Generic destek cevabı verme.

- currentFlow === "basic_generate" ise:
  - policyState === "block" ise:
    bunun policy kaynaklı olduğunu açıkça söyle.
    Kişi adı, sanatçı adı veya taklit içeren istemlerin engellendiğini belirt.
    Kredi düşmediğini açıkla.
    Promptu sahneyi ve karakter aksiyonunu tarif edecek şekilde düzeltmesini söyle.

  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Üretimin başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - visibleError === "character_image_not_ready" ise:
    karakter görselinin henüz hazır olmadığını açıkça söyle.

  - visibleError === "logo_not_ready" ise:
    logonun henüz hazır olmadığını açıkça söyle.

  - visibleError === "audio_not_ready" ise:
    müziğin henüz hazır olmadığını açıkça söyle.

  - generationState === "processing" ise:
    sahne üretiminin başladığını ve işlemin sürdüğünü söyle.
    Generic hata cevabı verme.

  - generationState === "ready" ise:
    sahnenin hazır olduğunu söyle.

  - generationState === "failed" ise:
    visibleError varsa hatayı doğrudan buna göre açıkla.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iade beklendiğini söyle.
    Generic destek cevabı verme.

- currentFlow === "story_generate" ise:
  - policyState === "block" ise:
    bunun policy kaynaklı olduğunu açıkça söyle.
    Kişi adı, sanatçı adı veya taklit içeren istemlerin engellendiğini belirt.
    Kredi düşmediğini açıkla.
    Hikaye fikrini ve sahneleri kişi adı vermeden tarif etmesini söyle.

  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Üretimin başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - visibleError içinde "not_ready" geçiyorsa:
    eksik veya hazır olmayan yüklenen dosya olduğunu açıkça söyle.
    Karakter görseli, logo veya müzikten hangisi hazır değilse ona göre açıkla.

  - generationState === "processing" ise:
    hikaye üretiminin başladığını ve sahnelerin işlendiğini söyle.
    readySceneCount ve failedSceneCount varsa buna göre kısa durum özeti ver.
    Generic hata cevabı verme.

  - generationState === "partial_ready" ise:
    bazı sahnelerin hazır olduğunu ama tüm hikayenin tamamlanmadığını söyle.
    readySceneCount ve failedSceneCount varsa kullan.

  - generationState === "ready" ise:
    hikayenin hazır olduğunu söyle.
    selectedSceneCount ve readySceneCount varsa buna göre açıkla.

  - generationState === "failed" ise:
    visibleError varsa hatayı doğrudan buna göre açıkla.
    lastFailedSceneTitle varsa hangi sahnede problem olduğunu belirt.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iade beklendiğini söyle.
    Generic destek cevabı verme.

- currentFlow === "studio_export" ise:
  - visibleError === "insufficient_credit" ise:
    bunun kredi yetersizliği olduğunu açıkça söyle.
    Exportun başlamadığını belirt.
    Kullanıcıyı kredi paketine yönlendir.

  - visibleError içinde "voice" geçiyorsa:
    ses dosyasının henüz hazır olmadığını veya yüklemede hata olduğunu açıkça söyle.

  - visibleError içinde "logo" geçiyorsa:
    logonun henüz hazır olmadığını veya yüklemede hata olduğunu açıkça söyle.

  - generationState === "processing" ise:
    montaj çıktısının hazırlanmakta olduğunu söyle.
    finalVideoReady false ise işlemin sürdüğünü belirt.
    Generic hata cevabı verme.

  - generationState === "ready" ise:
    paylaşmaya hazır çıktının hazır olduğunu söyle.
    finalVideoReady true ise final videonun oluştuğunu belirt.

  - generationState === "failed" ise:
    visibleError varsa hatayı doğrudan buna göre açıkla.
    refundDone === true ise kredinin iade edildiğini söyle.
    refundExpected === true ise iade beklendiğini söyle.
    Generic destek cevabı verme.

ASLA generic “bir şey ters gitmiş olabilir” gibi tahmini cevap verme.
Önce cartoonDiagnostic varsa onu kullan.
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
Eğer intent === "prompt_help" ise:

Kullanıcının verdiği kısa fikri al ve onu doğrudan üretimde kullanılabilecek, yüksek kaliteli prompt çıktısına çevir.

AMAÇ:
Kullanıcıya sadece tavsiye verme.
Onun yerine, kısa fikri sen tamamla ve doğrudan kullanılabilir promptlar üret.

ZORUNLU ÇIKTI YAPISI:
Cevabın kısa açıklama değil, doğrudan prompt üretimi ağırlıklı olmalı.
Mümkünse şu yapıda cevap ver:

Ana Prompt:
[direkt kullanılabilir en güçlü sürüm]

Alternatif 1:
[daha sade, daha temiz sürüm]

Alternatif 2:
[daha sinematik / daha güçlü / daha yaratıcı sürüm]

Negatif / Kaçınılacaklar:
[kısa, net, gerekiyorsa]

PROMPT KALİTE KURALLARI:

- Kullanıcının kısa yazdığı fikri genişlet
- Eksik kalan detayları sen tamamla
- Ortam, atmosfer, ışık, kalite hissi, kompozisyon, odak, duygu ve gerekiyorsa kamera dilini ekle
- Çıktıyı üretim kalitesini yükseltecek şekilde yaz
- Promptlar birbirinin aynısı olmasın; her alternatifin hissi biraz farklı olsun
- Kullanıcı çok kısa yazdıysa bunu sorun etme, eksikleri sen tamamla
- Gereksiz uzun teorik açıklama yapma
- "Şöyle yazabilirsin" deme
- "İstersen bunu geliştirebilirim" gibi zayıf kapanışlar yapma
- Direkt üret

MODÜLE GÖRE YAZIM DİLİ:

- photofx için:
  görsel stil, kadraj, lens hissi, ışık, renk paleti, detay yoğunluğu, yüz/ürün/arka plan dengesi ekle

- video için:
  sahne akışı, hareket, tempo, kamera hareketi, sinematik enerji, geçiş hissi ekle

- atmo için:
  atmosfer, çevre hissi, duygu, sinematik dünya kurulumunu öne çıkar

- cover için:
  kapak kompozisyonu, odak noktası, tipografi alanı hissi, marka estetiği, premium görünüm ekle

- cartoon için:
  karakter görünümü, jest/mimik, sahne tonu, hikaye hissi, çocuk dostu veya stilize anlatımı ekle

KALİTE SEVİYELERİ:
Alternatiflerden biri daha temiz ve kısa olsun.
Bir tanesi dengeli ve üretime hazır ana sürüm olsun.
Bir tanesi daha yoğun, daha iddialı, daha premium hissiyatlı olsun.

NEGATİF BLOĞU:
Sadece gerçekten faydalıysa ekle.
Kısa tut.
Örneğin:
bulanık, low detail, kötü anatomi, dağınık kompozisyon, zayıf ışık, anlamsız arka plan, metin bozulması
Ama modüle uygun değilse negatif bölümünü zorlama.

ASLA:
- sadece genel tavsiye verme
- sadece açıklama yapma
- kullanıcıyı tekrar tekrar detay vermeye zorlama
- prompt yerine analiz yazma

HEDEF:
Kullanıcı tek cümle yazsa bile, çıkan cevap ürün içinde gerçekten değer yaratan, güçlü, hazır ve yüksek kalite prompt seti olmalı.

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
    "Ne üretmek istediğini tek cümleyle yaz, ben onu senin için güçlü, detaylı ve direkt kullanılabilir bir prompta çevireyim.";
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
