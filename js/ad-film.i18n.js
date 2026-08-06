/* AIVO AI Reklam Filmi — unified TR/EN dictionary and dynamic UI bridge */
(function AIVO_AD_FILM_I18N(){
  "use strict";
  if(window.__AIVO_AD_FILM_I18N_V1__)return;
  window.__AIVO_AD_FILM_I18N_V1__=true;

  var PREFIX="studio.adfilm.";
  var PACK={
    tr:{
      "studio.tool.adfilm":"AI Reklam Filmi Oluştur",
      "studio.adfilm.kicker":"AIVO Creative Engine",
      "studio.adfilm.comingSoon":"YAKINDA",
      "studio.adfilm.title":"AI Reklam Filmi Oluştur",
      "studio.adfilm.subtitle":"Ürün görsellerini, seslendirmeyi, müziği ve sahneleri tek akışta birleştirerek kısa reklam filmleri oluştur.",
      "studio.adfilm.engineLabel":"Creative Engine",
      "studio.adfilm.engineStatus":"Proje buluta kaydedildi",
      "studio.adfilm.cloudSaved":"Proje buluta kaydedildi",
      "studio.adfilm.required":"Zorunlu",
      "studio.adfilm.optional":"İsteğe bağlı",
      "studio.adfilm.ready":"Hazır",
      "studio.adfilm.processing":"İşleniyor",
      "studio.adfilm.video":"video",
      "studio.adfilm.refs":"referans",
      "studio.adfilm.productInfo":"Ürün Bilgileri",
      "studio.adfilm.productInfoSub":"Marka ve kampanya briefini tanımla.",
      "studio.adfilm.productName":"Ürün / Hizmet Adı",
      "studio.adfilm.brandName":"Marka Adı",
      "studio.adfilm.description":"Kısa Açıklama",
      "studio.adfilm.productNamePlaceholder":"Örn: AIVO Studio",
      "studio.adfilm.brandNamePlaceholder":"Örn: AIVO",
      "studio.adfilm.descriptionPlaceholder":"Ürünün öne çıkan özelliklerini ve reklamda vurgulanmasını istediğin detayları yaz...",
      "studio.adfilm.plan.planTitle":"Reklam Planı",
      "studio.adfilm.plan.planSub":"Ana ürünü, reklam fikrini ve sahne akışını netleştir.",
      "studio.adfilm.plan.required":"Plan gerekli",
      "studio.adfilm.plan.autoMode":"AIVO tasarlasın",
      "studio.adfilm.plan.manualMode":"Sahneleri ben belirleyeceğim",
      "studio.adfilm.plan.conceptTitle":"Reklam yaklaşımı",
      "studio.adfilm.plan.conceptAuto":"Ürüne göre otomatik",
      "studio.adfilm.plan.conceptLifestyle":"Yaşam tarzı",
      "studio.adfilm.plan.conceptStudio":"Premium stüdyo",
      "studio.adfilm.plan.conceptPerformance":"Hareket / performans",
      "studio.adfilm.plan.conceptHint":"AIVO ürün bilgilerini, ana görseli ve seçtiğin yaklaşımı birleştirerek sahne planını hazırlayacak.",
      "studio.adfilm.plan.direction":"Reklam fikri ve yönetmen talimatı",
      "studio.adfilm.plan.directionOptional":"İsteğe bağlı",
      "studio.adfilm.plan.directionPlaceholder":"Örn: Ürün modern bir mutfakta sabah ışığında kullanılsın. Yakın plan detaylar, yumuşak kamera hareketleri ve güçlü bir final ürün çekimi olsun.",
      "studio.adfilm.plan.directionHint":"Mekânı, atmosferi, ürünün ne yapacağını ve görmek istediğin önemli anları yaz. Boş bırakırsan AIVO ürüne göre tasarlar.",
      "studio.adfilm.plan.scenesTitle":"5 sahnelik akış",
      "studio.adfilm.plan.scenesHint":"Kısa ve net yaz. Sahne görsellerini Akıllı Referans Yükleme bölümünde aynı sırayla ekleyebilirsin.",
      "studio.adfilm.plan.scene1":"Sahne 1 · Açılış",
      "studio.adfilm.plan.scene2":"Sahne 2 · Problem / ihtiyaç",
      "studio.adfilm.plan.scene3":"Sahne 3 · Ürün kullanımı",
      "studio.adfilm.plan.scene4":"Sahne 4 · Fayda / duygu",
      "studio.adfilm.plan.scene5":"Sahne 5 · Final ürün çekimi",
      "studio.adfilm.plan.scenePlaceholder":"Bu sahnede ne olsun?",
      "studio.adfilm.plan.mediaTitle":"Akıllı Referans Yükleme",
      "studio.adfilm.plan.mediaSub":"Ana ürünü ve sahne referanslarını görevlerine göre ayrı yükle.",
      "studio.adfilm.plan.hero":"Ana Ürün / Ana Karakter",
      "studio.adfilm.plan.heroHint":"Zorunlu · Her sahnede korunacak ana görsel",
      "studio.adfilm.plan.heroBadge":"@Image1",
      "studio.adfilm.plan.angles":"Ürünün Diğer Açıları",
      "studio.adfilm.plan.anglesHint":"En fazla 3 · Aynı ürünün farklı açıları",
      "studio.adfilm.plan.anglesBadge":"@Image2–4",
      "studio.adfilm.plan.scenes":"Sahne / Ortam Referansları",
      "studio.adfilm.plan.scenesUploadHint":"En fazla 5 · Sahne sırasına göre ekle",
      "studio.adfilm.plan.scenesBadge":"@Image5–9",
      "studio.adfilm.plan.logo":"Logo",
      "studio.adfilm.plan.logoHint":"Videoya sonradan temiz olarak eklenecek",
      "studio.adfilm.plan.logoBadge":"Overlay",
      "studio.adfilm.plan.mapHero":"Ana ürün sabit",
      "studio.adfilm.plan.mapAngles":"Ürün detayları",
      "studio.adfilm.plan.mapScenes":"Sahne ve atmosfer",
      "studio.adfilm.plan.mediaNote":"Seedance görselleri sırayla okuyacak: önce ana ürün, sonra ürün açıları, ardından sahne referansları.",
      "studio.adfilm.plan.mainTag":"ANA",
      "studio.adfilm.plan.angleTag":"AÇI",
      "studio.adfilm.plan.sceneTag":"SAHNE",
      "studio.adfilm.plan.maxHero":"Ana ürün için yalnızca 1 görsel seçebilirsin.",
      "studio.adfilm.plan.maxAngles":"En fazla 3 ürün açısı ekleyebilirsin.",
      "studio.adfilm.plan.maxScenes":"En fazla 5 sahne referansı ekleyebilirsin.",
      "studio.adfilm.plan.invalidImage":"Yalnızca JPG, PNG veya WEBP görsel kullan.",
      "studio.adfilm.plan.tooLarge":"Her görsel en fazla 12 MB olabilir.",
      "studio.adfilm.plan.remove":"Kaldır",
      "studio.adfilm.plan.restored":"Akıllı referans görsellerin bu cihazdan geri yüklendi.",
      "studio.adfilm.voiceNarration":"Ses & Anlatım",
      "studio.adfilm.voiceNarrationSub":"Dil, ses ve anlatım ayarları.",
      "studio.adfilm.voiceOn":"Açık",
      "studio.adfilm.voiceOff":"Kapalı",
      "studio.adfilm.narration.suggestion":"AIVO metin önerisi",
      "studio.adfilm.narration.self":"Metni kendim yazacağım",
      "studio.adfilm.narration.budget":"Ses süresi bütçesi",
      "studio.adfilm.narration.recommended":"{min}–{max} kelime önerilir",
      "studio.adfilm.narration.short":"Metin kısa; reklamda nefes, müzik veya sessiz vurgu alanı kalır.",
      "studio.adfilm.narration.language":"Dil",
      "studio.adfilm.narration.style":"Ses Stili",
      "studio.adfilm.narration.voice":"Ses",
      "studio.adfilm.narration.script":"Seslendirme Metni",
      "studio.adfilm.narration.scriptPlaceholder":"Reklamda okunacak metni yaz...",
      "studio.adfilm.narration.speed":"Hız",
      "studio.adfilm.narration.slow":"Yavaş",
      "studio.adfilm.narration.balanced":"Dengeli",
      "studio.adfilm.narration.fast":"Hızlı",
      "studio.adfilm.narration.flow":"Ses Akışı",
      "studio.adfilm.narration.natural":"Doğal",
      "studio.adfilm.narration.punctuated":"Vurgulu",
      "studio.adfilm.narration.autoBalance":"AIVO, seçilen video süresine göre konuşma temposunu ve metin uyumunu otomatik dengeler.",
      "studio.adfilm.narration.preview":"Ses Ön İzleme",
      "studio.adfilm.narration.previewSub":"Metni tamamladıktan sonra reklam sesini oluştur, dinle ve onayla.",
      "studio.adfilm.narration.notCreated":"Henüz ses oluşturulmadı.",
      "studio.adfilm.narration.create":"Sesi oluştur",
      "studio.adfilm.narration.regenerate":"Yeniden üret",
      "studio.adfilm.narration.approve":"Sesi onayla",
      "studio.adfilm.narration.approved":"Onaylandı",
      "studio.adfilm.narration.generating":"Üretiliyor…",
      "studio.adfilm.narration.processing":"Ses işleniyor. Kısa süre bekle.",
      "studio.adfilm.narration.ready":"Reklam sesi hazır. Dinleyip onaylayabilirsin.",
      "studio.adfilm.narration.readyToast":"Ses hazır. Dinleyip onaylayabilirsin.",
      "studio.adfilm.narration.approvedToast":"Ses onaylandı.",
      "studio.adfilm.narration.failed":"Ses hazırlanamadı. Tekrar deneyebilirsin.",
      "studio.adfilm.narration.projectMissing":"Bulut proje bağlantısı hazır değil.",
      "studio.adfilm.narration.approvalRequired":"Reklam filmini oluşturmadan önce sesi dinleyip onayla.",
      "studio.adfilm.narration.changed":"Seslendirme metni değişti. Sesi yeniden üretip onayla.",
      "studio.adfilm.narration.download":"Sesi indir",
      "studio.adfilm.narration.delete":"Sesi sil",
      "studio.adfilm.narration.deleteConfirm":"Bu reklam sesini silmek istiyor musun?",
      "studio.adfilm.narration.deleteFailed":"Reklam sesi silinemedi.",
      "studio.adfilm.narration.downloadFailed":"Reklam sesi indirilemedi.",
      "studio.adfilm.videoSettings":"Video Ayarları",
      "studio.adfilm.videoSettingsSub":"Yalnız süreyi ve yayın formatını seç.",
      "studio.adfilm.duration":"Süre",
      "studio.adfilm.format":"Format",
      "studio.adfilm.video.engine":"Seedance 2.0 · 4–15 saniye",
      "studio.adfilm.video.safeFrame":"4:5 seçildiğinde final video güvenli kadrajla hazırlanır.",
      "studio.adfilm.simple.advanced":"Gelişmiş Ayarlar",
      "studio.adfilm.simple.advancedSub":"İsteğe bağlı: reklam müziği ve çıkış kalitesi.",
      "studio.adfilm.simple.optional":"İsteğe bağlı",
      "studio.adfilm.simple.optionalEyebrow":"İSTEĞE BAĞLI",
      "studio.adfilm.simple.videoSettingsSub":"Yalnız süreyi ve yayın formatını seç.",
      "studio.adfilm.simple.mediaSimpleSub":"Ürün görsellerini ve logonu ekle.",
      "studio.adfilm.simple.musicTitle":"Reklam Müziği",
      "studio.adfilm.simple.musicSub":"Müziğin nasıl hazırlanacağını seç.",
      "studio.adfilm.simple.musicAuto":"AIVO müziği hazırlasın",
      "studio.adfilm.simple.musicUpload":"Kendi müziğim / jingle’ım",
      "studio.adfilm.simple.musicOff":"Müzik olmasın",
      "studio.adfilm.simple.chooseMusic":"Müzik veya jingle yükle",
      "studio.adfilm.simple.musicHint":"MP3, WAV, M4A, AAC veya OGG · En fazla 20 MB",
      "studio.adfilm.simple.musicRights":"Yüklediğin müziğin kullanım ve telif hakkına sahip olmalısın.",
      "studio.adfilm.simple.musicSelected":"Müzik dosyası seçildi.",
      "studio.adfilm.simple.musicRemoved":"Müzik dosyası kaldırıldı.",
      "studio.adfilm.simple.musicInvalid":"Desteklenen bir ses dosyası seç: MP3, WAV, M4A, AAC veya OGG.",
      "studio.adfilm.simple.musicTooLarge":"Müzik dosyası en fazla 20 MB olabilir.",
      "studio.adfilm.simple.noMusicFile":"Kendi müziğin seçili; dosyanı yüklemeyi unutma.",
      "studio.adfilm.simple.removeMusic":"Müzik dosyasını kaldır",
      "studio.adfilm.simple.playMusic":"Müziği oynat",
      "studio.adfilm.simple.pauseMusic":"Müziği duraklat",
      "studio.adfilm.musicStyle":"Müzik Tarzı",
      "studio.adfilm.energy":"Enerji",
      "studio.adfilm.musicSuggestion":"Öneri: {style} · {energy}",
      "studio.adfilm.musicEngine":"Stable Audio 3 Small",
      "studio.adfilm.music.preparing":"Reklam müziği hazırlanıyor…",
      "studio.adfilm.music.ready":"Reklam müziği hazır.",
      "studio.adfilm.music.failed":"Reklam müziği hazırlanamadı. Tekrar dene.",
      "studio.adfilm.outputQuality":"Çıkış Kalitesi",
      "studio.adfilm.outputQualitySub":"480p–4K çıktı kalitesini seç.",
      "studio.adfilm.quality":"Kalite",
      "studio.adfilm.premium":"PREMIUM",
      "studio.adfilm.qualityNote":"480p hızlı ön izleme, 720p standart, 1080p kaliteli final, 4K premium.",
      "studio.adfilm.build.title":"Reklam projesi hazırlanacak",
      "studio.adfilm.build.reset":"Taslağı sıfırla",
      "studio.adfilm.build.create":"Reklam Filmini Oluştur",
      "studio.adfilm.build.creditLater":"Kredi daha sonra belirlenecek",
      "studio.adfilm.build.ready":"Reklam stüdyosu üretime hazır.",
      "studio.adfilm.build.approval":"Reklam filmini oluşturmadan önce sesi dinleyip onayla.",
      "studio.adfilm.build.musicPreparing":"Reklam müziği hazırlanıyor…",
      "studio.adfilm.build.videoPreparing":"Reklam filmi hazırlanıyor",
      "studio.adfilm.build.processing":"İşleniyor",
      "studio.adfilm.build.mix":"Ses ve reklam müziği videoya miksleniyor…",
      "studio.adfilm.build.mixFailed":"Final ses miks işlemi tamamlanamadı. Yeniden denenecek.",
      "studio.adfilm.build.complete":"Reklam filmi hazır.",
      "studio.adfilm.build.failed":"Reklam filmi oluşturulamadı. Tekrar dene.",
      "studio.adfilm.build.estimate":"Tahmini süre: 720p 5 sn yaklaşık 6 dk · 1080p 15 sn yaklaşık 15 dk · 4K 15 sn yaklaşık 30 dk. Yoğunluğa göre değişebilir.",
      "studio.adfilm.panel.myVideos":"Reklam Videolarım",
      "studio.adfilm.panel.inProduction":"Yapım aşamasında",
      "studio.adfilm.panel.draft":"TASLAK",
      "studio.adfilm.panel.livePreview":"Canlı Ön İzleme",
      "studio.adfilm.panel.otherVersions":"Diğer Sürümler",
      "studio.adfilm.panel.adReady":"Reklamın hazır",
      "studio.adfilm.panel.adReadySub":"Videonu inceleyebilir veya aynı ürün bilgileriyle yeni bir sürüm hazırlayabilirsin.",
      "studio.adfilm.panel.newVersion":"Yeni Sürüm Oluştur",
      "studio.adfilm.panel.newProject":"Yeni Proje Oluştur",
      "studio.adfilm.panel.readyVideos":"Hazır Videolar",
      "studio.adfilm.panel.projectReadiness":"Proje Hazırlığı",
      "studio.adfilm.panel.productBrief":"Ürün briefi",
      "studio.adfilm.panel.productImages":"Ürün görselleri",
      "studio.adfilm.panel.outputSettings":"Çıktı ayarları",
      "studio.adfilm.panel.outputSummary":"Çıktı Özeti",
      "studio.adfilm.panel.narrated":"Sesli",
      "studio.adfilm.panel.silent":"Sessiz",
      "studio.adfilm.panel.motorLater":"Motor bağlantıları sonraki aşamada yapılacak.",
      "studio.adfilm.panel.version":"Sürüm",
      "studio.adfilm.panel.play":"Büyük oynatıcıda aç",
      "studio.adfilm.panel.download":"İndir",
      "studio.adfilm.panel.fullscreen":"Tam ekran",
      "studio.adfilm.panel.mute":"Sesi kapat",
      "studio.adfilm.panel.unmute":"Sesi aç",
      "studio.adfilm.panel.delete":"Sil",
      "studio.adfilm.panel.deleteConfirm":"Bu reklam sürümünü silmek istiyor musun?",
      "studio.adfilm.panel.deleteFailed":"Reklam sürümü silinemedi.",
      "studio.adfilm.panel.selectFailed":"Video seçilemedi.",
      "studio.adfilm.panel.downloadFailed":"Video indirilemedi.",
      "studio.adfilm.panel.fullscreenFailed":"Video tam ekran açılamadı.",
      "studio.adfilm.panel.deleted":"Video silindi.",
      "studio.adfilm.reset.confirm":"Bu reklam projesindeki tüm alanları ve yüklenen medyaları sıfırlamak istiyor musun?",
      "studio.adfilm.reset.success":"Reklam taslağı sıfırlandı.",
      "studio.adfilm.reset.failed":"Reklam taslağı sıfırlanamadı.",
      "studio.adfilm.project.saved":"Taslak kaydedildi",
      "studio.adfilm.project.restored":"Reklam projesi geri yüklendi.",
      "studio.adfilm.error.connection":"Bağlantı hatası. Tekrar dene.",
      "studio.adfilm.error.generic":"Beklenmeyen bir hata oluştu. Tekrar dene."
    },
    en:{
      "studio.tool.adfilm":"Create AI Ad Film",
      "studio.adfilm.kicker":"AIVO Creative Engine",
      "studio.adfilm.comingSoon":"COMING SOON",
      "studio.adfilm.title":"Create AI Ad Film",
      "studio.adfilm.subtitle":"Combine product images, narration, music and scenes in one flow to create short advertising films.",
      "studio.adfilm.engineLabel":"Creative Engine",
      "studio.adfilm.engineStatus":"Project saved to cloud",
      "studio.adfilm.cloudSaved":"Project saved to cloud",
      "studio.adfilm.required":"Required",
      "studio.adfilm.optional":"Optional",
      "studio.adfilm.ready":"Ready",
      "studio.adfilm.processing":"Processing",
      "studio.adfilm.video":"videos",
      "studio.adfilm.refs":"references",
      "studio.adfilm.productInfo":"Product Information",
      "studio.adfilm.productInfoSub":"Define the brand and campaign brief.",
      "studio.adfilm.productName":"Product / Service Name",
      "studio.adfilm.brandName":"Brand Name",
      "studio.adfilm.description":"Short Description",
      "studio.adfilm.productNamePlaceholder":"Example: AIVO Studio",
      "studio.adfilm.brandNamePlaceholder":"Example: AIVO",
      "studio.adfilm.descriptionPlaceholder":"Describe the product highlights and the details you want emphasized in the advertisement...",
      "studio.adfilm.plan.planTitle":"Advertising Plan",
      "studio.adfilm.plan.planSub":"Define the hero product, creative direction and scene flow.",
      "studio.adfilm.plan.required":"Plan required",
      "studio.adfilm.plan.autoMode":"Let AIVO design it",
      "studio.adfilm.plan.manualMode":"I will define the scenes",
      "studio.adfilm.plan.conceptTitle":"Advertising approach",
      "studio.adfilm.plan.conceptAuto":"Automatic for the product",
      "studio.adfilm.plan.conceptLifestyle":"Lifestyle",
      "studio.adfilm.plan.conceptStudio":"Premium studio",
      "studio.adfilm.plan.conceptPerformance":"Motion / performance",
      "studio.adfilm.plan.conceptHint":"AIVO will combine the product brief, hero image and selected approach to build the scene plan.",
      "studio.adfilm.plan.direction":"Advertising idea and director instructions",
      "studio.adfilm.plan.directionOptional":"Optional",
      "studio.adfilm.plan.directionPlaceholder":"Example: Use the product in a modern kitchen with soft morning light. Include detail close-ups, smooth camera motion and a strong final product shot.",
      "studio.adfilm.plan.directionHint":"Describe the location, atmosphere, what the product should do and the key moments you want. Leave it empty for AIVO to design automatically.",
      "studio.adfilm.plan.scenesTitle":"Five-scene flow",
      "studio.adfilm.plan.scenesHint":"Keep each scene clear and concise. Add scene reference images in the same order under Smart Reference Upload.",
      "studio.adfilm.plan.scene1":"Scene 1 · Opening",
      "studio.adfilm.plan.scene2":"Scene 2 · Problem / need",
      "studio.adfilm.plan.scene3":"Scene 3 · Product in use",
      "studio.adfilm.plan.scene4":"Scene 4 · Benefit / emotion",
      "studio.adfilm.plan.scene5":"Scene 5 · Final product shot",
      "studio.adfilm.plan.scenePlaceholder":"What should happen in this scene?",
      "studio.adfilm.plan.mediaTitle":"Smart Reference Upload",
      "studio.adfilm.plan.mediaSub":"Upload the hero product and scene references in separate roles.",
      "studio.adfilm.plan.hero":"Hero Product / Main Character",
      "studio.adfilm.plan.heroHint":"Required · The main visual preserved across scenes",
      "studio.adfilm.plan.heroBadge":"@Image1",
      "studio.adfilm.plan.angles":"Additional Product Angles",
      "studio.adfilm.plan.anglesHint":"Up to 3 · Different views of the same product",
      "studio.adfilm.plan.anglesBadge":"@Image2–4",
      "studio.adfilm.plan.scenes":"Scene / Environment References",
      "studio.adfilm.plan.scenesUploadHint":"Up to 5 · Add them in scene order",
      "studio.adfilm.plan.scenesBadge":"@Image5–9",
      "studio.adfilm.plan.logo":"Logo",
      "studio.adfilm.plan.logoHint":"Added cleanly after video generation",
      "studio.adfilm.plan.logoBadge":"Overlay",
      "studio.adfilm.plan.mapHero":"Hero product locked",
      "studio.adfilm.plan.mapAngles":"Product details",
      "studio.adfilm.plan.mapScenes":"Scenes and atmosphere",
      "studio.adfilm.plan.mediaNote":"Seedance will read references in order: hero product first, product angles next, then scene references.",
      "studio.adfilm.plan.mainTag":"HERO",
      "studio.adfilm.plan.angleTag":"ANGLE",
      "studio.adfilm.plan.sceneTag":"SCENE",
      "studio.adfilm.plan.maxHero":"Choose only one hero product image.",
      "studio.adfilm.plan.maxAngles":"You can add up to 3 product angles.",
      "studio.adfilm.plan.maxScenes":"You can add up to 5 scene references.",
      "studio.adfilm.plan.invalidImage":"Use JPG, PNG or WEBP images only.",
      "studio.adfilm.plan.tooLarge":"Each image can be up to 12 MB.",
      "studio.adfilm.plan.remove":"Remove",
      "studio.adfilm.plan.restored":"Your smart reference images were restored on this device.",
      "studio.adfilm.voiceNarration":"Voice & Narration",
      "studio.adfilm.voiceNarrationSub":"Language, voice and narration settings.",
      "studio.adfilm.voiceOn":"On",
      "studio.adfilm.voiceOff":"Off",
      "studio.adfilm.narration.suggestion":"AIVO script suggestion",
      "studio.adfilm.narration.self":"I will write the script",
      "studio.adfilm.narration.budget":"Voice duration budget",
      "studio.adfilm.narration.recommended":"{min}–{max} words recommended",
      "studio.adfilm.narration.short":"The script is short, leaving room for breathing, music or a silent emphasis.",
      "studio.adfilm.narration.language":"Language",
      "studio.adfilm.narration.style":"Voice Style",
      "studio.adfilm.narration.voice":"Voice",
      "studio.adfilm.narration.script":"Narration Script",
      "studio.adfilm.narration.scriptPlaceholder":"Write the script to be spoken in the advertisement...",
      "studio.adfilm.narration.speed":"Speed",
      "studio.adfilm.narration.slow":"Slow",
      "studio.adfilm.narration.balanced":"Balanced",
      "studio.adfilm.narration.fast":"Fast",
      "studio.adfilm.narration.flow":"Voice Flow",
      "studio.adfilm.narration.natural":"Natural",
      "studio.adfilm.narration.punctuated":"Emphatic",
      "studio.adfilm.narration.autoBalance":"AIVO automatically balances the speaking pace and script fit for the selected video duration.",
      "studio.adfilm.narration.preview":"Voice Preview",
      "studio.adfilm.narration.previewSub":"Create, preview and approve the advertising voice after completing the script.",
      "studio.adfilm.narration.notCreated":"No voice has been created yet.",
      "studio.adfilm.narration.create":"Create voice",
      "studio.adfilm.narration.regenerate":"Generate again",
      "studio.adfilm.narration.approve":"Approve voice",
      "studio.adfilm.narration.approved":"Approved",
      "studio.adfilm.narration.generating":"Generating…",
      "studio.adfilm.narration.processing":"Processing voice. Please wait briefly.",
      "studio.adfilm.narration.ready":"The advertising voice is ready. Preview and approve it.",
      "studio.adfilm.narration.readyToast":"Voice is ready. Preview and approve it.",
      "studio.adfilm.narration.approvedToast":"Voice approved.",
      "studio.adfilm.narration.failed":"The voice could not be prepared. You can try again.",
      "studio.adfilm.narration.projectMissing":"The cloud project connection is not ready.",
      "studio.adfilm.narration.approvalRequired":"Preview and approve the voice before creating the advertising film.",
      "studio.adfilm.narration.changed":"The narration script changed. Generate and approve the voice again.",
      "studio.adfilm.narration.download":"Download voice",
      "studio.adfilm.narration.delete":"Delete voice",
      "studio.adfilm.narration.deleteConfirm":"Delete this advertising voice?",
      "studio.adfilm.narration.deleteFailed":"The advertising voice could not be deleted.",
      "studio.adfilm.narration.downloadFailed":"The advertising voice could not be downloaded.",
      "studio.adfilm.videoSettings":"Video Settings",
      "studio.adfilm.videoSettingsSub":"Choose only the duration and publishing format.",
      "studio.adfilm.duration":"Duration",
      "studio.adfilm.format":"Format",
      "studio.adfilm.video.engine":"Seedance 2.0 · 4–15 seconds",
      "studio.adfilm.video.safeFrame":"When 4:5 is selected, the final video is prepared with safe framing.",
      "studio.adfilm.simple.advanced":"Advanced Settings",
      "studio.adfilm.simple.advancedSub":"Optional: advertising music and output quality.",
      "studio.adfilm.simple.optional":"Optional",
      "studio.adfilm.simple.optionalEyebrow":"OPTIONAL",
      "studio.adfilm.simple.videoSettingsSub":"Choose only the duration and publishing format.",
      "studio.adfilm.simple.mediaSimpleSub":"Add product images and your logo.",
      "studio.adfilm.simple.musicTitle":"Advertising Music",
      "studio.adfilm.simple.musicSub":"Choose how the music should be prepared.",
      "studio.adfilm.simple.musicAuto":"Let AIVO prepare the music",
      "studio.adfilm.simple.musicUpload":"My own music / jingle",
      "studio.adfilm.simple.musicOff":"No music",
      "studio.adfilm.simple.chooseMusic":"Upload music or jingle",
      "studio.adfilm.simple.musicHint":"MP3, WAV, M4A, AAC or OGG · Up to 20 MB",
      "studio.adfilm.simple.musicRights":"You must own or have permission to use the uploaded music.",
      "studio.adfilm.simple.musicSelected":"Music file selected.",
      "studio.adfilm.simple.musicRemoved":"Music file removed.",
      "studio.adfilm.simple.musicInvalid":"Choose a supported audio file: MP3, WAV, M4A, AAC or OGG.",
      "studio.adfilm.simple.musicTooLarge":"The music file can be up to 20 MB.",
      "studio.adfilm.simple.noMusicFile":"Your own music is selected; remember to upload the file.",
      "studio.adfilm.simple.removeMusic":"Remove music file",
      "studio.adfilm.simple.playMusic":"Play music",
      "studio.adfilm.simple.pauseMusic":"Pause music",
      "studio.adfilm.musicStyle":"Music Style",
      "studio.adfilm.energy":"Energy",
      "studio.adfilm.musicSuggestion":"Suggestion: {style} · {energy}",
      "studio.adfilm.musicEngine":"Stable Audio 3 Small",
      "studio.adfilm.music.preparing":"Preparing advertising music…",
      "studio.adfilm.music.ready":"Advertising music is ready.",
      "studio.adfilm.music.failed":"Advertising music could not be prepared. Try again.",
      "studio.adfilm.outputQuality":"Output Quality",
      "studio.adfilm.outputQualitySub":"Choose output quality from 480p to 4K.",
      "studio.adfilm.quality":"Quality",
      "studio.adfilm.premium":"PREMIUM",
      "studio.adfilm.qualityNote":"480p for a fast preview, 720p standard, 1080p high-quality final, 4K premium.",
      "studio.adfilm.build.title":"Advertising project will be prepared",
      "studio.adfilm.build.reset":"Reset draft",
      "studio.adfilm.build.create":"Create Advertising Film",
      "studio.adfilm.build.creditLater":"Credits will be determined later",
      "studio.adfilm.build.ready":"The advertising studio is ready to generate.",
      "studio.adfilm.build.approval":"Preview and approve the voice before creating the advertising film.",
      "studio.adfilm.build.musicPreparing":"Preparing advertising music…",
      "studio.adfilm.build.videoPreparing":"Advertising film is being prepared",
      "studio.adfilm.build.processing":"Processing",
      "studio.adfilm.build.mix":"Mixing voice and advertising music into the video…",
      "studio.adfilm.build.mixFailed":"The final audio mix could not be completed. It will be retried.",
      "studio.adfilm.build.complete":"Advertising film is ready.",
      "studio.adfilm.build.failed":"The advertising film could not be created. Try again.",
      "studio.adfilm.build.estimate":"Estimated time: 720p 5 sec about 6 min · 1080p 15 sec about 15 min · 4K 15 sec about 30 min. It may vary with demand.",
      "studio.adfilm.panel.myVideos":"My Advertising Videos",
      "studio.adfilm.panel.inProduction":"In production",
      "studio.adfilm.panel.draft":"DRAFT",
      "studio.adfilm.panel.livePreview":"Live Preview",
      "studio.adfilm.panel.otherVersions":"Other Versions",
      "studio.adfilm.panel.adReady":"Your advertisement is ready",
      "studio.adfilm.panel.adReadySub":"Review the video or create a new version with the same product information.",
      "studio.adfilm.panel.newVersion":"Create New Version",
      "studio.adfilm.panel.newProject":"Create New Project",
      "studio.adfilm.panel.readyVideos":"Ready Videos",
      "studio.adfilm.panel.projectReadiness":"Project Readiness",
      "studio.adfilm.panel.productBrief":"Product brief",
      "studio.adfilm.panel.productImages":"Product images",
      "studio.adfilm.panel.outputSettings":"Output settings",
      "studio.adfilm.panel.outputSummary":"Output Summary",
      "studio.adfilm.panel.narrated":"With narration",
      "studio.adfilm.panel.silent":"Silent",
      "studio.adfilm.panel.motorLater":"Engine connections will be completed in the next stage.",
      "studio.adfilm.panel.version":"Version",
      "studio.adfilm.panel.play":"Open in main player",
      "studio.adfilm.panel.download":"Download",
      "studio.adfilm.panel.fullscreen":"Fullscreen",
      "studio.adfilm.panel.mute":"Mute",
      "studio.adfilm.panel.unmute":"Unmute",
      "studio.adfilm.panel.delete":"Delete",
      "studio.adfilm.panel.deleteConfirm":"Delete this advertising version?",
      "studio.adfilm.panel.deleteFailed":"The advertising version could not be deleted.",
      "studio.adfilm.panel.selectFailed":"The video could not be selected.",
      "studio.adfilm.panel.downloadFailed":"The video could not be downloaded.",
      "studio.adfilm.panel.fullscreenFailed":"The video could not enter fullscreen.",
      "studio.adfilm.panel.deleted":"Video deleted.",
      "studio.adfilm.reset.confirm":"Reset all fields and uploaded media in this advertising project?",
      "studio.adfilm.reset.success":"Advertising draft reset.",
      "studio.adfilm.reset.failed":"The advertising draft could not be reset.",
      "studio.adfilm.project.saved":"Draft saved",
      "studio.adfilm.project.restored":"Advertising project restored.",
      "studio.adfilm.error.connection":"Connection error. Try again.",
      "studio.adfilm.error.generic":"An unexpected error occurred. Try again."
    }
  };

  var ATTR_KEY_MAP={
    "data-adfilm-i18n":function(v){return PREFIX+v},
    "data-plan-copy":function(v){return PREFIX+"plan."+v},
    "data-plan-placeholder":function(v){return PREFIX+"plan."+v},
    "data-simple-copy":function(v){return PREFIX+"simple."+v},
    "data-narration-copy":function(v){return PREFIX+"narration."+v},
    "data-narration-guide-copy":function(v){return PREFIX+"narration."+v},
    "data-output-copy":function(v){return PREFIX+"panel."+v},
    "data-project-copy":function(v){return PREFIX+"panel."+v}
  };
  var PLACEHOLDER_ATTRS={
    "data-adfilm-placeholder":function(v){return PREFIX+v},
    "data-plan-placeholder":function(v){return PREFIX+"plan."+v}
  };
  var reverse={tr:{},en:{}};
  var observer=null,frame=0,installTimer=null;

  function normalize(value){return String(value==null?"":value).replace(/\s+/g," ").trim()}
  function lang(){
    if(window.AIVO_STUDIO_I18N&&typeof window.AIVO_STUDIO_I18N.getLanguage==="function")return window.AIVO_STUDIO_I18N.getLanguage();
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function format(value,vars){
    var out=String(value==null?"":value),data=vars||{};
    Object.keys(data).forEach(function(key){out=out.replace(new RegExp("\\{"+key+"\\}","g"),String(data[key]))});
    return out;
  }
  function t(key,vars){
    var current=lang();
    if(window.AIVO_STUDIO_I18N&&typeof window.AIVO_STUDIO_I18N.t==="function"){
      var translated=window.AIVO_STUDIO_I18N.t(key,vars);
      if(translated&&translated!==key)return translated;
    }
    return format((PACK[current]&&PACK[current][key])||(PACK.tr&&PACK.tr[key])||key,vars);
  }
  function buildReverse(){
    ["tr","en"].forEach(function(language){
      Object.keys(PACK[language]).forEach(function(key){
        var value=normalize(PACK[language][key]);
        if(value&&value.indexOf("{")<0)reverse[language][value]=key;
      });
    });
  }
  function keyForExact(value){var clean=normalize(value);return reverse.tr[clean]||reverse.en[clean]||""}
  function translateDynamic(value){
    var source=normalize(value),current=lang(),match;
    if(!source)return value;
    var key=keyForExact(source);if(key)return t(key);
    match=source.match(/^(?:Sürüm|Version)\s+(\d+)$/i);if(match)return(current==="en"?"Version ":"Sürüm ")+match[1];
    match=source.match(/^(\d+)\s+(?:video|videos)$/i);if(match)return match[1]+" "+(current==="en"?(Number(match[1])===1?"video":"videos"):"video");
    match=source.match(/^(\d+)\s*\/\s*(\d+)\s+(?:referans|references)$/i);if(match)return match[1]+" / "+match[2]+" "+(current==="en"?"references":"referans");
    match=source.match(/^(\d+)\s+(?:kelime|words)\s*·\s*(?:tahmini|about)\s+(\d+)\s*(?:sn|sec|seconds)$/i);if(match)return current==="en"?match[1]+" words · about "+match[2]+" sec":match[1]+" kelime · tahmini "+match[2]+" sn";
    match=source.match(/^(\d+)\s*(?:sn|sec|seconds)$/i);if(match)return match[1]+(current==="en"?" sec":" sn");
    return value;
  }
  function translatePayload(payload){
    if(typeof payload==="string")return translateDynamic(payload);
    if(payload&&typeof payload==="object"&&typeof payload.message==="string"){var clone=Object.assign({},payload);clone.message=translateDynamic(payload.message);return clone}
    return payload;
  }
  function applyKeyed(root){
    Object.keys(ATTR_KEY_MAP).forEach(function(attr){
      var nodes=[];if(root.matches&&root.matches("["+attr+"]"))nodes.push(root);
      if(root.querySelectorAll)nodes=nodes.concat(Array.from(root.querySelectorAll("["+attr+"]")));
      nodes.forEach(function(node){var value=node.getAttribute(attr),key=ATTR_KEY_MAP[attr](value);if(PACK.tr[key]||PACK.en[key])node.textContent=t(key)});
    });
    Object.keys(PLACEHOLDER_ATTRS).forEach(function(attr){
      var nodes=[];if(root.matches&&root.matches("["+attr+"]"))nodes.push(root);
      if(root.querySelectorAll)nodes=nodes.concat(Array.from(root.querySelectorAll("["+attr+"]")));
      nodes.forEach(function(node){var key=PLACEHOLDER_ATTRS[attr](node.getAttribute(attr));if(PACK.tr[key]||PACK.en[key])node.setAttribute("placeholder",t(key))});
    });
  }
  function applyTextNodes(root){
    if(!document.createTreeWalker||!root)return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){
      var parent=node.parentElement;if(!parent)return NodeFilter.FILTER_REJECT;
      if(parent.closest("script,style,textarea,input,[contenteditable='true']"))return NodeFilter.FILTER_REJECT;
      return normalize(node.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }}),node;
    while((node=walker.nextNode())){
      var raw=node.nodeValue,clean=normalize(raw),translated=translateDynamic(clean);
      if(translated!==clean){var lead=(raw.match(/^\s*/)||[""])[0],tail=(raw.match(/\s*$/)||[""])[0];node.nodeValue=lead+translated+tail}
    }
  }
  function applyAttrs(root){
    var nodes=[root];if(root.querySelectorAll)nodes=nodes.concat(Array.from(root.querySelectorAll("[title],[aria-label],[alt],[placeholder]")));
    nodes.forEach(function(node){["title","aria-label","alt","placeholder"].forEach(function(attr){if(!node.getAttribute)return;var value=node.getAttribute(attr);if(!value)return;var translated=translateDynamic(value);if(translated!==value)node.setAttribute(attr,translated)})});
  }
  function roots(){return Array.from(document.querySelectorAll('[data-module-root][data-module="adfilm"],.rpPanelWrap[data-panel-key="adfilm"],[data-adfilm-video-modal],.adfilm-video-modal'))}
  function apply(root){var list=root?[root]:roots();list.forEach(function(scope){if(!scope||!scope.isConnected)return;applyKeyed(scope);applyTextNodes(scope);applyAttrs(scope)})}
  function schedule(root){cancelAnimationFrame(frame);frame=requestAnimationFrame(function(){frame=0;apply(root)});[60,180,500].forEach(function(delay){setTimeout(function(){apply(root)},delay)})}
  function register(){
    if(!window.AIVO_STUDIO_I18N||typeof window.AIVO_STUDIO_I18N.registerPack!=="function")return false;
    window.AIVO_STUDIO_I18N.registerPack(PACK);
    window.AIVOAdFilmI18n={pack:PACK,t:t,apply:apply,translateMessage:translateDynamic,language:lang};
    schedule();return true;
  }
  function installPack(){if(register()){clearInterval(installTimer);installTimer=null;return}if(!installTimer)installTimer=setInterval(register,50)}
  function wrapToast(){
    var toast=window.toast;if(!toast||toast.__aivoAdFilmI18n)return;
    ["success","error","warning","info"].forEach(function(type){var original=typeof toast[type]==="function"?toast[type].bind(toast):null;if(!original)return;toast[type]=function(payload,opts){return original(translatePayload(payload),opts)}});
    toast.__aivoAdFilmI18n=true;
    ["showToast","toastSafe","legacyToast","toastMsg"].forEach(function(name){var original=window[name];if(typeof original!=="function"||original.__aivoAdFilmI18n)return;var wrapped=function(message,type,opts){return original(translatePayload(message),type,opts)};wrapped.__aivoAdFilmI18n=true;window[name]=wrapped});
  }
  function wrapConfirm(){if(window.confirm.__aivoAdFilmI18n)return;var original=window.confirm.bind(window);var wrapped=function(message){return original(translateDynamic(message))};wrapped.__aivoAdFilmI18n=true;window.confirm=wrapped}
  function observe(){
    if(observer||!document.body||typeof MutationObserver==="undefined")return;
    observer=new MutationObserver(function(mutations){mutations.forEach(function(mutation){Array.from(mutation.addedNodes||[]).forEach(function(node){if(node.nodeType!==1)return;if(node.matches&&node.matches('[data-module="adfilm"],.rpPanelWrap[data-panel-key="adfilm"],[data-adfilm-video-modal]')||node.querySelector&&node.querySelector('[data-module="adfilm"],.rpPanelWrap[data-panel-key="adfilm"],[data-adfilm-video-modal]'))schedule(node)})})});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function onLanguage(){schedule();try{document.dispatchEvent(new CustomEvent("aivo:adfilm-language-change",{detail:{lang:lang()}}))}catch(_){} }

  buildReverse();installPack();wrapToast();wrapConfirm();observe();
  document.addEventListener("aivo:language-change",onLanguage);
  document.addEventListener("aivo:studio:i18n-applied",function(){schedule()});
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-project-sync",function(){schedule()});
  window.addEventListener("pageshow",function(){wrapToast();schedule()});
  setInterval(function(){wrapToast();if(roots().length)apply()},900);
})();
