const AIVO_REGISTRY = {
  app: {
    name: "AIVO",
    assistantRole: "product_copilot",
    version: 1,
  },

  globals: {
    jobStatuses: [
      "idle",
      "queued",
      "processing",
      "ready",
      "completed",
      "failed",
      "deleted",
    ],

    commonTroubleshooting: [
      {
        key: "job_processing",
        when: ["processing", "queued"],
        guidance:
          "İşlem hâlâ devam ediyor olabilir. Önce ilgili kartın durumunu kontrol et ve kullanıcıyı hazır sonucu beklemeye yönlendir.",
      },
      {
        key: "job_ready",
        when: ["ready", "completed"],
        guidance:
          "İçerik hazır görünüyor. Kullanıcıyı kart üzerindeki bir sonraki gerçek aksiyona yönlendir.",
      },
      {
        key: "missing_selection",
        when: ["selection_required"],
        guidance:
          "Bu işlem için önce ilgili kart veya içerik seçilmiş olmalı. Seçim yapılmadan işlem varmış gibi anlatma.",
      },
      {
        key: "confirmation_pending",
        when: ["confirmation_required"],
        guidance:
          "İşlem başlamadan önce onay modalı açılabilir. Varsa kredi kesimi ve onay akışını net söyle.",
      },
    ],
  },

  pricing: {
    page: "pricing",
    label: "Fiyatlandırma",
    purpose: "Kredi paketlerini gösterir ve satın alma akışını başlatır.",
    packageType: "one_time_credit",
    packages: [
      {
        key: "starter",
        badge: "Başlangıç",
        label: "Yeni Kullanıcı",
        priceTRY: 199,
        credits: 25,
        perCreditTRY: 7.96,
        features: [
          "Temel kalite üretim",
          "Standart hız",
          "Kapak + Müzik",
        ],
        bestFor: [
          "ilk kez deneyecek kullanıcı",
          "düşük hacimli üretim",
          "küçük testler",
        ],
      },
      {
        key: "standard",
        badge: "Standart",
        label: "Standart Paket",
        popular: true,
        priceTRY: 699,
        credits: 100,
        perCreditTRY: 6.99,
        features: [
          "Daha hızlı üretim",
          "Öncelikli sıra",
          "Müzik + Kapak",
        ],
        bestFor: [
          "düzenli kullanım",
          "müzik ve kapak üretimi",
          "orta hacim",
        ],
      },
      {
        key: "pro",
        badge: "Pro",
        label: "Yaratıcı Üretici",
        priceTRY: 1299,
        credits: 200,
        perCreditTRY: 6.49,
        features: [
          "Premium kalite",
          "Öncelikli destek",
          "Ticari kullanım",
          "Kapak + Müzik + Video",
        ],
        bestFor: [
          "yoğun üretim yapan kullanıcı",
          "video kullanan üretici",
          "daha profesyonel akış",
        ],
      },
      {
        key: "studio",
        badge: "Stüdyo",
        label: "Stüdyo / Ajans",
        priceTRY: 2999,
        credits: 500,
        perCreditTRY: 6.0,
        features: [
          "Takım kullanımı",
          "Özel destek",
          "Ticari kullanım",
          "Yüksek hacimli üretim",
        ],
        bestFor: [
          "ajans",
          "ekip",
          "yüksek hacimli üretim",
        ],
      },
    ],
    recommendationRules: [
      {
        key: "pricing_new_user",
        condition: "low_volume_or_first_time",
        recommend: ["starter", "standard"],
        explanation:
          "Yeni başlayan veya sistemi ilk kez deneyen kullanıcı için önce düşük riskli paket önerilir. Düzenli kullanım planı varsa standart pakete geçilir.",
      },
      {
        key: "pricing_music_cover_regular",
        condition: "regular_music_and_cover",
        recommend: ["standard", "pro"],
        explanation:
          "Düzenli müzik ve kapak üretimi için standart paket genelde yeterlidir. Video veya daha yoğun üretim başlarsa pro daha uygundur.",
      },
      {
        key: "pricing_video_heavy",
        condition: "video_or_high_usage",
        recommend: ["pro", "studio"],
        explanation:
          "Video üretimi ve yoğun üretim daha hızlı kredi tüketir. Bu durumda pro veya stüdyo paketi daha mantıklıdır.",
      },
      {
        key: "pricing_team_usage",
        condition: "team_or_agency",
        recommend: ["studio"],
        explanation:
          "Takım kullanımı, ajans yapısı veya yüksek hacim varsa en doğru yönlendirme stüdyo paketidir.",
      },
    ],
    ui: {
      cardsVisible: true,
      packageSelectionButtonLabel: "Paketi seç",
      paymentStartAction: "package_select",
    },
  },

  modules: {
    music: {
      key: "music",
      page: "music",
      label: "AI Müzik Üret",
      purpose: "Prompt, tarz, mood ve vokal yönüne göre müzik üretir.",
      aliases: [
        "müzik",
        "müzik üret",
        "şarkı üret",
        "müzik oluştur",
        "ai müzik",
      ],
      userIntents: [
        "müzik üretmek",
        "şarkı oluşturmak",
        "kanal ayırmak",
        "stem almak",
        "mastering yapmak",
      ],
      actions: [
        {
          key: "generate_music",
          label: "Müzik üret",
          trigger: "Müzik üretim alanı",
          location: "music_main_form",
          requiresSelection: false,
          confirmationRequired: false,
          creditCost: null,
          output: "Yeni müzik üretimi",
          assistantRule:
            "Kullanıcı yeni müzik istiyorsa üretim alanına yönlendir. Kullanıcı prompt yardımı istemiyorsa prompt açıklamasıyla oyalanma.",
        },
        {
          key: "channel_separation",
          label: "Kanal Ayırma",
          trigger: "Müzik kartı > 3 nokta menü",
          location: "music_card_overflow_menu",
          requiresSelection: true,
          confirmationRequired: true,
          creditCost: 5,
          output: "Stem veya kanal ayrımı",
          synonyms: [
            "kanal ayırma",
            "kanallara ayırma",
            "stem",
            "stem al",
            "vokal ayır",
            "enstrüman ayır",
            "davul bas gitar ayır",
          ],
          assistantRule:
            "Bu işlem prompt işi değildir. Kullanıcıyı müzik kartındaki 3 nokta menüsüne ve onay modalına yönlendir.",
        },
        {
          key: "mastering",
          label: "Mastering",
          trigger: "Müzik kartı > 3 nokta menü veya ilgili aksiyon alanı",
          location: "music_card_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "Daha dengeli ve finale yakın parça",
          assistantRule:
            "Kullanıcı miks veya final kalite istiyorsa mastering aksiyonunu anlat. Yeni müzik üretimiyle karıştırma.",
        },
        {
          key: "download_music",
          label: "İndir",
          trigger: "Müzik kartı aksiyonları",
          location: "music_card_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "Müzik dosyası indirimi",
          assistantRule:
            "İçerik hazır değilse indirme varmış gibi konuşma. Önce kart durumunu kontrol etmeyi söyle.",
        },
      ],
      states: {
        queued: "Üretim sırada olabilir.",
        processing: "İşlem devam ediyor olabilir, ilgili kartın hazır durumunu beklemek gerekir.",
        ready: "İçerik hazırsa kart aksiyonları kullanılabilir.",
        failed: "İşlem başarısız olduysa yeniden üretim veya ilgili kart üzerinden yeni deneme öner.",
      },
      troubleshooting: [
        "Kanal ayırma sorusunda prompt önerme.",
        "Kullanıcı kart üzerinden işlem soruyorsa gerçek menü yolunu söyle.",
        "Kart hazır değilse önce hazır durumunu kontrol ettir.",
        "Kredi onayı gerekiyorsa bunu net belirt.",
      ],
    },

    cover: {
      key: "cover",
      page: "cover",
      label: "AI Kapak Üret",
      purpose: "Albüm kapağı ve görsel içerik üretir.",
      aliases: [
        "kapak",
        "kapak üret",
        "albüm kapağı",
        "cover",
      ],
      userIntents: [
        "kapak oluşturmak",
        "albüm kapağı üretmek",
        "kapak düzenlemek",
      ],
      actions: [
        {
          key: "generate_cover",
          label: "Kapak üret",
          trigger: "Kapak üretim alanı",
          location: "cover_main_form",
          requiresSelection: false,
          confirmationRequired: false,
          creditCost: null,
          output: "Yeni kapak görseli",
          assistantRule:
            "Kullanıcı görsel kapak istiyorsa doğrudan bu modüle yönlendir.",
        },
        {
          key: "overlay_text",
          label: "Yazı ekleme",
          trigger: "Kapak sonrası düzenleme akışı",
          location: "cover_post_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "Kapak üstü yazı veya düzenleme",
          assistantRule:
            "Kapak hazır olmadan düzenleme varmış gibi anlatma.",
        },
      ],
      troubleshooting: [
        "Kapak isteniyorsa video modülleriyle karıştırma.",
        "Kullanıcı hareketli sonuç istiyorsa cover yerine video modüllerinden uygun olanı da kısa farkla anlat.",
      ],
    },

    atmo: {
      key: "atmo",
      page: "atmo",
      label: "AI Atmosfer Video",
      purpose: "Klip çekemeyenler için atmosfer veya arka plan videoları üretir.",
      aliases: [
        "atmosfer",
        "atmo",
        "arka plan video",
        "mood video",
      ],
      userIntents: [
        "arka plan video üretmek",
        "atmosfer video yapmak",
        "klip yerine sahne videosu oluşturmak",
      ],
      actions: [
        {
          key: "generate_atmo_video",
          label: "Atmosfer video üret",
          trigger: "Atmosfer video üretim alanı",
          location: "atmo_main_form",
          requiresSelection: false,
          confirmationRequired: false,
          creditCost: null,
          output: "Atmosfer video",
          assistantRule:
            "Kullanıcı klip çekmeden sahne hissi veren video istiyorsa bu modülü öner.",
        },
        {
          key: "overlay_logo",
          label: "Logo bindirme",
          trigger: "Video sonrası işlem alanı",
          location: "atmo_result_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "Logolu video",
          assistantRule:
            "Video hazır değilse logo aksiyonu varmış gibi anlatma.",
        },
      ],
      troubleshooting: [
        "İşlem processing ise kullanıcıyı kart durumuna yönlendir.",
        "PhotoFX ile karıştırma; bu modül foto efekt değil atmosfer sahne üretir.",
      ],
    },

    photofx: {
      key: "photofx",
      page: "photofx",
      label: "AI Foto Efekt Video Clip",
      purpose: "Fotoğrafları efektli kısa videoya dönüştürür.",
      aliases: [
        "photofx",
        "foto efekt",
        "foto efekt video",
        "fotoğraftan efektli video",
      ],
      userIntents: [
        "fotoğrafa efekt vermek",
        "fotoğraftan kısa efekt videosu üretmek",
      ],
      actions: [
        {
          key: "generate_photofx",
          label: "Efekt video üret",
          trigger: "PhotoFX üretim alanı",
          location: "photofx_main_form",
          requiresSelection: false,
          confirmationRequired: false,
          creditCost: null,
          output: "Efektli kısa video clip",
          assistantRule:
            "Kullanıcı bir fotoğrafı efektli klibe dönüştürmek istiyorsa bu modülü öner.",
        },
        {
          key: "overlay_logo",
          label: "Logo bindirme",
          trigger: "Video sonrası işlem alanı",
          location: "photofx_result_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "Logolu efekt video",
          assistantRule:
            "PhotoFX’i atmosfer video veya resimden video modülüyle karıştırma.",
        },
      ],
      troubleshooting: [
        "Kullanıcı tek görseli efektli kısa klibe çevirmek istiyorsa doğru yönlendirme budur.",
        "Sahne veya arka plan videosu isteyen kullanıcıyı atmo’ya kaydır.",
      ],
    },

    video: {
      key: "video",
      page: "video",
      label: "AI Resimden Video Üret",
      purpose: "Görselleri hareketli videoya dönüştürür.",
      aliases: [
        "resimden video",
        "görselden video",
        "image to video",
        "fotoğraftan hareketli video",
      ],
      userIntents: [
        "görseli hareketlendirmek",
        "resimden video yapmak",
        "kapak görselini hareketlendirmek",
      ],
      actions: [
        {
          key: "generate_image_to_video",
          label: "Resimden video üret",
          trigger: "Video üretim alanı",
          location: "video_main_form",
          requiresSelection: false,
          confirmationRequired: false,
          creditCost: null,
          output: "Hareketli video",
          assistantRule:
            "Kullanıcı mevcut bir görseli hareketli videoya çevirmek istiyorsa bunu öner.",
        },
        {
          key: "download_video",
          label: "Videoyu indir",
          trigger: "Video kartı aksiyonları",
          location: "video_card_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "İndirilen video",
          assistantRule:
            "Video hazır değilse indirme veya export varmış gibi konuşma.",
        },
      ],
      troubleshooting: [
        "PhotoFX ile farkını kısa söyle: burada temel amaç görseli hareketlendirmek.",
        "Atmosfer video ile farkını kısa söyle: burada giriş bir görseldir.",
      ],
    },

    cartoon: {
      key: "cartoon",
      page: "cartoon",
      label: "AI Çocuk Çizgifilm",
      purpose: "Hikaye ve karakter bazlı çizgifilm üretir.",
      aliases: [
        "çizgifilm",
        "çocuk çizgifilm",
        "cartoon",
      ],
      userIntents: [
        "hikayeli çizgifilm üretmek",
        "karakter bazlı çocuk videosu yapmak",
      ],
      actions: [
        {
          key: "story_create",
          label: "Hikaye oluştur",
          trigger: "Çizgifilm üretim akışı",
          location: "cartoon_story_flow",
          requiresSelection: false,
          confirmationRequired: false,
          creditCost: null,
          output: "Hikaye bazlı çizgifilm üretimi",
          assistantRule:
            "Kullanıcı hikaye ve karakter bazlı akış istiyorsa bu modülü anlat.",
        },
        {
          key: "export_create",
          label: "Dışa aktar",
          trigger: "Çizgifilm sonuç alanı",
          location: "cartoon_result_actions",
          requiresSelection: true,
          confirmationRequired: false,
          creditCost: null,
          output: "Hazır çıktı",
          assistantRule:
            "İçerik oluşmadan export varmış gibi anlatma.",
        },
      ],
      troubleshooting: [
        "Bu modül hikaye bazlıdır; tek görsel video modülleriyle karıştırma.",
      ],
    },
  },
};

export function getAivoRegistry() {
  return AIVO_REGISTRY;
}

export function getAivoModule(moduleKey) {
  if (!moduleKey) return null;
  return AIVO_REGISTRY.modules[moduleKey] || null;
}

export function getPricingRegistry() {
  return AIVO_REGISTRY.pricing;
}

export function findModuleByAlias(input) {
  if (!input || typeof input !== "string") return null;

  const q = input.trim().toLowerCase();
  if (!q) return null;

  const modules = Object.values(AIVO_REGISTRY.modules);

  for (const mod of modules) {
    const haystack = [
      mod.key,
      mod.page,
      mod.label,
      ...(Array.isArray(mod.aliases) ? mod.aliases : []),
      ...(Array.isArray(mod.userIntents) ? mod.userIntents : []),
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    if (haystack.some((v) => q.includes(v) || v.includes(q))) {
      return mod;
    }

    for (const action of mod.actions || []) {
      const actionTerms = [
        action.key,
        action.label,
        ...(Array.isArray(action.synonyms) ? action.synonyms : []),
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      if (actionTerms.some((v) => q.includes(v) || v.includes(q))) {
        return mod;
      }
    }
  }

  return null;
}

export function findActionInModule(moduleKey, input) {
  const mod = getAivoModule(moduleKey);
  if (!mod || !input || typeof input !== "string") return null;

  const q = input.trim().toLowerCase();
  if (!q) return null;

  for (const action of mod.actions || []) {
    const terms = [
      action.key,
      action.label,
      action.trigger,
      ...(Array.isArray(action.synonyms) ? action.synonyms : []),
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    if (terms.some((v) => q.includes(v) || v.includes(q))) {
      return action;
    }
  }

  return null;
}

export function recommendPricingPackages({ usageType, needsVideo, teamUsage } = {}) {
  const pricing = getPricingRegistry();
  const packages = pricing.packages || [];

  if (teamUsage) {
    return packages.filter((p) => ["studio"].includes(p.key));
  }

  if (needsVideo) {
    return packages.filter((p) => ["pro", "studio"].includes(p.key));
  }

  if (usageType === "regular") {
    return packages.filter((p) => ["standard", "pro"].includes(p.key));
  }

  return packages.filter((p) => ["starter", "standard"].includes(p.key));
}

export default AIVO_REGISTRY;
