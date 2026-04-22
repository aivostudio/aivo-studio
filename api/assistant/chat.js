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

    const capabilityMap = {
      music: {
        label: "AI Müzik Üret",
        purpose: "Prompt, tarz, mood ve vokal yönüne göre müzik üretir.",
        realActions: [
          {
            key: "generate_music",
            label: "Müzik üret",
            trigger: "Müzik üretim alanı",
            result: "Yeni müzik üretimi başlatır",
          },
          {
            key: "channel_separation",
            label: "Kanal Ayırma",
            trigger: "Müzik kartı > 3 nokta menü",
            requiresSelection: true,
            confirmationRequired: true,
            creditCost: 5,
            result: "Şarkıyı stem veya kanal katmanlarına ayırır",
          },
          {
            key: "mastering",
            label: "Mastering",
            trigger: "Müzik kartı > 3 nokta menü veya ilgili aksiyon alanı",
            requiresSelection: true,
            result: "Parçayı daha dengeli ve finale yakın hale getirir",
          },
          {
            key: "download_music",
            label: "İndir",
            trigger: "Müzik kartı aksiyonları",
            requiresSelection: true,
            result: "Üretilen içeriği indirir",
          },
        ],
        troubleshooting: [
          "Kullanıcı bir işlem başlattıysa önce ilgili müzik kartını ve kart aksiyonlarını referans al",
          "Job processing ise bekleme ve kart durumu kontrolünü söyle",
          "Job hazır ise kart üzerinden sonraki aksiyonu söyle",
          "Kanal ayırma gibi kart bazlı işlemlerde prompt önerme; gerçek UI akışını anlat",
        ],
      },
      cover: {
        label: "AI Kapak Üret",
        purpose: "Albüm kapağı ve görsel içerik üretir.",
        realActions: [
          {
            key: "generate_cover",
            label: "Kapak üret",
            trigger: "Kapak üretim alanı",
            result: "Yeni kapak görseli üretir",
          },
          {
            key: "overlay_text",
            label: "Yazı ekleme veya kapak üstü düzenleme",
            trigger: "Kapak sonrası düzenleme akışı",
            result: "Kapak üzerine yazı veya ek düzen uygular",
          },
        ],
      },
      atmo: {
        label: "AI Atmosfer Video",
        purpose: "Klip çekemeyenler için atmosfer veya arka plan videoları üretir.",
        realActions: [
          {
            key: "generate_atmo_video",
            label: "Atmosfer video üret",
            trigger: "Atmosfer video üretim alanı",
            result: "Arka plan veya atmosfer tipi video üretir",
          },
          {
            key: "overlay_logo",
            label: "Logo bindirme",
            trigger: "Video sonrası işlem alanı",
            result: "Videoya logo ekler",
          },
        ],
      },
      photofx: {
        label: "AI Foto Efekt Video Clip",
        purpose: "Fotoğrafları efektli kısa videoya dönüştürür.",
        realActions: [
          {
            key: "generate_photofx",
            label: "Efekt video üret",
            trigger: "PhotoFX üretim alanı",
            result: "Fotoğraftan efektli kısa video üretir",
          },
          {
            key: "overlay_logo",
            label: "Logo bindirme",
            trigger: "Video sonrası işlem alanı",
            result: "Videoya logo ekler",
          },
        ],
      },
      video: {
        label: "AI Resimden Video Üret",
        purpose: "Görselleri hareketli videoya dönüştürür.",
        realActions: [
          {
            key: "generate_image_to_video",
            label: "Resimden video üret",
            trigger: "Video üretim alanı",
            result: "Görseli hareketli videoya dönüştürür",
          },
          {
            key: "download_video",
            label: "Videoyu indir",
            trigger: "Video kartı aksiyonları",
            requiresSelection: true,
            result: "Üretilen videoyu indirir",
          },
        ],
      },
      cartoon: {
        label: "AI Çocuk Çizgifilm",
        purpose: "Hikaye ve karakter bazlı çizgifilm üretir.",
        realActions: [
          {
            key: "story_create",
            label: "Hikaye oluştur",
            trigger: "Çizgifilm üretim akışı",
            result: "Karakter ve hikaye bazlı üretim başlatır",
          },
          {
            key: "export_create",
            label: "Dışa aktar",
            trigger: "Çizgifilm sonuç alanı",
            result: "Üretilen işi çıktı olarak hazırlar",
          },
        ],
      },
    };

    const assistantContext = {
      page: page || null,
      module: moduleName || null,
      actionContext: actionContext || null,
      currentPanel: currentPanel || null,
      currentCardType: currentCardType || null,
      selectedItemType: selectedItemType || null,
      lastJobStatus: lastJobStatus || null,
      userCredits,
      creditsNeeded,
      hasSelection,
      availableActions,
      uiState,
      capabilityMap,
    };

    const systemPrompt = `
Sen AIVO içindeki ürün zekası yüksek yardımcı asistansın.

Senin görevin sadece sohbet etmek değil.
Sen, kullanıcının bulunduğu ekranı, modülü, kartı, menüyü, aksiyonu ve işlem durumunu anlayıp onu DOĞRU ürüniçi adıma yönlendiren karar motorusun.

EN KRİTİK KURAL:
Bilmediğin şeyi ASLA uydurma.
Eğer bağlamda olmayan bir buton, menü, özellik, kredi bilgisi veya akış yoksa, varmış gibi anlatma.
Eğer yeterli bağlam yoksa kısa bir netleştirme sorusu sor veya mevcut bağlama göre güvenli yönlendirme yap.

ANA DAVRANIŞ:
1. Önceliğin her zaman AIVO içindeki GERÇEK akışlardır.
2. Kullanıcı bir işlemin nasıl yapılacağını soruyorsa önce prompt önerme, önce gerçek UI akışını anlat.
3. Kullanıcının sorusu bir kart menüsü, 3 nokta menü, onay modalı, kredi kesimi, hazır durumu, işleniyor durumu veya export ile ilgiliyse bunu ürün içi operasyon olarak ele al.
4. Kullanıcı prompt istemiyorsa prompt tavsiyesiyle kaçma.
5. Kullanıcı sorun bildiriyorsa generic teknik destek cümlesi kurma.
6. AIVO dışında araç, site, uygulama veya workflow önerme.
7. Cevapların kısa, net, doğal ve güven veren yapıda olsun.

KULLANIM MANTIĞI:
- Önce kullanıcının niyetini sınıflandır:
  a) modül seçimi
  b) ürün içinde bir işlemin nasıl yapıldığı
  c) sorun çözme
  d) kredi veya paket yönlendirmesi
  e) prompt yardımı
- Eğer soru ürün içinde bir işlemin nasıl yapıldığıyla ilgiliyse:
  önce mevcut page, module, actionContext, availableActions ve capabilityMap bilgilerine bak
  sonra gerçek tetikleme yolunu söyle
  sonra gerekiyorsa kredi veya durum bilgisini söyle
- Eğer soru sorun çözmeyle ilgiliyse:
  önce lastJobStatus ve mevcut modül bağlamına bak
  hazır, processing, failed, selection missing, confirmation pending gibi somut durumlarla konuş
- Eğer kullanıcı yanlış modüldeyse bunu nazikçe söyle ve doğru modüle yönlendir
- Eğer birden fazla modül mantıklıysa en uygun 2 modülü kısa farklarıyla öner
- Eğer tek doğru akış varsa tek akış söyle

MÜZİK İÇİN ÖZEL KURAL:
Eğer kullanıcı şarkıyı parçalara ayırmak, stem almak, kanal ayırmak, vokal ayırmak, enstrümanları ayırmak, davul bas gitar ayrı almak gibi bir şey soruyorsa:
Bunu prompt konusu sanma.
Bunu AI Müzik Üret içindeki kart bazlı işlem olarak yorumla.
Eğer bağlam music modülünü veya music card aksiyonlarını gösteriyorsa kullanıcıyı müzik kartı üzerindeki gerçek aksiyona yönlendir.
Eğer capabilityMap içinde channel_separation varsa bunu temel al.
Bu durumda “prompta enstrüman yaz” tarzı yanlış yönlendirme yapma.

SORUN ÇÖZME KURALI:
Asla “internetini kontrol et”, “yeniden başlat”, “bir süre sonra tekrar dene” gibi boş destek cevaplarıyla açılış yapma.
Önce AIVO içi en olası gerçek nedeni söyle.
Örnek:
- işlem hâlâ sürüyor olabilir
- ilgili kart henüz hazır olmayabilir
- seçim yapılmadan aksiyon kullanılamaz
- kredi onayı bekleniyor olabilir
- doğru kart menüsüne girilmemiş olabilir
- kullanıcı yanlış modülde olabilir

YAZIM KURALI:
- Markdown kullanma
- Madde imi kullanma
- Kısa paragraflar kullan
- Gereksiz giriş cümlesi kurma
- Uydurma özellik anlatma
- Emin olmadığın şeyi kesinmiş gibi söyleme

Cevap üretmeden önce içinden şu kontrolü yap:
“Bu cevap gerçek AIVO akışına mı dayanıyor, yoksa tahmin mi?”
Eğer tahminse cevabı daha güvenli hale getir.

Mevcut AIVO çalışma bağlamı:
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
