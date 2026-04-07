(() => {
  if (window.__CARTOON_STORY_BIND__) return;
  pencere.__CARTOON_STORY_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORY_MAX_POLLS = 240;
  const STORY_POLL_INTERVAL = 3000;
  const STORY_READY_RECHECK_LIMIT = 20;
  const STORY_READY_RECHECK_INTERVAL = 1500;

  sabit HİKAYE_AKIŞ_ÖN AYARLARI = {
    "3": { giriş: 3, hazırlık: 3, macera: 4, final: 2 },
    "4": { giriş: 4, hazırlık: 4, macera: 6, final: 4 },
    "5": { giriş: 6, hazırlık: 6, macera: 8, final: 4 },
    "6": { giriş: 7, hazırlık: 7, macera: 10, final: 6 }
  };

  sabit HİKAYE_BÖLÜMÜ_SAHNE_PLANLARI = {
    giriş: [
      { title: "Dünya Açılışı", açıklama: "Ortam ve genel atmosfer kuruluşu." },
      { title: "Ana Karakter Tanıtımı", açıklama: "Ana karakter ilk kez görünüyor." },
      { title: "Hedefin Ortaya Çıkışı", açıklama: "Karakterin amacı netleşir." },
      { title: "İlk Duygusal Bağ", açıklama: "Karakterin iç dünyası görünür." },
      { title: "Merak Kıvılcımı", açıklama: "Yeni bir soru veya merak doğar." },
      { title: "Dünyanın Kuralı", açıklama: "Hikayenin temel düzeni iyice hissedilir." },
      { title: "Yola Çağrı", açıklama: "Karakterin hızlandırılmasının hazırlanması." }
    ],
    kurmak: [
      { title: "Yardımcı Unsur Gelir", açıklama: "Yardımcı karakter veya olmayan hikayeye dahil olur." },
      { title: "Yolculuk Başlar", açıklama: "Karakterler harekete geçirilir." },
      { title: "İlk Engel", açıklama: "İlk zorluklar ortaya çıkar." },
      { title: "Plan Kurulur", açıklama: "Sorunu çözmek için ilk plan yapılır." },
      { başlık: "Yeni İpucu", açıklama: "Hedefe giden yolda yeni bir bilgi öğrenilir." },
      { title: "Denge Bozulur", açıklama: "Karakterlerin düzeni değişiyor." },
      { title: "Karar Anı", açıklama: "Geri dönme yerine devam kararı verilir." }
    ],
    macera: [
      { title: "Macera Derinleşir", açıklama: "Olaylar başlar." },
      { title: "Deneme ve Çaba", açıklama: "Karakterler çözümü için yeni bir yol dener." },
      { title: "Gerilim Artar", açıklama: "Risk artar, baskı artar." },
      { title: "Doruk Noktası", açıklama: "En kritik karşılaşma yaşanır." },
      { title: "Beklenmedik Sürpriz", açıklama: "Plan dışı yeni bir gelişme olur." },
      { title: "Takım Ruhu", açıklama: "Karakterler birlikte hareket etmeyi öğrenir." },
      { title: "Büyük Engel", açıklama: "Daha güçlü bir güçlü kahramanların önüne çıkar." },
      { başlık: "Son Hazırlık", açıklama: "Final öncesi son hazırlıklar yapılır." },
      { title: "Umut Yeniden Doğar", açıklama: "Karakterler tekrar güç kazanır." },
      { title: "Büyük Karşılaşma", açıklama: "Hikayenin en yoğun anı yaşanır." }
    ],
    son: [
      { title: "Çözüm", açıklama: "Sorun kodu." },
      { title: "Kapanış", açıklama: "Hikaye sıcak bir final ile ısırır." },
      { title: "Kutlama", açıklama: "Karakterler başarıyı birlikte yaşar." },
      { title: "Duygusal Veda", açıklama: "Hikayenin duygusal etkisi tamamlanır." },
      { title: "Yeni Denge", açıklama: "Dünyada yeni bir düzen kurulmuş olur." },
      { title: "Son Gülümseme", açıklama: "İzleyiciye sıcak bir oğul an bırakılır." }
    ]
  };

  sabit HİKAYE_KARAKTER_YUVASI_YAPILANDIRMASI = [
    {
      yuva: "ana",
      durumAnahtarı: "anaKarakter",
      Seçiciler: ['[veri-hikayesi-ana-karakteri]'],
      uploadInputSelectors: ['[data-story-character-file="main"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="main"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="main"]']
    },
    {
      yuva: "yardımcı1",
      durumAnahtarı: "yardımcıKarakter1",
      selectSelectors: ['[data-story-helper-1]'],
      uploadInputSelectors: ['[data-story-character-file="helper1"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="helper1"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="helper1"]']
    },
    {
      yuva: "yardımcı2",
      durumAnahtarı: "yardımcıKarakter2",
      selectSelectors: ['[data-story-helper-2]'],
      uploadInputSelectors: ['[data-story-character-file="helper2"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="helper2"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="helper2"]']
    },
    {
      yuva: "ekstra",
      durumAnahtarı: "ekstraKarakter",
      selectSelectors: ['[data-story-helper-3]', '[data-story-extra-character]'],
      uploadInputSelectors: ['[data-story-character-file="extra"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="extra"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="extra"]']
    }
  ];
 const STORY_MAX_TOTAL_CHARACTERS = 4;

fonksiyon createPresetCharacterEntry(rol, değer, etiket) {
  geri dönmek {
    anahtar: `preset:${role}:${value}`,
    kaynak: "ön ayar",
    rol: rol === "ana" ? "ana" : "yardımcı",
    değer: safeText(değer),
    etiket: güvenliMetin(etiket)
  };
}
fonksiyon createUploadCharacterEntry(slot) {
  sabit anahtar = güvenli metin(yuva);
  Eğer anahtar yoksa, null döndür;

  const slotConfig = STORY_CHARACTER_SLOT_CONFIG.find((config) => config.slot === key);
  Eğer (!slotConfig) doğru değilse, null döndür;

  const label = SafeText(state[slotConfig.stateKey]);
  const imageState = getStoryCharacterImage(key);
  const hasFile = !!(imageState && imageState.file);

  Eğer dosya yoksa, null döndür;

  geri dönmek {
    anahtar: `upload:${key}`,
    kaynak: "yükle",
    rol: anahtar === "ana" ? "ana" : "yardımcı",
    yuva: anahtar,
    değer: anahtar,
    etiket: etiket || anahtar
  };
}

fonksiyon getSelectedPresetCharacters() {
  sabit girişler = [];

  if (safeText(state.mainCharacter)) {
    girişler.itme(
      createPresetCharacterEntry("main", safeText(state.mainCharacter), safeText(state.mainCharacter))
    );
  }

  if (safeText(state.helperCharacter1)) {
    girişler.itme(
      createPresetCharacterEntry("helper", safeText(state.helperCharacter1), safeText(state.helperCharacter1))
    );
  }

  if (safeText(state.helperCharacter2)) {
    girişler.itme(
      createPresetCharacterEntry("helper", safeText(state.helperCharacter2), safeText(state.helperCharacter2))
    );
  }

  if (safeText(state.extraCharacter)) {
    girişler.itme(
      createPresetCharacterEntry("helper", safeText(state.extraCharacter), safeText(state.extraCharacter))
    );
  }

  iade girişleri;
}

fonksiyon getSelectedUploadCharacters() {
  HİKAYE_KARAKTER_YUVASI_YAPILANDIRMASINI döndür
    .map((config) => createUploadCharacterEntry(config.slot))
    .filtre(Mantıksal);
}

getStorySelectedCharacters fonksiyonu {
  sabit yuvalar = [
    {
      yuva: "ana",
      etiket: güvenliMetin(durum.anaKarakter),
      hasUpload: !!getStoryCharacterImage("main")?.file
    },
    {
      yuva: "yardımcı1",
      etiket: güvenliMetin(durum.yardımcıKarakter1),
      hasUpload: !!getStoryCharacterImage("helper1")?.file
    },
    {
      yuva: "yardımcı2",
      etiket: güvenliMetin(durum.yardımcıKarakter2),
      hasUpload: !!getStoryCharacterImage("helper2")?.file
    },
    {
      yuva: "ekstra",
      etiket: güvenliMetin(durum.ekstraKarakter),
      hasUpload: !!getStoryCharacterImage("extra")?.file
    }
  ];

  iade yuvaları
    .filter((öğe) => öğe.etiketi || öğe.yükleme durumu)
    .map((öğe) => ({
      anahtar: öğe.yuvası,
      yuva: öğe.yuvası,
      etiket: öğe.etiketi,
      Yükleniyor: öğe.yükleniyor
    }));
}

getStorySelectedCharacterCount() fonksiyonu {
  getStorySelectedCharacters().length değerini döndür;
}

getStorySelectedCharacterEntries() fonksiyonu {
  getStorySelectedCharacters();
}

fonksiyon canAddStoryCharacter(nextCount = 1) {
  return getStorySelectedCharacterCount() + Number(nextCount || 0) <= STORY_MAX_TOTAL_CHARACTERS;
}



fonksiyon showStoryCharacterLimitAlert() {
  warning("En fazla 4 karakterin merkezisin. Ücretsiz ve özel karakterlerin toplam 4 hakkı paylaşılır.");
}
  getCartoonRoot() fonksiyonu {
    qs'yi döndür ('.main-panel[data-module="cartoon"]');
  }

  fonksiyon getStorySceneEditor(root) {
    geri dönmek (
      qs("[data-story-scene-editor]", root || document) ||
      qs("[data-story-scene-editor]", document)
    );
  }

  fonksiyon safeText(değer) {
    return String(value || "").trim();
  }

  fonksiyon clampText(değer, maksimum) {
    return String(value || "").slice(0, max);
  }

 fonksiyon normalizeStorySceneDuration(değer) {
  sabit n = Sayı(değer || 4);

  Eğer (n <= 4) ise "4" döndür;
  Eğer n 6'dan küçük veya eşitse "6" döndür;
  Eğer (n <= 8) ise "8" döndür;
  Eğer n 10'dan küçük veya eşitse "10" döndür;
  Eğer (n <= 12) ise "12" döndür;
  "15"i döndür;
}

  fonksiyon formatSecondsLabel(totalSeconds) {
    const total = Math.max(0, Number(totalSeconds || 0));
    sabit dakika = Math.floor(toplam / 60);
    sabit saniye = toplam % 60;
    Eğer (dakika > 0 ve saniye > 0 ise) `${dakika} dk ${saniye} sn` değerini döndür;
    Eğer dakika sayısı 0'dan büyükse, `${minutes} dk` değerini döndür;
    `${seconds} sn` değerini döndür;
  }

  toSceneDurationNumber fonksiyonu (değer) {
    Sayı döndür (normalizeStorySceneDuration(value));
  }

  fonksiyon mapLogoPositionToShort(değer) {
    const v = safeText(value || "bottom-right").toLowerCase();
    if (v === "top-left") return "tl";
    if (v === "top-right") return "tr";
    if (v === "bottom-left") return "bl";
    if (v === "center") return "c";
    "br" döndür;
  }

  fonksiyon getStoryFlowPreset(flowDuration) {
    STORY_FLOW_PRESETS[String(flowDuration || "3")] || STORY_FLOW_PRESETS["3"] döndür;
  }

  fonksiyon buildStoryScenesFromFlowDuration(flowDuration) {
    sabit ön ayar = getStoryFlowPreset(flowDuration);
    const sectionOrder = ["giriş", "kurulum", "macera", "son"];
    sabit sahneler = [];
    sahne numarasını 1 olarak bırakalım;

    bölümSırası.herBiri İçin((bölüm) => {
      sabit sayım = Sayı(önceki[bölüm] || 0);
      sabit planlar = HİKAYE_KESİM_SAHNE_PLANLARI[bölüm] || [];

      for (let i = 0; i < count; i += 1) {
        sabit şablon = şablonlar[i] || {
          başlık: `${sceneNumber}. Sahne`,
          açıklama: "Bu bölüm için yeni sahne."
        };

    sahneler.itme({
  id: `${section}-${i + 1}`,
  bölüm,
  başlık: `Sahne ${sceneNumber} · ${blueprint.title}`,
  açıklama: plan.açıklama,
  karakterler: "",
  Karakter yuvaları: [],
  seçili: yanlış,
  Süre: "4",
  mod: "",
  tip: "",
  Yönetmen Notu: ""
});

        sahne numarası += 1;
      }
    });

    geri dönüş sahneleri;
  }

  async function presignStoryCharacterReference(file, slot) {
    const safeSlot = String(slot || "main").trim() || "main";

    const res = await fetch("/api/r2/presign-put", {
      yöntem: "POST",
      başlıklar: { "Content-Type": "application/json" },
      gövde: JSON.stringify({
        uygulama: "çizgi film",
        tür: `story-reference-${safeSlot}`,
        dosya adı: dosya?.adı || `${safeSlot}-${Date.now()}.png`,
        İçerik Türü: dosya?.tür || "uygulama/octet-akışı"
      })
    });

    const data = await res.json().catch(() => null);

    Eğer (!res.ok || !data || data.ok === false) ise {
      throw new Error(data?.error || "story_reference_presign_failed");
    }

    geri dönmek {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || veri.url || ""
    };
  }

  async function uploadStoryCharacterReferenceToR2(file, slot) {
    Eğer dosya yoksa, "missing_story_reference_file" hatası fırlatılır.

    const { uploadUrl, publicUrl } = await presignStoryCharacterReference(file, slot);

    Eğer (!uploadUrl || !publicUrl) ise {
      throw new Error("story_reference_missing_upload_urls");
    }

    const put = await fetch(uploadUrl, {
      yöntem: "PUT",
      başlıklar: {
        "İçerik Türü": dosya.türü || "uygulama/sekizli akış"
      },
      gövde: dosya
    });

    eğer (!put.ok) {
      throw new Error("story_reference_r2_put_failed");
    }

    publicUrl'yi döndür;
  }

  asenkron fonksiyon presignStoryAudio(dosya) {
    const res = await fetch("/api/r2/presign-put", {
      yöntem: "POST",
      başlıklar: { "Content-Type": "application/json" },
      gövde: JSON.stringify({
        uygulama: "çizgi film",
        tür: "hikaye-sesli",
        dosya adı: dosya?.adı || `story-audio-${Date.now()}.mp3`,
        İçerik Türü: dosya?.tür || "uygulama/octet-akışı"
      })
    });

    const data = await res.json().catch(() => null);

    Eğer (!res.ok || !data || data.ok === false) ise {
      throw new Error(data?.error || "story_audio_presign_failed");
    }

    geri dönmek {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || veri.url || ""
    };
  }

  async function uploadStoryAudioToR2(file) {
    Eğer dosya yoksa, "missing_story_audio_file" hatası fırlatın.

    const { uploadUrl, publicUrl } = await presignStoryAudio(file);

    Eğer (!uploadUrl || !publicUrl) ise {
      throw new Error("story_audio_missing_upload_urls");
    }

    const put = await fetch(uploadUrl, {
      yöntem: "PUT",
      başlıklar: {
        "İçerik Türü": dosya.türü || "uygulama/sekizli akış"
      },
      gövde: dosya
    });

    eğer (!put.ok) {
      throw new Error("story_audio_r2_put_failed");
    }

    publicUrl'yi döndür;
  }

  async fonksiyon presignStoryLogo(dosya) {
    const res = await fetch("/api/r2/presign-put", {
      yöntem: "POST",
      başlıklar: { "Content-Type": "application/json" },
      gövde: JSON.stringify({
        uygulama: "çizgi film",
        tür: "hikaye-logo",
        dosya adı: dosya?.adı || `story-logo-${Date.now()}.png`,
        İçerik Türü: dosya?.tür || "uygulama/octet-akışı"
      })
    });

    const data = await res.json().catch(() => null);

    Eğer (!res.ok || !data || data.ok === false) ise {
      throw new Error(data?.error || "story_logo_presign_failed");
    }

    geri dönmek {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || veri.url || ""
    };
  }

  async function uploadStoryLogoToR2(file) {
    Eğer dosya yoksa, "missing_story_logo_file" hatası fırlatın.

    const { uploadUrl, publicUrl } = await presignStoryLogo(file);

    Eğer (!uploadUrl || !publicUrl) ise {
      throw new Error("story_logo_missing_upload_urls");
    }

    const put = await fetch(uploadUrl, {
      yöntem: "PUT",
      başlıklar: {
        "İçerik Türü": dosya.türü || "uygulama/sekizli akış"
      },
      gövde: dosya
    });

    eğer (!put.ok) {
      throw new Error("story_logo_r2_put_failed");
    }

    publicUrl'yi döndür;
  }

  // ------------------------------------------------------------
  // Politika yardımcıları (Hikaye)
  // ------------------------------------------------------------
  sabit HARD_BLOCK_TERMS = [
    "deepfake",
    "Yüz değiştirme",
    "yüzü değiştir",
    "Yüz değiştirme",
    "yuzunu koy",
    "yüzünü koy",
    "yuzunu ekle",
    "Yüzünü ekle",
    "yuzunu kullan",
    "yüzünü kullan",
    "suratini kullan"
  ];

  sabit SERT_BLOK_DESENLERİ = [
    /\bgibi\b/i,
    /\btarzında\b/i,
    /\btarzinda\b/i,
    /\bstilinde\b/i,
    /\bin, \b/i tarzında,
    /\blike\b/i,
    /\bbirebir\b/i,
    /\baynısı\b/i,
    /\baynisi\b/i,
    /\byüzünün\b/i,
    /\bşunun yüzüyle\b/i,
    /\bimpersonat(e|ion)\b/i
  ];

 sabit PUBLIC_FIGURE_TERMS = [
  "recep tayyip erdogan",
  "recep tayyip erdoğan",
  "erdoğan",
  "erdoğan",
  "Kemal Kılıçdaroğlu",
  "Kemal Daroğlu",
  "Kılıçdaroğlu",
  "kılıçdaroğlu",
  "ekrem imamoglu",
  "ekrem imamoğlu",
  "İmamoğlu",
  "İmamoğlu",
  "mansur yavas",
  "mansur hızı",
  "devlet bahceli",
  "devlet bahçeli",
  "bahceli",
  "bahçeli",
  "meral aksener",
  "meral akşener",
  "aksener",
  "akşener",
  "özgur ozel",
  "özgür özel",
  "ozel",
  "özel",
  "Selahattin Demirtas",
  "Selahattin Demirtaş",
  "Demirtaş",
  "Demirtaş",
  "umit ozdag",
  "Ümit Özdağ",
  "ozdag",
  "özdağ",
  "fatih erbakan",
  "temel karamollaoglu",
  "temel karamollaoğlu",
  "muharrem ince",
  "sinan ogan",
  "sinan oğan",
  "ali babacan",
  "ahmet davutoglu",
  "ahmet davutoğlu",
  "davutoglu",
  "davutoğlu",
  "hulusi akar",
  "hakan fidan",
  "Mehmet Simsek",
  "Mehmet Şimşek",
  "simsek",
  "şimşek",
  "suleyman soylu",
  "süleyman soylu",
  "soylu",
  "bekir bozdag",
  "Bekir Bozdağ",
  "bozdag",
  "Bozdağ",
  "numan sakmus",
  "numan kurtulmuş",
  "kurtulma",
  "kurtulmuş",
  "omer celik",
  "Ömer çelik",
  "çelik",
  "çelik",
  "binali yildirim",
  "binali yıldırım",
  "Abdullah Gul",
  "Abdullah Gül",
  "gul",
  "gül",
  "ahmet necdet sezer",
  "turgut ozal",
  "turgut özal",
  "ismet inonu",
  "İsmet inönü",
  "inonu",
  "inönü",
  "Mustafa Kemal Atatürk",
  "Mustafa Kemal Atatürk",
  "Atatürk",
  "Atatürk",
  "Kemal Atatürk",
  "cumhurbaskani",
  "cumhurbaşkanı",
  "cumhurbaskani yardimcisi",
  "cumhurbaşkanı yardımcısı",
  "bakan",
  "milletvekili",
  "belediye baskani",
  "belediye başı",
  "vali",
  "kaymakam",
  "siyasetci",
  "siyasetçi",
  "politikaci",
  "politikacı",
  "kamu figuru",
  "kamu insanları",
  "devlet buyugu",
  "devlet büyü",
  "Donald Trump",
  "koz",
  "jd vance",
  "jd vance",
  "ilerleme",
  "Keir Starmer",
  "yıldız oyuncu",
  "Emmanuel Macron",
  "makron",
  "friedrich merz",
  "merz",
  "Frank Walter Steinmeier",
  "Frank-Walter Steinmeier",
  "Steinmeier",
  "giorgia meloni",
  "meloni",
  "sergio mattarella",
  "mattarella",
  "Pedro Sanchez",
  "pedro sánchez",
  "sanchez",
  "sánchez",
  "Felipe VI",
  "Mark Carney",
  "panayır çalışanı",
  "claudia sheinbaum",
  "sheinbaum",
  "javier milei",
  "milei",
  "luiz inacio lula da silva",
  "luiz inácio lula da silva",
  "lula",
  "lula da silva",
  "Vladimir Putin",
  "Putin",
  "Mikhail Mishustin",
  "mishustin",
  "volodymyr zelenskyy",
  "zelenskyy",
  "Zelensky",
  "yulia svyrydenko",
  "svyrydenko",
  "xi jinping",
  "jinping",
  "li qiang",
  "narendra modi",
  "modi",
  "dropupadi murmu",
  "murmu",
  "Benjamin Netanyahu",
  "netanyahu",
  "Isaac Herzog",
  "herzog",
  "masoud pezeshkian",
  "pezeshkian",
  "mojtaba khamenei",
  "Khamenei",
  Muhammed bin Salman,
  "Muhammed bin Salman",
  "mbs",
  "salman",
  "Kral Salman",
  "Şeyh Muhammed bin zayed el nahyan",
  "Muhammed bin Zayed",
  "mbz",
  "Şeyh Muhammed bin Raşid el Maktum",
  "Muhammed bin Raşid",
  "bin rashid",
  "Abdullah II",
  "Kral Abdullah",
  "Cafer Hasan",
  "abdel fattah el sisi",
  "abdel fattah al sisi",
  "sisi",
  "mostafa madbouly",
  "madbouly",
  "abiy ahmed",
  "abiy",
  "William Ruto",
  "ruto",
  "Paul Kagame",
  "kagame",
  "samia suluhu hassan",
  "samia suluhu",
  "samia",
  "Cyril Ramaphosa",
  "ramaphosa",
  "bola tinubu",
  "tinubu",
  "bassirou diomaye faye",
  "diomaye faye",
  "ousmane sonko",
  "sonko",
  "John Mahama",
  "mahama",
  "netumbo nandi ndaitwah",
  "netumbo nandi-ndaitwah",
  "nandi ndaitwah",
  "Hasan Şeyh Muhammed",
  "Hasan Şeyh",
  "hamza abdi barre",
  "kais said",
  "kais saïed",
  "dedi",
  "saïed",
  "Muhammed Muizzu",
  "muizzu",
  "Anwar İbrahim",
  "Anwar",
  "prabowo subianto",
  "prabowo",
  "Lawrence Wong",
  "wong",
  "tharman shanmugaratnam",
  "Tharman",
  "lee jae myung",
  "Lee Jae-myung",
  "şigeru isiba",
  "ishiba",
  "naruhito",
  "anura kumara dissanayake",
  "dissanayake",
  "paetongtarn shinawatra",
  "shinawatra",
  "maha vajiralongkorn",
  "Lam'a",
  "tô lâm",
  "luong cuong",
  "lương cường",
  "pham minh chinh",
  "phạm minh chính",
  "hun manet",
  "hun sen",
  "norodom sihamoni",
  "thongloun sisoulith",
  "sisoulith",
  "sonexay siphandone",
  "Şehbaz Şerif",
  "Şerif",
  "asif ali zardari",
  "zardari",
  "Muhammed Yunus",
  "yunus",
  "Kassym Jomart Tokayev",
  "Kassym-Jomart Tokayev",
  "Tokayev",
  "Şavkat Mirziyoyev",
  "mirziyoyev",
  "sadyr japarov",
  "japarov",
  "emomali rahmon",
  "rahmon",
  "nikol pashinyan",
  "paşinyan",
  "ilham aliyev",
  "Aliyev",
  "irakli kobakhidze",
  "kobakhidze",
  "mikheil kavelashvili",
  "kavelashvili",
  "maia sandu",
  "sandu",
  "Aleksandar Vucic",
  "aleksandar vučić",
  "vucic",
  "vučić",
  "robert fico",
  "fico",
  "Peter Pellegrini",
  "pellegrini",
  "andrej plenkovic",
  "andrej plenković",
  "plenkovic",
  "plenković",
  "petr pavel",
  "Pavel",
  "Donald Tusk",
  "diş",
  "andrzej duda",
  "duda",
  "viktor orban",
  "viktor orbán",
  "orban",
  "orbán",
  "nicusor dan",
  "nicușor dan",
  "ilie bolojan",
  "bolojan",
  "Boyko Borisov",
  "Borisov",
  "rumen radev",
  "radev",
  "kyriakos mitsotakis",
  "mitsotakis",
  "edi rama",
  "rama",
  "Zoran Milanovic",
  "zoran milanović",
  "milanovic",
  "milanović",
  "andrej babis",
  "andrej babiš",
  "bebekler",
  "babiş",
  "Michael Martin",
  "Martin",
  "Rodrigo Chaves",
  "chaves",
  "gustavo petro",
  "petro",
  "Daniel Noboa",
  "noboa",
  "nayib bukele",
  "bukele",
  "bernardo arevalo",
  "bernardo arévalo",
  "arevalo",
  "arévalo",
  "xiomara castro",
  "Castro",
  "Daniel Ortega",
  "ortega",
  "rosario murillo",
  "murillo",
  "laurentino cortizo",
  "cortizo",
  "Jose Raul Mulino",
  "josé raúl mulino",
  "mulino",
  "luis abinader",
  "abinader",
  "irfaan ali",
  "ali",
  "chan santokhi",
  "santokhi",
  "Nicolas Maduro",
  "nicolás maduro",
  "maduro",
  "yamandu orsi",
  "yamandú orsi",
  "orsi",
  "Başbakan",
  "başkan",
  "kral",
  "kraliçe",
  "şansölye",
  "Başbakan",
  "başbakan",
  "devlet başkanı",
  "Hükümet başkanı",
  "basbakan",
  "başbakan"
  ];

  sabit SANATÇI_ADI_TERİMLERİ = [
    "tarkan",
    "sezen aksu",
    "ajda pekkan",
    "sertab erener",
    "Mustafa sandalet",
    "kenan dogulu",
    "kenan doğulu",
    "hande yener",
    "demet akalin",
    "demet akalın",
    "gulsen",
    "gülşen",
    "Hadis",
    "aleyna tilki",
    "edis",
    "murat boz",
    "simge",
    "simge sagin",
    "simge sağın",
    "sila",
    "sıla",
    "mabel matiz",
    "yıldız tilbe",
    "yıldız tilbe",
    "sibel yapabilir",
    "linet",
    "duman",
    "mor ve otesi",
    "mor ve dışı",
    "teoman",
    "oguzha koç",
    "oğuzhan koç",
    "cem adrian",
    "haluk levent",
    "baris manco",
    "barış manço",
    "athena",
    "manga",
    "sagopa kajmer",
    "ceza",
    "ezhel",
    "ben fero",
    "gazapizm",
    "uzi",
    "cakal",
    "çakal",
    "semicenk",
    "motivasyon",
    "khontkar",
    "norm sonlandırıcı",
    "selda bagcan",
    "selda bağcan",
    "Müslüman güreşleri",
    "müslüm gürses",
    "İbrahim Tatlises",
    "İbrahim Tatlıses",
    "orhan gencebay",
    "ferdi tayfur",
    "volkan konak",
    "candan ercetin",
    "nazan oncel",
    "nazan öncel",
    "buray",
    "irem derici",
    "melek mosso",
    "madrigal",
    "dedubluman",
    "yalin",
    "yalın",
    "Emre Aydın",
    "Emre Aydın",
    "sefo",
    "sertab"
  ];

fonksiyon normalizeStoryPolicyText(değer) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

fonksiyon buildStoryPolicyPhraseRegex(term) {
  sabit normalleştirilmiş = normalizeStoryPolicyText(term);
  Eğer normalleştirilmemişse, null döndür;

  sabit desen = normalleştirilmiş
    .bölmek(" ")
    .filtre(Mantıksal)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");

  return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i");
}

fonksiyon isStoryPolicyBlocked(ham) {
  const text = normalizeStoryPolicyText(raw);

  sabit hasBlockedTerm =
    HARD_BLOCK_TERMS.some((term) => {
      const rx = buildStoryPolicyPhraseRegex(term);
      rx değerini döndür ? rx.test(text) : false;
    }) ||
    KAMUYA AÇIK_ŞARTLAR.bazı((şart) => {
      const rx = buildStoryPolicyPhraseRegex(term);
      rx değerini döndür ? rx.test(text) : false;
    }) ||
    SANATÇI_ADI_TERİMLERİ.bazı((terim) => {
      const rx = buildStoryPolicyPhraseRegex(term);
      rx değerini döndür ? rx.test(text) : false;
    });

  const hasBlockedPattern = HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
  !!raw değerini döndür && (hasBlockedTerm || hasBlockedPattern);
}

  fonksiyon ensureStoryPolicyNote(root, generateBtn) {
    Eğer kök öğe yoksa veya generateBtn yoksa veya generateBtn.parentElement yoksa null döndür;

    let policyNote = qs("#cartoonStoryPolicyNote", root);
    eğer (!policyNote) {
      policyNote = document.createElement("div");
      policyNote.id = "cartoonStoryPolicyNote";
      policyNote.style.display = "none";
      policyNote.style.marginTop = "14px";
      policyNote.style.padding = "14px 16px";
      policyNote.style.borderRadius = "18px";
      policyNote.style.background = "rgba(255,90,120,.10)";
      policyNote.style.border = "1px solid rgba(255,120,150,.24)";
      policyNote.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
      policyNote.style.textAlign = "center";
      policyNote.style.fontSize = "14px";
      policyNote.style.fontWeight = "800";
      policyNote.style.lineHeight = "1.65";
      policyNote.style.color = "rgba(255,245,248,.96)";
      generateBtn.parentElement.appendChild(policyNote);
    }

    İade politikasıNot;
  }

  fonksiyon resetStoryPolicyUI(root) {
    Eğer kök yoksa geri dön;

    const storyIdeaEl = qs("[data-story-idea]", root);
    const extraPromptEl = qs("[data-story-extra-prompt]", root);
    const generateBtn = qs("[data-story-generate]", root);
    const policyNote = qs("#cartoonStoryPolicyNote", root);

    eğer (storyIdeaEl) {
      storyIdeaEl.style.borderColor = "";
      storyIdeaEl.style.boxShadow = "";
    }

    eğer (extraPromptEl) {
      extraPromptEl.style.borderColor = "";
      extraPromptEl.style.boxShadow = "";
    }

    if (generateBtn) {
      generateBtt.style.background = "";
      generateBtt.style.borderColor = "";
      generateBtt.style.boxShadow = "";
      generateBtt.style.cursor = "";
      generateBtt.style.filter = "";
    }

    eğer (politika notu) {
      policyNote.style.display = "none";
      policyNote.textContent = "";
    }
  }

  fonksiyon buildStoryPolicyText() {
    const selectedScenes = getSelectedScenes();

    const sceneText = selectedScenes.flatMap((scene) => [
      sahne?.başlık,
      sahne?.açıklama,
      sahne?.ruh hali,
      sahne?.tip,
      sahne?.yönetmenNotu
    ]);

    geri dönmek [
      devlet.hikayeFikri,
      durum.tema,
      eyalet.yaşGrubu,
      durum.anaKarakter,
      durum.yardımcıKarakter1,
      durum.yardımcıKarakter2,
      durum.ekstraKarakter,
      eyalet.stil,
      durum.ekstraİstem,
      ...sahneMetni
    ].filter(Boolean).join(" ");
  }

  fonksiyon createEmptyStoryCharacterImageState() {
    geri dönmek {
      dosya: boş,
      dosya adı: "",
      dosya URL'si: "",
      uploadPromise: null,
      Yükleme Durumu: "boşta",
      Yükleme Hatası: ""
    };
  }

  fonksiyon createEmptyStoryAssetState() {
    geri dönmek {
      dosya: boş,
      dosya adı: "",
      dosya URL'si: "",
      uploadPromise: null,
      Yükleme Durumu: "boşta",
      Yükleme Hatası: ""
    };
  }

  fonksiyon createDefaultScenes(flowDuration = "3") {
    return buildStoryScenesFromFlowDuration(flowDuration);
  }

const existingStoryState = window.__CARTOON_STORY_STATE__;
sabit durum = (pencere.__CARTOON_STORY_STATE__ =
  mevcutHikayeDurumu
    ? {
        ...mevcutHikayeDurumu,
        AnaKarakter: "",
        yardımcıKarakter1: "",
        yardımcıKarakter2: "",
        ekstraKarakter: "",
        karakterEtiketKaynağı: {
          ana: "ön ayar",
          yardımcı1: "önceden ayarlanmış",
          yardımcı2: "önceden ayarlanmış",
          ekstra: "ön ayar",
          ...(existingStoryState.characterLabelSource || {})
        }
      }
    : {
        mod: "hikaye",
        Akış Süresi: "3",
        HikayeFikri: "",
        tema: "",
        Yaş Grubu: "",
        Süre: "180",
        AnaKarakter: "",
        yardımcıKarakter1: "",
        yardımcıKarakter2: "",
        ekstraKarakter: "",
        ayarlarAçık: false,
        oran: "16:9",
        stil: "",
        ses: "yok",
        Müzik dahil et: "hayır",
        LogoPosition: "bottom-right",
        ekstraİstem: "",
        openSection: "giriş",
        editingSceneId: "",
        isGenerating: false,
        Karakter Resimleri: {
          ana: createEmptyStoryCharacterImageState(),
          yardımcı1: createEmptyStoryCharacterImageState(),
          yardımcı2: createEmptyStoryCharacterImageState(),
          ekstra: createEmptyStoryCharacterImageState()
        },
        karakterEtiketKaynağı: {
          ana: "ön ayar",
          yardımcı1: "önceden ayarlanmış",
          yardımcı2: "önceden ayarlanmış",
          ekstra: "ön ayar"
        },
        logoAsset: createEmptyStoryAssetState(),
        audioAsset: createEmptyStoryAssetState(),
        sahneler: createDefaultScenes("3"),
        Karakter Seçenekleri: []
      });

  const storyPollState = (window.__CARTOON_STORY_POLL_STATE__ =
    pencere.__ÇİZGİ FİLM_HİKAYESİ_ANKET_DURUMU__ || {
      İşler: {},
      Toplam: 0,
      hazır: 0,
      başarısız: 0
    });

  fonksiyon resetStoryPollBatch() {
    storyPollState.jobs = {};
    storyPollState.total = 0;
    storyPollState.ready = 0;
    storyPollState.failed = 0;
  }

  fonksiyon setStoryGenerateButton(root, loading) {
    const btn = root?.querySelector("[data-story-generate]");
    (!btn) ise geri dön;
   düğme.devre dışı = !!yükleniyor;
   btn.textContent = yükleniyor mu? "Üretiliyor..." : `Hikayeyi Oluştur (${getStoryEstimatedCredits()} Kredi)`;
   btn.classList.toggle("is-loading", !!loading);
  }

  fonksiyon completeStoryGenerateIfAllSettled() {
    sabit kök = getCartoonRoot();
    const total = Number(storyPollState.total || 0);
    const ready = Number(storyPollState.ready || 0);
    const failed = Number(storyPollState.failed || 0);

    Toplam değer yoksa geri dön;
    Eğer (hazır + başarısız < toplam) ise geri dön;

    durum.oluşturuluyor = yanlış;
    setStoryGenerateButton(root, false);

    console.log("[ÇİZGİ FİLM][HİKAYE TÜMÜ ÇÖZÜLDÜ]", {
      toplam,
      hazır,
      arızalı,
      İşler: storyPollState.jobs
    });
  }

  fonksiyon ensureStoryJobState(jobId, item) {
    sabit anahtar = güvenli metin(işkimliği);
    Eğer anahtar yoksa, null döndür;

    if (!storyPollState.jobs[key]) {
      storyPollState.jobs[key] = {
        iş_kimliği: anahtar,
        sahne_kimliği: güvenliMetin(öğe?.sahne_kimliği),
        sahne_başlığı: güvenliMetin(öğe?.sahne_başlığı),
        denemeler: 0,
        hazır kontroller: 0,
        Tamamlandı: yanlış,
        başarısız: yanlış,
        zamanlayıcı: boş,
        Son Durum: "",
        Son yanıt: null,
        Başlangıç ​​Tarihi: Tarih.şimdi()
      };
    }

    storyPollState.jobs[key] değerini döndür;
  }

  fonksiyon clearStoryJobTimer(jobId) {
    sabit anahtar = güvenli metin(işkimliği);
    const entry = storyPollState.jobs?.[key];
    Eğer (giriş yoksa) geri dön;
    eğer (giriş.zamanlayıcı) {
      Zaman aşımını temizle(giriş.zamanlayıcı);
      giriş.zamanlayıcı = null;
    }
  }

  fonksiyon scheduleStoryPoll(jobId, item, tries, delay) {
    sabit anahtar = güvenli metin(işkimliği);
    const entry = ensureStoryJobState(key, item);
    Eğer giriş başarılı değilse veya giriş başarısızsa, geri dön;

    clearStoryJobTimer(key);
    giriş.zamanlayıcı = zaman aşımını ayarla(() => {
      pollStorySceneJob(key, item, tries);
    }, Sayı(gecikme || HİKAYE_SORGULAMA_ARALIĞI));
  }

  işlev markStoryJobReady(jobId, item, payload) {
    sabit anahtar = güvenli metin(işkimliği);
    const entry = ensureStoryJobState(key, item);
    Eğer giriş yoksa veya giriş tamamlandıysa, geri dön;

    giriş tamamlandı = doğru;
    giriş başarısız = yanlış;
    giriş.sonyanıt = payload?.ham || payload || null;
    giriş.sondurum = güvenliMetin(yük?.durum).küçükharfeçe();
    clearStoryJobTimer(key);
    storyPollState.ready += 1;

    sabit detay = {
      uygulama: "çizgi film",
      mod: "hikaye",
      sahneId: safeText(item?.scene_id),
      sahneBaşlığı: güvenliMetin(öğe?.sahne_başlığı),
      iş_kimliği: anahtar,
      durum: safeText(payload?.status).toLowerCase(),
      video: payload?.video || null,
      Çıktılar: Array.isArray(payload?.outputs) ? payload.outputs : [],
      ham: payload?.raw || null
    };

    pencere.göndermeOlayı(
      new CustomEvent("aivo:cartoon:story_scene_ready", { detail })
    );

    pencere.göndermeOlayı(
      yeni ÖzelOlay("aivo:cartoon:job_ready", {
        detay: {
          ...detay,
          meta: {
            uygulama: "çizgi film",
            mod: "hikaye",
            sahne_kimliği: güvenliMetin(öğe?.sahne_kimliği),
            sahne_başlığı: güvenliMetin(öğe?.sahne_başlığı)
          }
        }
      })
    );

    completeStoryGenerateIfAllSettled();
  }

  fonksiyon markStoryJobFailed(jobId, item, raw) {
    sabit anahtar = güvenli metin(işkimliği);
    const entry = ensureStoryJobState(key, item);
    Eğer giriş başarılı değilse veya giriş başarısızsa, geri dön;

    giriş başarısız oldu = doğru;
    giriş tamamlandı = yanlış;
    giriş.sonyanıt = ham || null;
    giriş.sondurum = güvenliMetin(ham?.durum || ham?.db_durumu || ham?.durum).küçükharfe();
    clearStoryJobTimer(key);
    storyPollState.failed += 1;

    konsol.hata("[ÇİZGİ FİLM][HİKAYE_İŞİ_BAŞARISIZ_SON]", {
      iş kimliği: anahtar,
      sahneBaşlığı: öğe?.sahne_başlığı || "",
      çiğ
    });

    completeStoryGenerateIfAllSettled();
  }

  fonksiyon getStoryCharacterImage(slot) {
    const key = String(slot || "").trim();
    return state.characterImages?.[key] || null;
  }

  fonksiyon setStoryCharacterImage(slot, patch) {
    const key = String(slot || "").trim();
    Eğer (anahtar yoksa) geri dön;

    const prev = getStoryCharacterImage(key) || createEmptyStoryCharacterImageState();

    durum.karakterResimleri = {
      ...(state.characterImages || {}),
      [anahtar]: {
        ...önceki,
        ...yama
      }
    };
  }

  fonksiyon getShortFileName(name, max = 28) {
    const text = String(name || "").trim();
    Eğer metin yoksa "" döndür;
    Eğer metnin uzunluğu maksimum değere eşit değilse, metni döndür;
    `${text.slice(0, max - 3)}...` döndür;
  }

  fonksiyon getStoryCharacterLabelBySlot(slot) {
    sabit anahtar = güvenli metin(yuva);
    Eğer (anahtar yoksa) "" döndür;

    if (key === "main") return safeText(state.mainCharacter);
    if (key === "helper1") return safeText(state.helperCharacter1);
    if (key === "helper2") return safeText(state.helperCharacter2);
    if (key === "extra") return safeText(state.extraCharacter);
    geri dönmek "";
  }

  function getSceneById(sceneId) {
    return state.scene.find((scene) => scene.id === sceneId) || null;
  }

  fonksiyon updateSceneById(sceneId, patch) {
    durum.sahneler = durum.sahneler.harita((sahne) =>
      sahne.id === sahneId ? { ...sahne, ...yama } : sahne
    );
  }

  fonksiyon getStoryCharacterSlotMap() {
    geri dönmek {
      ana: güvenliMetin(durum.anaKarakter),
      yardımcı1: güvenliMetin(durum.yardımcıKarakter1),
      yardımcı2: güvenliMetin(durum.yardımcıKarakter2),
      ekstra: safeText(state.extraCharacter)
    };
  }

  fonksiyon getSceneCharacterLabel(scene) {
    const slotMap = getStoryCharacterSlotMap();
    const slots = Array.isArray(scene?.characterSlots) ? scene.characterSlots : [];
    sabit etiketler = yuvalar
      .map((slot) => {
        sabit etiket = yuva haritası[yuva];
        const imageState = getStoryCharacterImage(slot);
        const fileName = safeText(imageState?.fileName);
        Eğer etiket yoksa "" döndür;
        return fileName ? `${label} (${getShortFileName(fileName, 26)})` : label;
      })
      .filtre(Mantıksal);

    Eğer etiketlerin uzunluğu yeterli değilse, etiketleri döndür;
    geri dönmek [];
  }

  getStoryLogoAsset fonksiyonu {
    return state.logoAsset || createEmptyStoryAssetState();
  }

  getStoryAudioAsset fonksiyonu {
    return state.audioAsset || createEmptyStoryAssetState();
  }

  fonksiyon setStoryLogoAsset(patch) {
    durum.logoVarlığı = {
      ...getStoryLogoAsset(),
      ...yama
    };
  }

  fonksiyon setStoryAudioAsset(patch) {
    durum.sesvarlığı = {
      ...getStoryAudioAsset(),
      ...yama
    };
  }

  fonksiyon resetStoryLogoAsset(root) {
    const input = qs("[data-story-logo-upload]", root);
    if (input) input.value = "";

    durum.logoAsset = createEmptyStoryAssetState();
    updateStoryLogoUploadUI(root);
  }

  fonksiyon resetStoryAudioAsset(root) {
    const input = qs("[data-story-audio-upload]", root);
    if (input) input.value = "";

    durum.sesvarlığı = boş hikayevarlığıdurumu oluştur();
    updateStoryAudioUploadUI(root);
  }

fonksiyon resetStoryCharacterImage(root, slot) {
  const key = String(slot || "").trim();
  Eğer (anahtar yoksa) geri dön;

  const input = qs(`[data-story-character-file="${key}"]`, root);
  if (input) input.value = "";

  const slotConfig = STORY_CHARACTER_SLOT_CONFIG.find((config) => config.slot === key);

  setStoryCharacterImage(key, createEmptyStoryCharacterImageState());

  eğer (slotConfig) {
    durum[slotConfig.stateKey] = "";

    const hiddenInput = qs(slotConfig.selectSelectors[0], root);
    if (hiddenInput) hiddenInput.value = "";
  }

  updateStoryCharacterUploadUI(root, key);
  render(root);

  const scene = getSceneById(state.editingSceneId);
  eğer (sahne) {
    renderSceneCharacterPicker(root, scene);
    syncSceneRows(root);
  }
}

fonksiyon getStorySlotToastMeta(slot) {
  sabit anahtar = güvenli metin(yuva);

  if (key === "main") {
    geri dönmek {
      eklendi: "Ana karakter eklendi · +10 kredi",
      kaldırıldı: "Ana karakter kaldırıldı · -10 kredi"
    };
  }

  if (key === "helper1") {
    geri dönmek {
      eklendi: "Yardımcı karakter 1 eklendi · +10 kredi",
      kaldırıldı: "Yardımcı karakter 1 kaldırıldı · -10 kredi"
    };
  }

  if (key === "helper2") {
    geri dönmek {
      eklendi: "Yardımcı karakter 2 eklendi · +10 kredi",
      kaldırıldı: "Yardımcı karakter 2 kaldırıldı · -10 kredi"
    };
  }

  geri dönmek {
    eklendi: "Ek karakter eklendi · +10 kredi",
    kaldırıldı: "Ek karakter kaldırıldı · -10 kredi"
  };
}

fonksiyon toastStoryCharacterAdded(slot) {
  const meta = getStorySlotToastMeta(slot);
  try { window.toast?.success?.(meta.added); } catch {}
}

fonksiyon toastStoryCharacterRemoved(slot) {
  const meta = getStorySlotToastMeta(slot);
  try { window.toast?.success?.(meta.removed); } catch {}
}

  fonksiyon updateStoryLogoUploadUI(root) {
    const textEl = qs("[data-story-logo-upload-text]", root);
    const clearBtn = qs("[data-story-logo-upload-clear]", root);
    const asset = getStoryLogoAsset();

    Eğer (!textEl) değilse, geri dön;

    if (!asset.file) {
      textEl.textContent = "Dosyanın seçimidi";
      if (clearBtn) clearBtn.style.display = "none";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    if (asset.uploadStatus === "uploading") {
      textEl.textContent = `${getShortFileName(asset.fileName)} · Yükleniyor...`;
      if (clearBtn) clearBtn.style.display = "none";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    if (asset.uploadStatus === "ready") {
      textEl.textContent = `${getShortFileName(asset.fileName)} · Hazır ✓`;
      if (clearBtn) clearBtn.style.display = "inline-grid";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    if (asset.uploadStatus === "error") {
      textEl.textContent = `${getShortFileName(asset.fileName)} · Yükleme hatası`;
      if (clearBtn) clearBtn.style.display = "inline-grid";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    textEl.textContent = getShortFileName(asset.fileName) || "Dosyanın sadedi";
    if (clearBtn) clearBtn.style.display = "none";
    syncStoryGenerateButtonCredit(root);
  }

  fonksiyon updateStoryAudioUploadUI(root) {
    const textEl = qs("[data-story-audio-upload-text]", root);
    const clearBtn = qs("[data-story-audio-upload-clear]", root);
    sabit varlık = getStoryAudioAsset();

    Eğer (!textEl) değilse, geri dön;

    if (!asset.file) {
      textEl.textContent = "Dosyanın seçimidi";
      if (clearBtn) clearBtn.style.display = "none";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    if (asset.uploadStatus === "uploading") {
      textEl.textContent = `${getShortFileName(asset.fileName)} · Yükleniyor...`;
      if (clearBtn) clearBtn.style.display = "none";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    if (asset.uploadStatus === "ready") {
      textEl.textContent = `${getShortFileName(asset.fileName)} · Hazır ✓`;
      if (clearBtn) clearBtn.style.display = "inline-grid";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    if (asset.uploadStatus === "error") {
      textEl.textContent = `${getShortFileName(asset.fileName)} · Yükleme hatası`;
      if (clearBtn) clearBtn.style.display = "inline-grid";
      syncStoryGenerateButtonCredit(root);
      geri dönmek;
    }

    textEl.textContent = getShortFileName(asset.fileName) || "Dosyanın sadedi";
    if (clearBtn) clearBtn.style.display = "none";
    syncStoryGenerateButtonCredit(root);
  }

  fonksiyon syncStorySettingsUploadUI(root) {
    updateStoryLogoUploadUI(root);
    updateStoryAudioUploadUI(root);
  }

  fonksiyon ensureSceneCharacterPicker(editör) {
    Eğer editör yoksa, null döndür;

    let wrap = qs("[data-scene-character-picker]", editor);
    Eğer (sarma) ise sarmayı döndür;

    sabit gizli alan =
      qs("[data-scene-editor-characters]", editor)?.closest(".form-field") ||
      qs("[data-scene-editor-characters]", editor)?.parentElement ||
      hükümsüz;

    Eğer gizli alan mevcutsa, gizli alanın stili "yok" olarak ayarlanmalı;

    sabit açıklama alanı =
      qs("[data-scene-editor-description]", editor)?.closest(".form-field") ||
      qs("[data-scene-editor-description]", editor)?.parentElement ||
      hükümsüz;

    Eğer açıklama alanı mevcut değilse veya açıklama alanının üst öğesi yoksa, null döndür;

    wrap = document.createElement("div");
    wrap.className = "form-field";
    wrap.setAttribute("data-scene-character-picker", "");
    wrap.style.marginTop = "18px";
    wrap.innerHTML = `
      <etiket>
        stil="
          görüntüle:blok;
          yazı tipi kalınlığı: 800;
          yazı tipi boyutu: 18 piksel;
          satır yüksekliği: 1,2;
          margin-bottom:12px;
        "
      >
        Sahnedeki Karakterler
      </label>

      <div
        veri-sahne-karakter-seçici-seçenekleri
        stil="
          görüntü:ızgara;
          ızgara-şablonu-sütunları:tekrarla(4,minmax(0,1fr));
          boşluk:12px;
          öğeleri hizala: uzat;
        "
      </div>

      <div
        veri-sahne-karakter-seçici-boş
        stil="
          göster:yok;
          margin-top:8px;
          opaklık: 0,78;
          yazı tipi boyutu: 14 piksel;
        "
      >
        Önce üst bölümden karakter seç.
      </div>
    `;

    açıklamaAlanının.üstÖğesi.ekle(sarmala, açıklamaAlanının.sonrakiKardeş);
    geri sarma;
  }

  fonksiyon renderSceneCharacterPicker(root, scene) {
    const editör = getStorySceneEditor(root);
    Eğer (!editör || !sahne) yoksa geri dön;

    const wrap = ensureSceneCharacterPicker(editor);
    Eğer (!wrap) değilse, geri dön;

    const optionsBox = qs("[data-scene-character-picker-options]", wrap);
    const emptyBox = qs("[data-scene-character-picker-empty]", wrap);
    Eğer (seçenekler kutusu yoksa veya boş kutu yoksa) geri dön;

    const selected = Array.isArray(scene?.characterSlots)
      ? scene.characterSlots.map((x) => safeText(x)).filter(Boolean)
      : [];

    const items = qsa(".story-scene-character-item", optionsBox);
    Eğer öğe sayısı yeterli değilse, geri dön;

    Seçili herhangi bir hikaye karakterine sahip olup olmadığını kontrol edin;

    öğeler.herbiri için((öğe) => {
      const slot = safeText(item.dataset.sceneCharacterSlot);
      const labelEl = qs("[data-scene-character-label]", item);
      const fileEl = qs("[veri-sahne-karakter-dosyası]", öğe);

      sabit etiket = getStoryCharacterLabelBySlot(slot);
      const image = getStoryCharacterImage(slot) || createEmptyStoryCharacterImageState();
      const hasCharacter = !!label;
      const isSelected = hasCharacter && selected.includes(slot);

      if (hasCharacter) hasAnySelectedStoryCharacter = true;

      öğe.gizli = !karakter içeriyor;
      item.dataset.selected = isSelected ? "true" : "false";

      eğer (labelEl) {
        labelEl.textContent = etiket || "Karakterin sadedi";
      }

      eğer (fileEl) {
        fileEl.textContent = image.fileName
          ? getShortFileName(image.fileName, 24)
          : "Görsel-di";
      }

      öğe.stil.kenar = Seçili
        ? "1px solid rgba(201,119,255,.55)"
        : "1px solid rgba(255,255,255,.12)";
      öğe.stil.arka plan = Seçili
        ? "linear-gradient(135deg, rgba(146,92,255,.22), rgba(255,98,174,.18))"
        : "rgba(255,255,255,.04)";
      öğe.stil.kutuGölgesi = Seçili
        ? "0 0 0 1px rgba(201,119,255,.18) inset, 0 10px 30px rgba(121,65,255,.14)"
        : "hiçbiri";

      const dot = qs(".story-scene-character-dot", item);
      eğer (nokta) {
        nokta.stil.arka plan = seçili
          ? "linear-gradient(135deg,#22c55e,#16a34a)"
          : "rgba(255,255,255,.18)";
        nokta.stil.kutuGölgesi = Seçili
          ? "0 0 12px rgba(34,197,94,.45)"
          : "hiçbiri";
      }
    });

    eğer (herhangi bir seçili hikaye karakteri varsa) {
      seçenekler kutusu gizlenmiş = false;
      boşKutu.gizli = true;
    } başka {
      seçenekler kutusu gizli = true;
      boşKutu.gizli = false;
    }
  }

  fonksiyon getSceneCharacterPickerValues(root) {
    const editör = getStorySceneEditor(root);
    Eğer editör yoksa, [] döndür;

    qsa'yı döndür ('.story-scene-character-item[data-selected="true"]', editör)
      .map((el) => safeText(el.dataset.sceneCharacterSlot))
      .filtre(Mantıksal);
  }

  Seçilen Sahneleri alma işlevi {
    return state.scenes.filter((scene) => scene && scene.selected === true);
  }

  fonksiyon getSelectedTotalSeconds() {
    return getSelectedScenes().reduce((sum, scene) => {
      Toplamı döndür + toSceneDurationNumber(scene?.duration);
    }, 0);
  }

  fonksiyon buildCharacterOptions(root) {
    sabit harita = yeni bir Harita();

    qsa('[data-role="main"], [data-role="helper"]', root).forEach((btn) => {
      const value = safeText(btn.dataset.character);
      sabit etiket =
        safeText(qs('.cartoon-character-name', btn)?.textContent) ||
        güvenliMetin(düğme.metinİçeriği) ||
        değer;

      Eğer değer ve etiket mevcutsa, map.set(value, label);
    });

    sabit storySelectedValues ​​= [
      güvenliMetin(durum.anaKarakter),
      güvenliMetin(durum.yardımcıKarakter1),
      güvenliMetin(durum.yardımcıKarakter2),
      güvenliMetin(durum.ekstraKarakter)
    ].filtre(Mantıksal);

    storySelectedValues.forEach((value) => {
      eğer haritada değer yoksa {
        harita.değeri ayarla;
      }
    });

    state.characterOptions = Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }

  fonksiyon fillCharacterSelect(selectEl, selectedValue) {
    Eğer (!selectEl) değilse, geri dön;

    const current = String(selectedValue || "");
    sabit seçenekler = durum.karakterSeçenekleri || [];

    selectEl.innerHTML = "";
    const empty = document.createElement("option");
    boş.değer = "";
    empty.textContent = "Seçiniz";
    selectEl.appendChild(empty);

    seçenekler.herbiri için((öğe) => {
      const opt ​​= document.createElement("option");
      opt.değer = öğe.değer;
      opt.textContent = item.label;
      Eğer öğenin değeri mevcut değere eşitse, seçili seçeneği etkinleştirilir.
      selectEl.appendChild(opt);
    });

    selectEl.value = mevcut;
  }

  fonksiyon syncCharacterSelect(root) {
    STORY_CHARACTER_SLOT_CONFIG.forEach((config) => {
      const selectedValue = safeText(state[config.stateKey]);
      config.selectSelectors.forEach((selector) => {
        fillCharacterSelect(qs(selector, root), selectedValue);
      });
    });
  }

  fonksiyon updateStoryIdeaCount(root) {
    const input = qs("[data-story-idea]", root);
    const out = qs("[data-story-idea-count]", root);
    Eğer giriş yoksa veya çıkış yoksa, geri dön;

    const len ​​= String(input.value || "").length;
    out.textContent = String(len);
  }

  işlev ensureStoryDurationSummary(root) {
    const wrap = qs("[data-story-duration-summary-wrap]", root);
    Eğer (sarma) ise sarmayı döndür;

    sabit süreAlan =
      qs("[data-story-duration]", root)?.closest(".form-field") ||
      qs("[data-story-duration]", root)?.parentElement ||
      hükümsüz;

    Eğer (!durationField veya !durationField.parentElement) mevcut değilse, null döndür;

    const box = document.createElement("div");
    kutu.sınıfAdı = "hikaye-süresi-özeti";
    kutu.setAttribute("data-story-duration-summary-wrap", "");

    kutu.içHTML = `
      <label style="display:block;font-weight:700;margin-bottom:8px;">Toplam Süre</label>
      <div
        veri-hikayesi-süresi-özeti
        style="min-height:64px;display:flex;align-items:center;padding:0 18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(5,6,28,.55);font-weight:700;"
      </div>
    `;

    durationField.parentElement.appendChild(box);
    durationField.style.display = "none";
    iade kutusu;
  }

  fonksiyon syncStoryDurationSummary(root) {
    const box = ensureStoryDurationSummary(root);
    const out = qs("[data-story-duration-summary]", root);
    Eğer kutu yoksa veya çıkış yoksa geri dön;

    const selectedCount = getSelectedScenes().length;
    const totalSeconds = getSelectedTotalSeconds();
    çıkış.metinİçeriği =
      SeçilenSayı > 0
        ? `${selectedCount} sahne · ${formatSecondsLabel(totalSeconds)}`
        : "Henüz sahne seçilmedi";
  }

  fonksiyon syncModeTabs(root) {
    qsa("[data-cartoon-mode]", root).forEach((btn) => {
      const on = btn.dataset.cartoonMode === state.mode;
      düğme.sınıfListesi.geçiş("aktif", açık);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  fonksiyon syncModeViews(root) {
    qsa(".cartoon-mode-view[data-cartoon-view]", root).forEach((el) => {
      const view = el.dataset.cartoonView || "";
      sabit on = görünüm === durum.modu;
      el.hidden = !on;
      el.classList.toggle("is-active", on);
    });
  }

  fonksiyon syncStoryFlowDuration(root) {
    const select = qs("[data-story-flow-duration]", root);
    Eğer (seçilmemişse) geri dön;
    if (select.value !== String(state.flowDuration || "3")) {
      select.value = String(state.flowDuration || "3");
    }
  }

  fonksiyon syncStorySectionCounts(root) {
    qsa("[data-story-section]", root).forEach((sectionEl) => {
      const sectionId = safeText(sectionEl.dataset.storySection);
      Eğer (!sectionId) ise geri dön;

      const count = state.scenes.filter((scene) => scene.section === sectionId).length;
      const em = qs(".story-section-meta em", sectionEl);
      if (em) em.textContent = `${count} Sahne`;
    });
  }

  fonksiyon syncStoryFormValues(root) {
    const storyIdea = qs("[data-story-idea]", root);
    const theme = qs("[data-story-theme]", root);
    const ageGroup = qs("[data-story-age-group]", root);
    sabit oran = qs("[veri-hikayesi-oranı]", kök);
    const style = qs("[data-story-style]", root);
    const audio = qs("[data-story-audio]", root);
    const extraPrompt = qs("[data-story-extra-prompt]", root);
    const logoPosition = qs("[data-story-logo-position]", root);
    const includeMusic = qs("[data-story-include-music]", root);

    if (storyIdea && storyIdea.value !== state.storyIdea) storyIdea.value = state.storyIdea;
    Eğer tema ve temanın değeri, durumla aynı değilse, temanın değerine durumu atayın.
    Eğer (yaş grubu ve yaş grubunun değeri, eyaletin yaş grubuna eşit değilse) yaş grubunun değeri, eyaletin yaş grubuna eşitlenmelidir.
    Eğer oran ve oran değeri, durum oranına eşit değilse, oran değeri durum oranına eşitlenmelidir.
    Eğer stil ve stil değeri, eyaletin stiliyle aynı değilse, stil değerine eyaletin stilini atayın.
    Eğer ses mevcutsa ve ses değeri state.audio'ya eşit değilse, ses değerine state.audio değerini atayın.
    Eğer (extraPrompt ve extraPrompt.value, state.extraPrompt'a eşit değilse) extraPrompt.value = state.extraPrompt;
    Eğer logoPosition değeri state.logoPosition değerine eşit değilse, logoPosition.value değerini state.logoPosition değerine eşitleyin.
    Eğer (includeMusic ve includeMusic.value, state.includeMusic'e eşit değilse) includeMusic.value = state.includeMusic;
  }

  fonksiyon createSceneRow(sahne) {
    const btn = document.createElement("button");
    düğme.tipi = "düğme";
    düğme.sınıfAdı = "hikaye-sahne-satırı";
    btn.setAttribute("data-story-scene-id", scene.id);
    düğme.setAttribute("data-edit-scene", scene.id);

    const selectedBadge = scene.selected
      ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(170,88,255,.18);font-size:12px;font-weight:700;">Seçili</span>`
      : `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;">Seçili değil</span>`;

    düğme.içHTML = `
      <span class="story-scene-copy">
        <strong data-scene-title></strong>
        <small data-scene-description></small>
        <small data-scene-characters style="opacity:.8;"></small>
      </span>
      <span class="story-scene-meta" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
        ${selectedBadge}
        <span data-scene-duration></span>
      </span>
    `;

    qs("[data-scene-title]", btn).textContent = scene.title || "Sahne";
    qs("[data-scene-description]", btn).textContent = scene.description || "";
    qs("[data-scene-duration]", btn).textContent = `${normalizeStorySceneDuration(scene.duration)} sn`;

    const charEl = qs("[data-scene-characters]", btn);
    const labels = getSceneCharacterLabels(scene);
    charEl.textContent = labels.length ? `Karakterler: ${labels.join(", ")}` : "Karakter standarttı";

    geri dön düğmesi;
  }

  fonksiyon renderSectionScenes(root) {
    qsa("[data-story-section]", root).forEach((sectionEl) => {
      const sectionId = sectionEl.dataset.storySection || "";
      const body = qs("[data-story-section-body]", sectionEl);
      Eğer (gövde yoksa) geri dön;

      let list = qs(".story-scene-list", body);
      eğer (!liste) {
        liste = document.createElement("div");
        liste.sınıfAdı = "hikaye-sahne-listesi";
        gövde.appendChild(liste);
      }

      liste.içHTML = "";
      durum.sahneler
        .filter((sahne) => sahne.bölüm === bölümId)
        .forEach((scene) => list.appendChild(createSceneRow(scene)));
    });
  }

  fonksiyon syncStoryAccordion(root) {
    qsa("[data-story-section]", root).forEach((sectionEl) => {
      const sectionId = sectionEl.dataset.storySection || "";
      const isOpen = sectionId === state.openSection;

      sectionEl.classList.toggle("is-open", isOpen);

      const body = qs("[data-story-section-body]", sectionEl);
      Eğer gövde (body) ise, gövdenin gizli (hidden) olup olmadığını kontrol et.

      const toggle = qs("[data-story-section-toggle]", sectionEl);
      Eğer (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  fonksiyon syncStorySettings(root) {
    const body = qs("[data-story-settings-body]", root);
    const toggle = qs("[data-story-settings-toggle]", root);
    const icon = qs("[data-story-settings-icon]", root);

    Eğer gövde (body) ise, gövde gizli (!state.settingsOpen) olmalıdır;
    Eğer (toggle) etkinse, toggle.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
    Eğer simge açıksa, simge sınıf listesindeki "açık" seçeneğinin durumunu değiştirip açıyoruz.
  }

  fonksiyon syncSceneRows(root) {
    qsa("[data-story-scene-id]", root).forEach((row) => {
      const sceneId = row.dataset.storySceneId || "";
      const sahne = getSceneById(sceneId);
      Eğer sahne yoksa geri dön;

      const titleEl = qs("[data-scene-title]", row);
      const descEl = qs("[veri-sahne-açıklaması]", satır);
      const durationEl = qs("[data-scene-duration]", row);
      const charsEl = qs("[data-scene-characters]", row);

      if (titleEl) titleEl.textContent = scene.title || "Sahne";
      if (descEl) descEl.textContent = scene.description || "";
      if (durationEl) durationEl.textContent = `${normalizeStorySceneDuration(scene.duration)} sn`;

      if (charsEl) {
        const labels = getSceneCharacterLabels(scene);
        charsEl.textContent = labels.length ? `Karakterler: ${labels.join(", ")}` : "Karakter standarttı";
      }
    });
  }

fonksiyon fillSceneEditor(root, sceneId) {
  const editör = getStorySceneEditor(root);
  const sahne = getSceneById(sceneId);
  Eğer (!editör || !sahne) yoksa geri dön;

  const heading = qs("[data-scene-editor-heading]", editor);
  const title = qs("[data-scene-editor-title]", editor);
  const description = qs("[data-scene-editor-description]", editor);
  sabit süre = qs("[veri-sahne-editör-süresi]", editör);
  const mood = qs("[data-scene-editor-mood]", editor);
  const type = qs("[data-scene-editor-type]", editor);
  const note = qs("[data-scene-editor-note]", editor);

  Eğer başlık varsa, başlığın metin içeriği sahnenin başlığına eşitse ("Sahne Çağrı");
  if (title) title.value = scene.title || "";
  if (description) description.value = scene.description || "";

  renderSceneCharacterPicker(root, scene);

  Eğer süre (duration) ise, süre değeri normalize edilerek sahne süresi (scene.duration) hesaplanmalıdır.
  Eğer (ruh hali) ruh halinin değeri sahnenin ruh haline eşitse;
  if (type) type.value = scene.type || "";
  if (note) note.value = scene.directorNote || "";

  syncSceneEditorCreditPreview(root);
}

  fonksiyon ensureStorySceneEditorPortal(root) {
    const editor = qs("[data-story-scene-editor]", root) || qs("[data-story-scene-editor]", document);
    Eğer editör yoksa, null döndür;

    if (editor.parentElement !== document.body) {
      belge.gövde.appendChild(editör);
    }

    düzenleyiciye geri dön;
  }

  fonksiyon syncSceneEditor(root) {
    const editor = ensureStorySceneEditorPortal(root);
    Eğer (!editör) ise geri dön;

    const isOpen = !!state.editingSceneId;
    editör.gizli = !açık;
    editör.sınıf listesi.geçiş yap("açık", açık);

    eğer (açık ise) {
      fillSceneEditor(root, state.editingSceneId);

      const scene = getSceneById(state.editingSceneId);
      eğer (sahne) {
        renderSceneCharacterPicker(root, scene);
      }
    }
  }

fonksiyon getStoryEstimatedCredits() {
  const totalSeconds = Math.max(4, Number(getSelectedTotalSeconds() || 0));
  Toplamı 30 olarak belirleyelim;

  eğer (toplamSaniye > 4) {
    Toplam += Math.floor((toplamSaniye - 4) / 2) * 5;
  }

const characterImageCount = STORY_CHARACTER_SLOT_CONFIG.reduce((sum, config) => {
  const imageState = getStoryCharacterImage(config.slot);
  return sum + (imageState && imageState.file ? 1 : 0);
}, 0);

const logoAsset = getStoryLogoAsset();
const audioAsset = getStoryAudioAsset();
const includeMusic = safeText(state.includeMusic).toLowerCase() === "yes";

Toplam += karakterResimSayısı * 10;
Eğer (logoAsset.file) toplam += 10 ise;
Eğer (includeMusic && audioAsset.file) toplam += 10;

  Toplam tutarı döndür;
}
fonksiyon getStoryEstimatedCreditsWithSceneDraft(root) {
  const editör = getStorySceneEditor(root);
  Eğer (!editör || !state.editingSceneId) ise {
    getStoryEstimatedCredits();
  }

  sabit taslakSüresi = normalizeHikayeSahneSüresi(
    qs("[data-scene-editor-duration]", editor)?.value || "4"
  );

  sabit sahneler = state.scene.map((scene) => {
    Eğer (scene.id !== state.editingSceneId) ise, sahneyi döndür;

    geri dönmek {
      ...sahne,
      Süre: taslakSüre,
      seçili: doğru
    };
  });

  sabit toplamSaniye = sahneler
    .filter((sahne) => sahne && sahne.seçili === true)
    .reduce((sum, scene) => sum + toSceneDurationNumber(scene?.duration), 0);

  Toplamı 30 olarak belirleyelim;

  eğer (toplamSaniye > 4) {
    Toplam += Math.floor((toplamSaniye - 4) / 2) * 5;
  }

  const characterImageCount = STORY_CHARACTER_SLOT_CONFIG.reduce((sum, config) => {
    const imageState = getStoryCharacterImage(config.slot);
    return sum + (imageState && imageState.file ? 1 : 0);
  }, 0);

  const logoAsset = getStoryLogoAsset();
  const audioAsset = getStoryAudioAsset();
  const includeMusic = safeText(state.includeMusic).toLowerCase() === "yes";

 Toplam += karakterResimSayısı * 10;
  Eğer (logoAsset.file) toplam += 10 ise;
  Eğer (includeMusic && audioAsset.file) toplam += 10;

  Toplam tutarı döndür;
}

fonksiyon syncSceneEditorCreditPreview(root) {
  const editör = getStorySceneEditor(root);
  Eğer (!editör) ise geri dön;

  const liveEl = qs("[data-scene-credit-live]", editor);
  const btn = qs("[data-story-generate]", root);

  const total = getStoryEstimatedCreditsWithSceneDraft(root);

  eğer (düğme) {
    btn.setAttribute("data-credit-cost", String(total));

    eğer (!state.isGenerating) ise {
      btn.textContent = `Hikayeyi Oluştur (${total} Kredi)`;
    }
  }

  eğer (liveEl) {
    liveEl.textContent = `Toplam harcanan: ${total} Kredi`;
  }
}
  fonksiyon syncStoryGenerateButtonCredit(root) {
  const btn = qs("[data-story-generate]", root);
  (!btn) ise geri dön;

  const total = getStoryEstimatedCredits();
  btn.setAttribute("data-credit-cost", String(total));

  eğer (!state.isGenerating) ise {
    btn.textContent = `Hikayeyi Oluştur (${total} Kredi)`;
  }
  }

  fonksiyon buildStoryPayload() {
    const selectedScenes = getSelectedScenes();
    const totalSeconds = getSelectedTotalSeconds();
    const logoAsset = getStoryLogoAsset();
    const audioAsset = getStoryAudioAsset();

    geri dönmek {
      uygulama: "çizgi film",
      mod: "hikaye",
      özet: {
        fikir: durum.hikayeFikri,
        Tema: state.theme,
        yaşGrubu: eyalet.yaşGrubu,
        SeçilenSahneSayısı: SeçilenSahnelerinUzunluğu,
        ToplamSeçiliSüreSaniye: ToplamSaniye,
        akışSüresi: durum.akışSüresi
      },
      karakterler: {
        ana: durum.anaKarakter,
        yardımcı1: durum.yardımcıKarakter1,
        yardımcı2: durum.yardımcıKarakter2,
        ekstra: durum.ekstraKarakter,
        resimler: {
          ana: {
            dosyaAdı: state.characterImages?.main?.fileName || "",
            fileUrl: state.characterImages?.main?.fileUrl || ""
          },
          yardımcı1: {
            dosyaAdı: state.characterImages?.helper1?.fileName || "",
            fileUrl: state.characterImages?.helper1?.fileUrl || ""
          },
          yardımcı2: {
            dosyaAdı: state.characterImages?.helper2?.fileName || "",
            fileUrl: state.characterImages?.helper2?.fileUrl || ""
          },
          ekstra: {
            dosyaAdı: state.characterImages?.extra?.fileName || "",
            fileUrl: state.characterImages?.extra?.fileUrl || ""
          }
        }
      },
      ayarlar: {
        aspectRatio: state.ratio,
        stil: durum.stil,
        ses: durum.ses,
        includeMusic: state.includeMusic,
        logoPosition: state.logoPosition,
        logoPosition: mapLogoPositionToShort(state.logoPosition),
        logoFileName: logoAsset.fileName || "",
        logoFileUrl: logoAsset.fileUrl || "",
        sesDosyaAdı: sesVarlığı.dosyaAdı || "",
        sesDosyasıURL'si: sesvarlığı.dosyaUrl'si || "",
        ekstraİstem: durum.ekstraİstem
      },
      sahneler: durum.sahneler.harita((sahne) => ({ ...sahne }))
    };
  }

  fonksiyon resolveSceneCharacter(sahne, hikaye yükü) {
    sabit slotValueMap = {
      ana: safeText(storyPayload?.characters?.main),
      yardımcı1: güvenliMetin(storyPayload?.karakterler?.yardımcı1),
      helper2: safeText(storyPayload?.character?.helper2),
      ekstra: safeText(storyPayload?.characters?.extra)
    };

    let slots = Array.isArray(scene?.characterSlots) ? scene.characterSlots.filter(Boolean) : [];

    yuvalar = yuvalar.filtre((yuva) => !!yuvaDeğerHaritası[yuva]);

    eğer (!slots.length) {
      if (slotValueMap.main) slots = ["main"];
      aksi takdirde yuvalar = Object.keys(slotValueMap).filter((slot) => !!slotValueMap[slot]).slice(0, 1);
    }

    const mainSlot = slots[0] || "main";
    const sceneMain = slotValueMain[mainSlot] || "";
    sabit yardımcıKarakterler = yuvalar
      .dilim(1)
      .map((slot) => slotValueMap[slot])
      .filtre(Mantıksal);

    const allNames = slots.map((slot) => slotValueMap[slot]).filter(Boolean);

    sabit görüntü yuvası =
      yuvalar.bul((yuva) => güvenliMetin(hikayeYükü?.karakterler?.resimler?.[yuva]?.dosyaUrl)) ||
      ana yuva;

    sabit karakterGörüntüUrl =
      safeText(storyPayload?.characters?.images?.[imageSlot]?.fileUrl) || "";

    geri dönmek {
      yuvalar,
      Ana sahne,
      yardımcıKarakterler,
      tüm İsimler,
      resim yuvası,
      karakterResimURL'si
    };
  }

  fonksiyon mapStorySceneToBasicPayload(storyPayload, scene) {
    const resolved = resolveSceneCharacter(scene, storyPayload);

    sabit slotLabelMap = {
      ana: safeText(storyPayload?.characters?.main),
      yardımcı1: güvenliMetin(storyPayload?.karakterler?.yardımcı1),
      helper2: safeText(storyPayload?.character?.helper2),
      ekstra: safeText(storyPayload?.characters?.extra)
    };

    sabit slotImageMap = {
      ana: safeText(storyPayload?.characters?.images?.main?.fileUrl),
      helper1: safeText(storyPayload?.characters?.images?.helper1?.fileUrl),
      helper2: safeText(storyPayload?.characters?.images?.helper2?.fileUrl),
      ekstra: safeText(storyPayload?.characters?.images?.extra?.fileUrl)
    };

    const activeSlots = (Array.isArray(resolved?.slots) ? resolved.slots : [])
      .map((slot) => SafeText(slot))
      .filtre(Mantıksal);

    const validElementSlots = activeSlots.filter((slot) => {
      const etiketi = slotLabelMap[yuva];
      const imageUrl = slotImageMap[slot];
      !!etiket ve !!resimURL'sini döndür;
    });

    sabit öğeler = validElementSlots.map((slot, index) => {
      const etiketi = slotLabelMap[yuva];
      const imageUrl = slotImageMap[slot];

      geri dönmek {
        token: `@Element${index + 1}`,
        yuva,
        isim: etiket,
        ön_resim_url: resimUrl,
        referans_resim_url'leri: [resimUrl]
      };
    });

    const characterPromptLine = elements.length
      ? `Karakterler: ${elements.map((el) => `${el.token} = ${el.name}`).join(", ")}.`
      : (çözümlenmiş.tümİsimler.uzunluk
          ? `Bu sahnedeki karakterler: ${resolved.allNames.join(", ")}.`
          : "");

    sabit promptParts = [
      "Sevimli çocuk çizgi film tarzı."
      "Parlak, renkli, hareketli bir sahne."
      `Sahne başlığı: ${safeText(scene?.title)}.`,
      `Sahne açıklaması: ${safeText(scene?.description)}.`,
      karakterİstem Satırı,
      sahne?.ruh hali ? `Ruh hali: ${safeText(scene.mood)}.` : "",
      sahne?.tür ? `Çekim türü: ${safeText(scene.type)}.` : "",
      sahne?.directorNote ? `Yönetmen notu: ${safeText(scene.directorNote)}.` : "",
      `storyPayload?.settings?.style ? `Görsel stil: ${safeText(storyPayload.settings.style)}.` : "",
      `storyPayload?.settings?.extraPrompt ? `Ekstra istem: ${safeText(storyPayload.settings.extraPrompt)}.` : "",
      elements.length ? `Sağlanan karakter referanslarını aynen kullanın ve tüm çekim boyunca karakter kimliğini tutarlı bir şekilde koruyun.` : "",
      "Dost canlısı, sevimli, çocuklar için güvenli, etkileyici animasyon."
      "Temiz çerçeve, metin yok, altyazı yok, filigran yok."
    ].filtre(Mantıksal);

    const includeMusic = safeText(storyPayload?.settings?.includeMusic).toLowerCase() === "yes";
    const audioFileUrl = safeText(storyPayload?.settings?.audioFileUrl);
    const logoFileUrl = safeText(storyPayload?.settings?.logoFileUrl);
    const logoPosition = safeText(storyPayload?.settings?.logoPosition || "bottom-right");

    geri dönmek {
      uygulama: "çizgi film",
      mod: "temel",
      extraPrompt: promptParts.join(" "),
      AnaKarakter: çözümlendi.sahneAna,
      yardımcıKarakterler: çözümlendi.yardımcıKarakterler,
      sahne: safeText(sahne?.bölüm || "hikaye") || "hikaye",
      eylemler: [],
      Eylem: "Sahne içinde doğal davranmak",
      Süre: normalizeStorySceneDuration(sahne?.süre),
      aspectRatio: String(storyPayload?.settings?.aspectRatio || "16:9"),
      seskaynağı: müzik dahil et ve ses dosyası URL'si ? "yükle" : "yok",
      audioMode: includeMusic && audioFileUrl ? "upload" : "none",
      sesDosyaAdı: müzik dahil et ? güvenliMetin(hikayeYüklemesi?.ayarlar?.sesDosyaAdı) : "",
      audioFileUrl: includeMusic ? audioFileUrl : "",
      logoFileName: safeText(storyPayload?.settings?.logoFileName),
      logoFileUrl: logoFileUrl,
      logoPosition: logoPosition,
      logoPosition: mapLogoPositionToShort(logoPosition),
      Karakter Resmi: null,
      KarakterResimAdı: "",
      karakterResimUrl: çözümlendi.karakterResimUrl,
      öğeler: öğeler.map((el) => ({
      jeton: el.token,
      frontal_image_url: el.frontal_image_url,
      referans_resim_url'leri: el.referans_resim_url'leri
      })),
       Tahmini Krediler: Sayı(storyPayload?.tahminiKrediler || 0),
        meta: {
        uygulama: "çizgi film",
        mod: "hikaye",
        sahne_kimliği: Dize(sahne?.id || ""),
        sahne_başlığı: Dize(sahne?.başlık || ""),
        sahne_süresi: normalizeStorySceneDuration(sahne?.süresi),
       sahne_yuvaları: çözümlenmiş.yuvalar,
       hikaye_fikri: Dize(hikayeYükü?.özet?.fikir || ""),
       hikaye_akış_süresi: Dize(hikaye_yükü?.özet?.akışsüresi || ""),
       kredi_maliyeti: Sayı(storyPayload?.estimatedCredits || 0),
        logo_url: logoFileUrl || "",
        logo_pos: mapLogoPositionToShort(logoPosition),
        include_audio: includeMusic,
        ses_url: müzik dahil et ? ses dosyası URL'si : "",
        fal_elements_debug: elements.map((el) => ({
          jeton: el.token,
          slot: el.slot,
          isim: el.name,
          frontal_image_url: el.frontal_image_url
        }))
      }
    };
  }

  asenkron fonksiyon createStoryScenesFromPayload(storyPayload) {
    const scenes = (Array.isArray(storyPayload?.scenes) ? storyPayload.scenes : []).filter(
      (sahne) => sahne && sahne.seçili === doğru
    );

    eğer (sahnelerin uzunluğu yoksa) {
      throw new Error("Önce en az 1 sahne incelemesinin kaydedilmesi.");
    }

    resetStoryPollBatch();
    storyPollState.total = scenes.length;

    sabit oluşturuldu = [];

    (sahnelerin sabit bir sahnesi için) {
      const body = mapStorySceneToBasicPayload(storyPayload, scene);

      console.log("[CARTOON][STORY_SCENE_CREATE_BODY]", {
        sahne_kimliği: sahne?.kimliği,
        sahne_başlığı: sahne?.başlık,
        seçili: sahne?.seçili,
        Süre: sahne?.süre,
        normalleştirilmiş_süre: gövde?.süre,
        scene_characterSlots_raw: scene?.characterSlots || [],
        body_mainCharacter: body?.mainCharacter,
        body_helperCharacters: body?.helperCharacters || [],
        gövde_elemanları: gövde?.elemanlar || [],
        body_meta_scene_slots: body?.meta?.scene_slots || [],
        body_fal_elements_debug: body?.meta?.fal_elements_debug || [],
        body_characterImageUrl: body?.characterImageUrl || "",
        body_logoFileUrl: body?.logoFileUrl || "",
        body_audioFileUrl: body?.audioFileUrl || "",
        body_logoPos: body?.logoPos || "",
        body_extraPrompt: body?.extraPrompt || ""
      });

      const r = await fetch("/api/providers/fal/cartoon/create", {
        yöntem: "POST",
        başlıklar: { "Content-Type": "application/json" },
        gövde: JSON.stringify(gövde)
      });

      const j = await r.json().catch(() => null);

      eğer (!r.ok || !j || j.ok === false) {
        yeni bir Hata fırlat(
          `${String(scene?.title || "scene")} -> ${j?.error || `story_scene_create_failed_${r.status}`}`
        );
      }

      sabit öğe = {
        sahne_kimliği: Dize(sahne?.id || ""),
        sahne_başlığı: Dize(sahne?.başlık || ""),
        iş_kimliği: Dize(j?.iş_kimliği || ""),
        istek_kimliği: Dize(j?.istek_kimliği || ""),
        durum_url: Dize(j?.durum_url || "")
      };

      oluşturuldu.it(öğe);

      if (!window.__CARTOON_STORY_CREATED_JOBS__) {
        pencere.__ÇİZGİ FİLM_HİKAYESİ_YARATILDI_İŞLER__ = [];
      }

      pencere.__CARTOON_STORY_CREATED_JOBS__.push(öğe);

      pencere.göndermeOlayı(
        yeni ÖzelOlay("aivo:cartoon:job_created", {
          detay: {
            uygulama: "çizgi film",
            mod: "hikaye",
            sahne kimliği: öğe.sahne_kimliği,
            sahneBaşlığı: öğe.sahne_başlığı,
            iş_kimliği: öğe.iş_kimliği,
            istek_kimliği: öğe.istek_kimliği,
            durum_url: öğe.durum_url,
            createdAt: Date.now(),
            meta: {
              uygulama: "çizgi film",
              mod: "hikaye",
              sağlayıcı: "fal",
              sahne_kimliği: öğe.sahne_kimliği,
              sahne_başlığı: öğe.sahne_başlığı
            }
          }
        })
      );

      eğer (ürün.iş_kimliği) {
        ensureStoryJobState(item.job_id, item);
        pollStorySceneJob(item.job_id, item, 0);
      }
    }

    Oluşturulanı döndür;
  }

  async function pollStorySceneJob(jobId, item, tries = 0, readyChecks = 0) {
    sabit anahtar = güvenli metin(işkimliği);
    const entry = ensureStoryJobState(key, item);
    Eğer (anahtar yoksa, giriş yoksa, giriş tamamlandıysa veya giriş başarısız olduysa) geri dön;

    giriş.denemeler = Sayı(denemeler || 0);
    giriş.hazırÇekler = Sayı(hazırÇekler || 0);

    denemek {
      const url = `/api/jobs/status?job_id=${encodeURIComponent(key)}&debug=1&t=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => null);

      giriş.sonyanıt = j || null;

      console.log("[ÇİZGİ FİLM][HİKAYE] anket =", key, item?.scene_title, {
        denemeler,
        hazır çekler,
        yanıt: j
      });

      eğer (!j || j.ok === false ise {
        eğer (deneme sayısı < STORY_MAX_POLLS) {
          scheduleStoryPoll(key, item, tries + 1, STORY_POLL_INTERVAL);
        } başka {
          markStoryJobFailed(key, item, j);
        }
        geri dönmek;
      }

      const normalizedStatus = String(j?.status || j?.db_status || j?.state || "")
        .trim()
        .toLowerCase();

      sabit readyVideoUrl = String(
        j?.video?.url ||
        j?.video_url ||
        j?.çıktı?.url ||
        ""
      ).trim();

      const outputs = Array.isArray(j?.outputs) ? j.outputs : [];

      const hasReadyOutput = outputs.some((o) => {
        const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
        const u = String(o?.url || o?.video_url || "").trim();
        return !!u && (!t || t === "video");
      });

      sabit finalVideoUrl =
        hazırVideoURL ||
        Sicim(
          çıktılar.bul((o) => String(o?.url || o?.video_url || "").trim())?.url ||
          çıktılar.bul((o) => String(o?.url || o?.video_url || "").trim())?.video_url ||
          ""
        ).trim();

      giriş.sondurum = normalleştirilmişdurum;

      console.log("[CARTOON][STORY_READY_CHECK]", {
        iş kimliği: anahtar,
        sahneBaşlığı: öğe?.sahne_başlığı || "",
        denemeler,
        hazır çekler,
        normalleştirilmişDurum,
        hazırVideoUrl,
        finalVideoUrl,
        hasReadyOutput,
        çıktılar,
        ham: j
      });

      const isReadyLike = ["ready", "completed", "complete", "succeeded", "done"].includes(normalizedStatus);
      const isFailedLike = ["error", "failed", "canceled", "canceled"].includes(normalizedStatus);

      if (isReadyLike && finalVideoUrl) {
        markStoryJobReady(key, item, {
          durum: normalleştirilmişdurum,
          video: { url: finalVideoUrl },
          çıktılar,
          ham: j
        });
        geri dönmek;
      }

      if (isReadyLike && !finalVideoUrl) {
        if (readyChecks < STORY_READY_RECHECK_LIMIT) {
          scheduleStoryPoll(key, item, tries, STORY_READY_RECHECK_INTERVAL);
          giriş.hazırKontroller = hazırKontroller + 1;
          geri dönmek;
        }

        eğer (deneme sayısı < STORY_MAX_POLLS) {
          scheduleStoryPoll(key, item, tries + 1, STORY_POLL_INTERVAL);
          geri dönmek;
        }

        markStoryJobFailed(key, item, j);
        geri dönmek;
      }

      if (isFailedLike) {
        console.error("[CARTOON][STORY] iş hatası =", key, item?.scene_title, j);
        markStoryJobFailed(key, item, j);
        geri dönmek;
      }

      eğer (deneme sayısı < STORY_MAX_POLLS) {
        scheduleStoryPoll(key, item, tries + 1, STORY_POLL_INTERVAL);
        geri dönmek;
      }

      markStoryJobFailed(key, item, j);
    } hata yakala {
      console.error("[CARTOON][STORY] poll error =", key, item?.scene_title, err);

      eğer (deneme sayısı < STORY_MAX_POLLS) {
        scheduleStoryPoll(key, item, tries + 1, STORY_POLL_INTERVAL);
        geri dönmek;
      }

      markStoryJobFailed(key, item, { error: String(err?.message || err || "story_poll_failed") });
    }
  }

  fonksiyon saveSceneEditor(root) {
    Eğer (!state.editingSceneId) doğru değilse, geri dön;

    const editör = getStorySceneEditor(root);
    Eğer (!editör) ise geri dön;

    const title = safeText(qs("[data-scene-editor-title]", editor)?.value);
    const description = safeText(qs("[data-scene-editor-description]", editor)?.value);
    const duration = normalizeStorySceneDuration(qs("[data-scene-editor-duration]", editor)?.value || "15");
    const characterSlots = getSceneCharacterPickerValues(root);
    const mood = safeText(qs("[data-scene-editor-mood]", editor)?.value);
    const type = safeText(qs("[data-scene-editor-type]", editor)?.value);
    const note = clampText(qs("[data-scene-editor-note]", editor)?.value, 1000);

    if (!title) return alarm("Sahne Başlığı zorunludur.");
    if (!description) return alarm("Sahne açıklaması zorunludur.");

    eğer (karakter yuvalarının uzunluğu yoksa) {
      return warning("Bu sahne için en az 1 karakter seçmelisin.");
    }

    updateSceneById(state.editingSceneId, {
      başlık,
      Tanım,
      karakterler: "",
      karakter yuvaları,
      seçili: doğru,
      süre,
      mod,
      tip,
      Yönetmen Notu: not
    });

    durum.düzenlemeSahneKimliği = "";
    resetStoryPolicyUI(root);
    render(root);
  }

fonksiyon syncStoryPresetCharacterCards(root) {
  Eğer kök yoksa geri dön;

  const helperSlots = ["helper1", "helper2", "extra"];
  sabit helperStateKeys = {
    yardımcı1: "yardımcıKarakter1",
    yardımcı2: "yardımcıKarakter2",
    ekstra: "ekstraKarakter"
  };

  sabit sıralıSeçimler = [
    { slot: "main", label: safeText(state.mainCharacter) },
    { slot: "helper1", label: safeText(state.helperCharacter1) },
    { slot: "helper2", label: safeText(state.helperCharacter2) },
    { slot: "ekstra", label: safeText(state.extraCharacter) }
  ].filter((item) => item.label);

  sabit orderMap = yeni Map(
    orderedSelections.map((item, index) => [item.label, index + 1])
  );

  const storyView = qs('.cartoon-mode-view[data-cartoon-view="story"]', root);

  eğer (hikaye görünümü) {
    const headings = qsa("h1, h2, h3, h4", storyView);
    const charactersHeading = headings.find((el) => safeText(el.textContent) === "Karakterler");

    eğer (karakterlerBaşlık) {
      let counter = qs('[data-story-selected-counter]', charactersHeading.parentElement || storyView);

      eğer (!sayaç) {
        sayaç = document.createElement("div");
        sayaç.setAttribute("data-story-selected-counter", "");
        sayaç.stil.üstkenar boşluğu = "10px";
        sayaç.stil.metinHizalama = "ortala";
        sayaç.stil.yazıboyutu = "14px";
        sayaç.stil.yazıkalınlığı = "800";
        sayaç.stil.renk = "rgba(255,255,255,.88)";
        charactersHeading.insertAdjacentElement("afterend", counter);
      }

      counter.textContent = `Seçili Karakter: ${orderedSelections.length} / ${STORY_MAX_TOTAL_CHARACTERS}`;
    }
  }

  qsa('.cartoon-mode-view[data-cartoon-view="story"] [data-role="main"]', root).forEach((btn) => {
    sabit düğme etiketi =
      safeText(qs(".cartoon-character-name", btn)?.textContent) ||
      güvenliMetin(düğme.metinİçeriği) ||
      güvenliMetin(düğme.veri kümesi.karakter);

    const isSelectedInState = safeText(state.mainCharacter) === btnLabel;
    btn.classList.toggle("is-selected", isSelectedInState);

    rozet = qs('[data-story-order-badge]', btn);
    Eğer rozet varsa, rozeti kaldır.

    eğer (seçili durumdaysa) {
      rozet = document.createElement("span");
      rozet.setAttribute("data-story-order-badge", "");
      rozet.textContent = String(orderMap.get(btnLabel) || "");
  rozet.stil.solkenar = "otomatik";
rozet.stil.esneklikküçültme = "0";
rozet.stil.görüntüleme = "satır içi esnek";
rozet.stil.hizalamaÖğeleri = "ortala";
rozet.stil.içeriğiortaya ...
rozet.stil.genişlik = "24px";
rozet.stil.yükseklik = "24px";
rozet.stil.kenar yarıçapı = "999px";
rozet.stil.arka plan = "rgba(255,255,255,.18)";
rozet.stil.kenar = "1px solid rgba(255,255,255,.22)";
rozet.stil.yazıboyutu = "12px";
rozet.stil.yazıkalınlığı = "900";
rozet.stil.renk = "#fff";
düğme.appendChild(rozet);
    }
  });

  qsa('.cartoon-mode-view[data-cartoon-view="story"] [data-role="helper"]', root).forEach((btn) => {
    sabit düğme etiketi =
      safeText(qs(".cartoon-character-name", btn)?.textContent) ||
      güvenliMetin(düğme.metinİçeriği) ||
      güvenliMetin(düğme.veri kümesi.karakter);

    const isSelectedInState = helperSlots.some((slot) => {
      const stateKey = helperStateKeys[yuva];
      return safeText(state[stateKey]) === btnLabel;
    });

    btn.classList.toggle("is-selected", isSelectedInState);

    rozet = qs('[data-story-order-badge]', btn);
    Eğer rozet varsa, rozeti kaldır.

    eğer (seçili durumdaysa) {
      rozet = document.createElement("span");
      rozet.setAttribute("data-story-order-badge", "");
      rozet.textContent = String(orderMap.get(btnLabel) || "");
rozet.stil.solkenar = "otomatik";
rozet.stil.esneklikküçültme = "0";
rozet.stil.görüntüleme = "satır içi esnek";
rozet.stil.hizalamaÖğeleri = "ortala";
rozet.stil.içeriğiortaya ...
rozet.stil.genişlik = "24px";
rozet.stil.yükseklik = "24px";
rozet.stil.kenar yarıçapı = "999px";
rozet.stil.arka plan = "rgba(255,255,255,.18)";
rozet.stil.kenar = "1px solid rgba(255,255,255,.22)";
rozet.stil.yazıboyutu = "12px";
rozet.stil.yazıkalınlığı = "900";
rozet.stil.renk = "#fff";
düğme.appendChild(rozet);
    }
  });
}
  fonksiyon render(root) {
    Eğer kök yoksa geri dön;

    buildCharacterOptions(root);
    syncModeTabs(root);
    syncModeViews(root);
    syncStoryFormValues(root);
    syncStoryFlowDuration(root);
    syncCharacterSelect(root);
    syncStoryPresetCharacterCards(root);
    renderSectionScenes(root);
    syncStorySectionCounts(root);
    syncStoryAccordion(root);
    syncStorySettings(root);
    syncSceneRows(root);
    syncSceneEditor(root);
    updateStoryIdeaCount(root);
    syncAllStoryCharacterUploadUI(root);
    syncStorySettingsUploadUI(root);
    syncStoryDurationSummary(root);
    syncStoryGenerateButtonCredit(root);
  }

  fonksiyon bindClicks() {
    document.addEventListener("click", async (e) => {
      sabit kök = getCartoonRoot();
      Eğer kök yoksa geri dön;

  const modeBtn = e.target.closest("[data-cartoon-mode]");
if (modeBtn && root.contains(modeBtn)) {
  e.preventDefault();
  durum.mod = modeBtn.dataset.cartoonMode || "hikaye";
  resetStoryPolicyUI(root);
  render(root);
  geri dönmek;
}

const storyCharacterCard = e.target.closest("[data-role][data-character]");
if (storyCharacterCard && root.contains(storyCharacterCard)) {
  const storyView = storyCharacterCard.closest('.cartoon-mode-view[data-cartoon-view="story"]');
  Eğer (hikaye görünümü gizli değilse) geri dön;

  e.preventDefault();

  const role = safeText(storyCharacterCard.dataset.role);
  const value = safeText(storyCharacterCard.dataset.character);
  sabit etiket =
    safeText(qs(".cartoon-character-name", storyCharacterCard)?.textContent) ||
    güvenliMetin(hikayeKarakterKartı.metinİçeriği) ||
    değer;

  Eğer rol, değer veya etiket yoksa, geri dön;

  const helperSlots = ["helper1", "helper2", "extra"];
  sabit helperStateKeys = {
    yardımcı1: "yardımcıKarakter1",
    yardımcı2: "yardımcıKarakter2",
    ekstra: "ekstraKarakter"
  };

  const totalSelectedCount = getStorySelectedCharacterCount(root);

  eğer rol "ana" ise {
    const isAlreadySelected = safeText(state.mainCharacter) === label;
    const mainImageState = getStoryCharacterImage("main");
    const hasMainUpload = !!(mainImageState && mainImageState.file);
    const hasMainPreset = !!safeText(state.mainCharacter);

    eğer (zaten seçiliyse ve ana yükleme yoksa) {
      durum.anaKarakter = "";
      toastStoryCharacterRemoved("main");
      resetStoryPolicyUI(root);
      render(root);
      geri dönmek;
    }

    if (hasMainUpload && !isAlreadySelected) {
      warning("Ana Karakter slotunda özel karakter var. Önce onu kaldırmalısınız.");
      geri dönmek;
    }

    const willAddNewMainPreset = !isAlreadySelected && !hasMainPreset;
    if (willAddNewMainPreset && totalSelectedCount >= STORY_MAX_TOTAL_CHARACTERS) {
      HikayeKarakteriSınırlıUyarısınıGöster();
      render(root);
      geri dönmek;
    }

    durum.anaKarakter = etiket;
    toastStoryCharacterAdded("main");
    resetStoryPolicyUI(root);
    render(root);
    geri dönmek;
  }

  eğer (rol === "yardımcı") {
    const selectedSlot = helperSlots.find((slot) => safeText(state[helperStateKeys[slot]]) === label);

    eğer (seçilen yuva) {
      const selectedImageState = getStoryCharacterImage(selectedSlot);
      const hasUploadInSelectedSlot = !!(selectedImageState && selectedImageState.file);

      eğer (seçili yuvada yükleme yoksa) {
        durum[yardımcıDurumAnahtarları[seçilenYuva]] = "";
        toastStoryCharacterRemoved(selectedSlot);
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      warning("Bu slotta özel karakter var. Önce onu kaldırmalısınız.");
      geri dönmek;
    }

    const emptySlot = helperSlots.find((slot) => !safeText(state[helperStateKeys[slot]]));

    eğer (!emptySlot) {
      HikayeKarakteriSınırlıUyarısınıGöster();
      render(root);
      geri dönmek;
    }

    durum[yardımcıDurumAnahtarları[boşyuva]] = etiket;
    toastStoryCharacterAdded(emptySlot);
    resetStoryPolicyUI(root);
    render(root);
    geri dönmek;
  }
}
      const sectionToggle = e.target.closest("[data-story-section-toggle]");
      if (sectionToggle && root.contains(sectionToggle)) {
        e.preventDefault();
        const sectionEl = sectionToggle.closest("[data-story-section]");
        const sectionId = sectionEl?.dataset.storySection || "";
        Eğer (!sectionId) ise geri dön;
        state.openSection = state.openSection === sectionId ? "" : sectionId;
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const settingsToggle = e.target.closest("[data-story-settings-toggle]");
      if (settingsToggle && root.contains(settingsToggle)) {
        e.preventDefault();
        durum.ayarlarAçık = !durum.ayarlarAçık;
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const editSceneBtn = e.target.closest("[data-edit-scene]");
      if (editSceneBtn && root.contains(editSceneBtn)) {
        e.preventDefault();
        const sceneId = editSceneBtn.dataset.editScene || "";
        Eğer (!sceneId) değilse, geri dön;
        state.editingSceneId = sceneId;
        render(root);
        geri dönmek;
      }

      const sceneCharacterItem = e.target.closest(".story-scene-character-item");
      if (sceneCharacterItem && getStorySceneEditor(root)?.contains(sceneCharacterItem)) {
        e.preventDefault();

        const slot = safeText(sceneCharacterItem.dataset.sceneCharacterSlot);
        Eğer (!slot) ise geri dön;

        const isSelected = sceneCharacterItem.dataset.selected === "true";
        sceneCharacterItem.dataset.selected = isSelected ? "false" : "true";

        const dot = qs(".story-scene-character-dot", sceneCharacterItem);
        eğer (nokta) {
          nokta.stil.arka plan = seçili
            ? "rgba(255,255,255,.18)"
            : "linear-gradient(135deg,#22c55e,#16a34a)";
          dot.style.boxShadow = isSelected ? "none" : "0 0 12px rgba(34,197,94,.45)";
        }

        sahneKarakterÖğesi.stil.kenar = Seçili
          ? "1px solid rgba(255,255,255,.12)"
          : "1px solid rgba(201,119,255,.55)";
        sahneKarakterÖğesi.stil.arka plan = Seçili
          ? "rgba(255,255,255,.04)"
          : "linear-gradient(135deg, rgba(146,92,255,.22), rgba(255,98,174,.18))";
        sahneKarakterÖğesi.stil.kutuGölgesi = Seçili
          ? "hiçbiri"
          : "0 0 0 1px rgba(201,119,255,.18) inset, 0 10px 30px rgba(121,65,255,.14)";

        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const cancelBtn = e.target.closest("[data-scene-cancel]");
      if (cancelBtn && getStorySceneEditor(root)?.contains(cancelBtn)) {
        e.preventDefault();
        durum.düzenlemeSahneKimliği = "";
        render(root);
        geri dönmek;
      }

      const saveBtn = e.target.closest("[data-scene-save]");
      if (saveBtn && getStorySceneEditor(root)?.contains(saveBtn)) {
        e.preventDefault();
        saveSceneEditor(root);
        geri dönmek;
      }

      const uploadTrigger = e.target.closest("[data-story-upload-trigger]");
      if (uploadTrigger && root.contains(uploadTrigger)) {
        e.preventDefault();
        const slot = safeText(uploadTrigger.dataset.storyUploadTrigger);
        Eğer (!slot) ise geri dön;

        const input = qs(`[data-story-character-file="${slot}"]`, root);
        Eğer (giriş) ise, girişe tıklayın;
        geri dönmek;
      }

      const uploadRemove = e.target.closest("[data-story-upload-remove]");
      if (uploadRemove && root.contains(uploadRemove)) {
        e.preventDefault();
        const slot = safeText(uploadRemove.dataset.storyUploadRemove);
        Eğer (!slot) ise geri dön;

        resetStoryCharacterImage(root, slot);
        toastStoryCharacterRemoved(slot);
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const storyLogoClear = e.target.closest("[data-story-logo-upload-clear]");
      if (storyLogoClear && root.contains(storyLogoClear)) {
        e.preventDefault();
        resetStoryLogoAsset(root);
        try { window.toast?.success?.("Logo kaldırıldı · -10 kredi"); } yakalamak {}
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const storyAudioClear = e.target.closest("[data-story-audio-upload-clear]");
      if (storyAudioClear && root.contains(storyAudioClear)) {
        e.preventDefault();
        resetStoryAudioAsset(root);
        try { window.toast?.success?.("Müzik kaldırıldı · -10 kredi"); } yakalamak {}
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const generateBtn = e.target.closest("[data-story-generate]");
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();
        Eğer durum modu "story" değilse, geri dön;
        Eğer durum (üretim yapıyorsa) geri dön;

        if (!safeText(state.storyIdea)) {
          try { window.toast?.info?.("Hikaye fikri yazmamalısın"); } yakalamak {}
          const storyIdeaEl = qs("[data-story-idea]", root);
          if (storyIdeaEl) storyIdeaEl.focus();
          geri dönmek;
        }

        const selectedScenes = getSelectedScenes();
        const totalSeconds = getSelectedTotalSeconds();

        eğer (seçili sahnelerin uzunluğu yoksa) {
          alarm("Önce en az 1 sahneyi düzenleyip kaydedin. Kaydettiğin sahneler görüldü.");
          geri dönmek;
        }

        const slots = STORY_CHARACTER_SLOT_CONFIG.map((config) => config.slot);

        (sabit sayıda yuva için) {
          const imageState = getStoryCharacterImage(slot);
          Eğer (imageState veya imageState.file mevcut değilse) devam et;

          if (imageState.uploadStatus === "uploading" && imageState.uploadPromise) {
            denemek {
              imageState.uploadPromise'i bekleyin;
            } yakalamak {
              geri dönmek;
            }
          }

          if (!imageState.fileUrl || imageState.uploadStatus !== "ready") {
            warning("Karakter görsellerinden biri henüz yüklenmedi. Lütfen yükleme tamamlanınca tekrar deneyin.");
            geri dönmek;
          }
        }

        const logoAsset = getStoryLogoAsset();
        eğer (logoAsset.file) {
          if (logoAsset.uploadStatus === "uploading" && logoAsset.uploadPromise) {
            denemek {
              logoAsset.uploadPromise'i bekleyin;
            } yakalamak {
              geri dönmek;
            }
          }

          Eğer logoAsset.fileUrl "ready" değilse, logoAsset.uploadStatus "ready" değilse,
            warning("Logo henüz yüklenmedi. Lütfen logo yüklemesi tamamlanınca tekrar deneyin.");
            geri dönmek;
          }
        }

        const audioAsset = getStoryAudioAsset();
        if (safeText(state.includeMusic).toLowerCase() === "yes") {
          eğer (!audioAsset.file) {
            alarm("Müziği videoya dahil etmek için bir ses dosyası yüklenmeden önce.");
            geri dönmek;
          }

          if (audioAsset.uploadStatus === "yükleniyor" && audioAsset.uploadPromise) {
            denemek {
              audioAsset.uploadPromise'ı bekliyoruz;
            } yakalamak {
              geri dönmek;
            }
          }

          Eğer (!audioAsset.fileUrl || audioAsset.uploadStatus "ready" değilse) {
            warning("Müzik henüz yüklenmedi. Lütfen yükleme tamamlanınca tekrar deneyin.");
            geri dönmek;
          }
        }

        const policyText = buildStoryPolicyText();
        if (isStoryPolicyBlocked(policyText)) {
          const storyIdeaEl = qs("[data-story-idea]", root);
          const extraPromptEl = qs("[data-story-extra-prompt]", root);
          const policyNote = ensureStoryPolicyNote(root, generateBtn);

          eğer (storyIdeaEl) {
            storyIdeaEl.style.borderColor = "rgba(255,110,140,.92)";
            storyIdeaEl.style.boxShadow = "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
          }

          eğer (extraPromptEl) {
            extraPromptEl.style.borderColor = "rgba(255,110,140,.92)";
            extraPromptEl.style.boxShadow = "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
          }

          generateBtn.style.background = "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
          generateBtn.style.borderColor = "rgba(255,110,140,.95)";
          generateBtn.style.boxShadow = "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
          generateBtt.style.cursor = "izin verilmiyor";
          generateBtn.style.filter = "saturate(1.05)";

          eğer (politika notu) {
            PolicyNote.textContent = "Bu istek bu biçim üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine hikayeyi, sahneleri ve karakter davranışları tarife et.";
            policyNote.style.display = "block";
          }

          geri dönmek;
        }

        const creditCost = getStoryEstimatedCredits();
        const SummaryText = `${selectedScenes.length} sahne üretilecek.\nToplam süre: ${formatSecondsLabel(totalSeconds)}.\nToplam kredi: ${creditCost}.\nDevam edilsin mi?`;
        Eğer (!window.confirm(summaryText)) {
          geri dönmek;
        }
        const creditReason = "studio_cartoon_story_generate";

const creditRes = await fetch("/api/credits/consume", {
  yöntem: "POST",
  Kimlik bilgileri: "dahil et",
  başlıklar: {
    "içerik-türü": "application/json",
    "kabul et": "uygulama/json"
  },
  gövde: JSON.stringify({
    maliyet: krediMaliyeti,
    sebep: krediSebep
  })
});

let creditData = null;
denemek {
  creditData = await creditRes.json();
} yakalamak {
  creditData = { ok: false, error: "non_json_response", status: creditRes.status };
}

if (!creditRes.ok || !creditData?.ok) {
  sabit to = encodeURIComponent(
    konum.yoladı + konum.arama + konum.karma
  );

  konum.href =
    "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;

  geri dönmek;
}

denemek {
  const creditGetRes = await fetch("/api/credits/get", {
    Kimlik bilgileri: "dahil et",
    önbellek: "depolama yok",
    başlıklar: { "accept": "application/json" }
  });

  const creditGetData = await creditGetRes.json().catch(() => null);

  if (creditGetData?.ok && typeof creditGetData.credits === "number") {
    const topCreditCountEl = document.getElementById("topCreditCount");
    eğer (topCreditCountEl) {
      topCreditCountEl.textContent = String(creditGetData.credits);
    }

    if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
      window.AIVO_STORE_V1.setCredits(creditGetData.credits);
    }
  }
} yakalamak {}

sabit payload = buildStoryPayload();
payload.estimatedCredits = creditCost;

pencere.__SON_KARİKATÜR_HİKAYESİ_YÜKÜ__ = yük;
console.log("[CARTOON][STORY_PAYLOAD_READY]", payload);

durum.oluşturuluyor = doğru;
setStoryGenerateButton(root, true);

try { window.toast?.success?.("Hikaye üretimi başladı"); } yakalamak {}

        denemek {
          const created = await createStoryScenesFromPayload(payload);

          pencere.__SON_ÇİZGİ_HİKAYE_OLUŞTURULMA__ = oluşturuldu;
          console.log("[CARTOON][STORY_CREATE_OK]", created);

          pencere.göndermeOlayı(
            yeni ÖzelOlay("aivo:cartoon:story_payload_ready", {
              detay: {
                yük,
                oluşturuldu
              }
            })
          );
        } hata yakala {
          console.error("[CARTOON][STORY_CREATE_ERROR]", err);
          alert(String(err?.message || err || "story_scene_create_failed"));
          durum.oluşturuluyor = yanlış;
          setStoryGenerateButton(root, false);
        } Sonunda {
          render(root);
        }

        geri dönmek;
      }
    });

    pencere.addEventListener("aivo:cartoon:story_scene_ready", (e) => {
      sabit d = e?.detay || {};
      console.log("[CARTOON][STORY_SCENE_READY]", d);

      sabit kök = getCartoonRoot();
      eğer (kök) ise render(kök);

      eğer (
        Number(storyPollState.total || 0) > 0 &&
        Sayı(storyPollState.ready || 0) === Sayı(storyPollState.total || 0)
      ) {
        try { window.toast?.success?.("Hikaye hazır"); } catch {}
      }
    });
  }

  fonksiyon bindInputs() {
    document.addEventListener("input", (e) => {
      sabit kök = getCartoonRoot();
      Eğer kök yoksa geri dön;

      const storyIdea = e.target.closest("[data-story-idea]");
      if (storyIdea && root.contains(storyIdea)) {
        durum.hikayefikri = clampText(hikayefikri.değer, 5000);
        resetStoryPolicyUI(root);
        updateStoryIdeaCount(root);
        geri dönmek;
      }

      const extraPrompt = e.target.closest("[data-story-extra-prompt]");
      if (extraPrompt && root.contains(extraPrompt)) {
        state.extraPrompt = clampText(extraPrompt.value, 5000);
        resetStoryPolicyUI(root);
      }
    });
  }

  fonksiyon bindChanges() {
    document.addEventListener("change", (e) => {
      sabit kök = getCartoonRoot();
      Eğer kök yoksa geri dön;

      const theme = e.target.closest("[data-story-theme]");
      eğer (tema ve kök dizin temayı içeriyorsa) {
        durum.tema = tema.değer || "";
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const ageGroup = e.target.closest("[data-story-age-group]");
      eğer (yaş grubu && kök dizinde yaş grubu varsa) {
        eyalet.yaşgrubu = yaşgrubu.değer || "";
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const flowDuration = e.target.closest("[data-story-flow-duration]");
      if (flowDuration && root.contains(flowDuration)) {
        durum.akışSüresi = akışSüresi.değer || "3";
        durum.sahneler = varsayılan sahneler oluştur(durum.akışSüresi);
        durum.açılışBölümü = "giriş";
        durum.düzenlemeSahneKimliği = "";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const duration = e.target.closest("[data-story-duration]");
      eğer (süre && kök dizinde süre varsa) {
        durum.süre = süre.değer || "180";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }
      const sceneEditorDuration = e.target.closest("[data-scene-editor-duration]");
if (sceneEditorDuration && getStorySceneEditor(root)?.contains(sceneEditorDuration)) {
  syncSceneEditorCreditPreview(root);
  geri dönmek;
}
      const mainCharacter = e.target.closest("[data-story-main-character]");
      if (mainCharacter && root.contains(mainCharacter)) {
        durum.anaKarakter = anaKarakter.değer || "";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const helper1 = e.target.closest("[data-story-helper-1]");
      if (helper1 && root.contains(helper1)) {
        durum.yardımcıKarakter1 = yardımcı1.değer || "";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const helper2 = e.target.closest("[data-story-helper-2]");
      if (helper2 && root.contains(helper2)) {
        durum.yardımcıKarakter2 = yardımcı2.değer || "";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const helper3 = e.target.closest("[data-story-helper-3], [data-story-extra-character]");
      if (helper3 && root.contains(helper3)) {
        durum.ekstraKarakter = helper3.değer || "";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      sabit oran = e.target.closest("[data-story-ratio]");
      eğer (oran ve kök oranı içeriyorsa) {
        durum.oranı = oran.değeri || "16:9";
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const style = e.target.closest("[data-story-style]");
      eğer (stil ve kök dizin stili içeriyorsa) {
        durum.stil = stil.değer || "";
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const audio = e.target.closest("[data-story-audio]");
      eğer (ses dosyası ve root.contains(ses dosyası)) {
        durum.ses = ses.değeri || "yok";
        resetStoryPolicyUI(root);
        geri dönmek;
      }

      const includeMusic = e.target.closest("[data-story-include-music]");
      if (includeMusic && root.contains(includeMusic)) {
        durum.includeMusic = includeMusic.value || "hayır";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const logoPosition = e.target.closest("[data-story-logo-position]");
      if (logoPosition && root.contains(logoPosition)) {
        durum.logoPosition = logoPosition.value || "bottom-right";
        resetStoryPolicyUI(root);
        render(root);
        geri dönmek;
      }

      const storyLogoUpload = e.target.closest("[data-story-logo-upload]");
      if (storyLogoUpload && root.contains(storyLogoUpload)) {
        sabit dosya =
          storyLogoUpload.files && storyLogoUpload.files[0]
            ? storyLogoUpload.files[0]
            : hükümsüz;

        setStoryLogoAsset({
          dosya,
          DosyaAdı: dosya ? dosya.adı : "",
          dosya URL'si: "",
          uploadPromise: null,
          YüklemeDurumu: dosya ? "yükleniyor" : "boşta",
          Yükleme Hatası: ""
        });

        updateStoryLogoUploadUI(root);

        Dosya yoksa geri dön;

        const uploadPromise = uploadStoryLogoToR2(file)
          .then((publicUrl) => {
            setStoryLogoAsset({
              dosyaUrl: güvenliMetin(publicUrl),
              Yükleme Durumu: "hazır",
              Yükleme Hatası: "",
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            if (nextRoot) updateStoryLogoUploadUI(nextRoot);

            try { window.toast?.success?.("Logo eklendi · +10 kredi"); } catch {}
            console.log("[CARTOON][STORY_LOGO_UPLOAD_OK]", publicUrl);
            publicUrl'yi döndür;
          })
          .catch((err) => {
            setStoryLogoAsset({
              dosya URL'si: "",
              Yükleme Durumu: "hata",
              Yükleme Hatası: String(err?.message || err || "story_logo_upload_failed"),
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            if (nextRoot) updateStoryLogoUploadUI(nextRoot);

            console.error("[CARTOON][STORY_LOGO_UPLOAD_ERROR]", err);
            alert(String(err?.message || err || "story_logo_upload_failed"));
            hata fırlat;
          });

        setStoryLogoAsset({ uploadPromise });
        geri dönmek;
      }

      const storyAudioUpload = e.target.closest("[data-story-audio-upload]");
      if (storyAudioUpload && root.contains(storyAudioUpload)) {
        sabit dosya =
          storyAudioUpload.files && storyAudioUpload.files[0]
            ? storyAudioUpload.files[0]
            : hükümsüz;

        setStoryAudioAsset({
          dosya,
          DosyaAdı: dosya ? dosya.adı : "",
          dosya URL'si: "",
          uploadPromise: null,
          YüklemeDurumu: dosya ? "yükleniyor" : "boşta",
          Yükleme Hatası: ""
        });

        updateStoryAudioUploadUI(root);

        Dosya yoksa geri dön;

        const uploadPromise = uploadStoryAudioToR2(file)
          .then((publicUrl) => {
            setStoryAudioAsset({
              dosyaUrl: güvenliMetin(publicUrl),
              Yükleme Durumu: "hazır",
              Yükleme Hatası: "",
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            if (nextRoot) updateStoryAudioUploadUI(nextRoot);

            try { window.toast?.success?.("Müzik eklendi · +10 kredi"); } yakalamak {}
            console.log("[CARTOON][STORY_AUDIO_UPLOAD_OK]", publicUrl);
            publicUrl'yi döndür;
          })
          .catch((err) => {
            setStoryAudioAsset({
              dosya URL'si: "",
              Yükleme Durumu: "hata",
              Yükleme Hatası: String(err?.message || err || "story_audio_upload_failed"),
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            if (nextRoot) updateStoryAudioUploadUI(nextRoot);

            console.error("[CARTOON][STORY_AUDIO_UPLOAD_ERROR]", err);
            alert(String(err?.message || err || "story_audio_upload_failed"));
            hata fırlat;
          });

        setStoryAudioAsset({ uploadPromise });
        geri dönmek;
      }
      const characterFileInput = e.target.closest("[data-story-character-file]");
      if (characterFileInput && root.contains(characterFileInput)) {
        const slot = safeText(characterFileInput.dataset.storyCharacterFile);
        Eğer (!slot) ise geri dön;

        sabit dosya =
          karakterDosyaGirişi.dosyaları && karakterDosyaGirişi.dosyaları[0]
            ? karakterDosyaGirişi.dosyalar[0]
            : hükümsüz;

const slotConfig = STORY_CHARACTER_SLOT_CONFIG.find((config) => config.slot === slot);
const currentImageState = getStoryCharacterImage(slot);
const slotAlreadyUsedByUpload = !!(currentImageState && currentImageState.file);
const slotAlreadyHasLabel = !!safeText(slotConfig ? state[slotConfig.stateKey] : "");
const totalSelectedCount = getStorySelectedCharacterCount();

eğer (
  dosya &&
  yuva Yapılandırması &&
  !slotAlreadyUsedByUpload &&
  !slotAlreadyHasLabel &&
  ToplamSeçilenSayı >= HİKAYE_MAKS_TOPLAM_KARAKTER
) {
  characterFileInput.value = "";
  HikayeKarakteriSınırlıUyarısınıGöster();
  render(root);
  geri dönmek;
}

eğer (dosya ve slotConfig mevcut değilse) {
  const autoLabel = safeText(file.name)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  eğer (otoetiket) {
    durum[slotConfig.stateKey] = autoLabel;
  }
}

        setStoryCharacterImage(slot, {
          dosya,
          DosyaAdı: dosya ? dosya.adı : "",
          dosya URL'si: "",
          uploadPromise: null,
          YüklemeDurumu: dosya ? "yükleniyor" : "boşta",
          Yükleme Hatası: ""
        });

        updateStoryCharacterUploadUI(root, slot);
        render(root);

        const scene = getSceneById(state.editingSceneId);
        eğer (sahne) {
          renderSceneCharacterPicker(root, scene);
          syncSceneRows(root);
        }

        Dosya yoksa geri dön;

        const uploadPromise = uploadStoryCharacterReferenceToR2(file, slot)
          .then((publicUrl) => {
            setStoryCharacterImage(slot, {
              dosyaUrl: güvenliMetin(publicUrl),
              Yükleme Durumu: "hazır",
              Yükleme Hatası: "",
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            eğer (sonrakiKök) {
              updateStoryCharacterUploadUI(nextRoot, slot);

              const nextScene = getSceneById(state.editingSceneId);
              eğer (sonraki sahne) {
                renderSceneCharacterPicker(nextRoot, nextScene);
                syncSceneRows(nextRoot);
              }
            }

            console.log("[CARTOON][STORY_UPLOAD_OK]", slot, publicUrl);
            toastStoryCharacterAdded(slot);
            publicUrl'yi döndür;
          })
          .catch((err) => {
            setStoryCharacterImage(slot, {
              dosya URL'si: "",
              Yükleme Durumu: "hata",
              Yükleme Hatası: String(err?.message || err || "story_reference_upload_failed"),
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            eğer (sonrakiKök) {
              updateStoryCharacterUploadUI(nextRoot, slot);

              const nextScene = getSceneById(state.editingSceneId);
              eğer (sonraki sahne) {
                renderSceneCharacterPicker(nextRoot, nextScene);
                syncSceneRows(nextRoot);
              }
            }

            console.error("[CARTOON][STORY_UPLOAD_ERROR]", slot, err);
            alert(String(err?.message || err || "story_reference_upload_failed"));
            hata fırlat;
          });

        setStoryCharacterImage(slot, { uploadPromise });
        resetStoryPolicyUI(root);
        geri dönmek;
      }
    });
  }

  fonksiyon initFromDOM(root) {
    Eğer kök yoksa geri dön;

    const selectedMode = qs("[data-cartoon-mode].is-active", root);
    Eğer seçiliMod?.dataset.cartoonMode ise, durum.modu seçiliMod.dataset.cartoonMode'a eşitle;

    state.storyIdea = clampText(qs("[data-story-idea]", root)?.value, 5000);
    durum.tema = qs("[veri-hikayesi-teması]", kök)?.değer || "";
    durum.yaşgrubu = qs("[veri-hikayesi-yaş-grubu]", kök)?.değer || "";
    durum.akışSüresi = qs("[veri-hikayesi-akış-süresi]", kök)?.değer || "3";
    durum.süre = qs("[veri-hikayesi-süresi]", kök)?.değer || "180";
    state.mainCharacter = qs("[data-story-main-character]", root)?.value || "";
    state.helperCharacter1 = qs("[data-story-helper-1]", root)?.value || "";
    state.helperCharacter2 = qs("[data-story-helper-2]", root)?.value || "";
    durum.ekstraKarakter =
      qs("[data-story-helper-3]", root)?.value ||
      qs("[data-story-extra-character]", root)?.value ||
      "";
    durum.oran = qs("[veri-hikayesi-oranı]", kök)?.değer || "16:9";
    durum.stil = qs("[veri-hikayesi-stil]", kök)?.değer || "";
    state.audio = qs("[data-story-audio]", root)?.value || "none";
    state.includeMusic = qs("[data-story-include-music]", root)?.value || "no";
    state.logoPosition = qs("[data-story-logo-position]", root)?.value || "bottom-right";
    state.extraPrompt = clampText(qs("[data-story-extra-prompt]", root)?.value, 5000);

    durum.sahneler = varsayılan sahneler oluştur(durum.akışSüresi);

    const openSectionEl = qs("[data-story-section].is-open", root) || qs("[data-story-section]", root);
    if (openSectionEl?.dataset.storySection) {
      durum.açılışBölümü = açıkBölümEl.veri kümesi.hikayeBölümü;
    }

    const settingsBody = qs("[data-story-settings-body]", root);
    durum.ayarlarAçık = ayarlarGövdesi ? !ayarlarGövdesi.gizli : false;

    render(root);
  }

  fonksiyon syncAllStoryCharacterUploadUI(root) {
    STORY_CHARACTER_SLOT_CONFIG.forEach((config) => {
      updateStoryCharacterUploadUI(root, config.slot);
    });
  }

fonksiyon updateStoryCharacterUploadUI(root, slot) {
  const key = String(slot || "").trim();
  Eğer (anahtar yoksa) geri dön;

  const uploadBtn = qs(`[data-story-upload-trigger="${key}"]`, root);
  const nameEl = qs(`[data-story-upload-name="${key}"]`, root);
  const clearBtn = qs(`[data-story-upload-remove="${key}"]`, root);
  const imageState = getStoryCharacterImage(key);

  Eğer yükleme düğmesi (uploadBtn), isim düğmesi (nameEl), temizleme düğmesi (clearBtn) veya resim durumu (imageState) yoksa, geri dön.

  uploadBtn.hidden = false;

  eğer (!imageState.file) {
    nameEl.textContent = "Dosyanın seçimidi";
    clearBtt.style.display = "none";
    syncStoryGenerateButtonCredit(root);
    geri dönmek;
  }

  if (imageStatus.uploadStatus === "uploading") {
    nameEl.textContent = `${getShortFileName(imageState.fileName)} · Yükleniyor...`;
    clearBtt.style.display = "none";
    syncStoryGenerateButtonCredit(root);
    geri dönmek;
  }

  if (imageStatus.uploadStatus === "ready") {
    nameEl.textContent = getShortFileName(imageState.fileName);
    clearBtt.style.display = "inline-grid";
    syncStoryGenerateButtonCredit(root);
    geri dönmek;
  }

  if (imageStatus.uploadStatus === "error") {
    nameEl.textContent = `${getShortFileName(imageState.fileName)} · Hata`;
    clearBtt.style.display = "inline-grid";
    syncStoryGenerateButtonCredit(root);
    geri dönmek;
  }

  nameEl.textContent = getShortFileName(imageState.fileName) || "Dosyanın sadedi";
  clearBtt.style.display = "none";
  syncStoryGenerateButtonCredit(root);
}

  fonksiyon tryInit() {
    sabit kök = getCartoonRoot();
    Eğer kök yoksa false döndür;
    initFromDOM(root);
    true döndür;
  }

  bindClicks();
  bindInputs();
  bindChanges();

  eğer tryInit başlatılamazsa {
    sabit gözlemci = yeni MutationObserver(() => {
      Eğer tryInit() çalıştırılırsa, observer.disconnect();
    });

    gözlemci.gözlemle(belge.belgeÖğesi, {
      çocuk listesi: doğru,
      alt ağaç: doğru
    });
  }
})();
