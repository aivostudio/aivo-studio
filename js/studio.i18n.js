/* =========================================================
   AIVO DESKTOP STUDIO I18N
   - Extends /js/desktop.i18n.js
   - Türkçe / English
   - Supports dynamically loaded Studio modules
   - Keeps all Studio-specific strings in one dictionary
   ========================================================= */

(function AIVO_STUDIO_I18N() {
  "use strict";

  if (window.__AIVO_STUDIO_I18N__) return;
  window.__AIVO_STUDIO_I18N__ = true;

  var DEFAULT_LANG = "tr";
  var SUPPORTED_LANGS = ["tr", "en"];
  var MAX_INSTALL_ATTEMPTS = 240;

  var installAttempts = 0;
  var observer = null;
  var observerFrame = 0;
  var pendingRoots = [];

  var DICTIONARY = {
    tr: {
      /* =========================
         STUDIO / SEO
         ========================= */

      "studio.seoTitle":
        "AIVO Studio — AI Üretim Alanı",

      "studio.seoDescription":
        "AIVO Studio ile AI müzik, kapak, atmosfer video, çizgifilm, foto efekt, resimden video ve dudak senkron içerikleri üretin.",

      /* =========================
         STUDIO / SHELL
         ========================= */

      "studio.pageLabel":
        "AIVO Studio üretim alanı",

      "studio.sidebar.aiCreate":
        "AI Üret",

      "studio.sidebar.panels":
        "Paneller",

      "studio.sidebar.notes":
        "Kısa Notlar",

      "studio.tool.music":
        "AI Müzik Üret",

      "studio.tool.cover":
        "AI Kapak Üret",

      "studio.tool.atmo":
        "AI Atmosfer Video",

      "studio.tool.cartoon":
        "AI Çocuk Çizgifilm",

      "studio.tool.photofx":
        "AI Foto Efekt Video Clip",

      "studio.tool.video":
        "AI Resimden Video Üret",

      "studio.tool.lipsync":
        "AI Dudak Senkron Video",

      "studio.panel.profile":
        "Profil",

      "studio.panel.invoices":
        "Faturalarım",

      "studio.panel.buyCredits":
        "Kredi Satın Al",

      "studio.panel.settings":
        "Ayarlar",

      "studio.panel.logout":
        "Çıkış Yap",

      "studio.notes.retention":
        "Dosyalar sınırlı süre saklanır.",

      "studio.notes.deleted":
        "Silinen işler geri alınamaz.",

      "studio.notes.busy":
        "Yoğun saatlerde üretim süresi uzayabilir.",

      "studio.empty.title":
        "Henüz modül yüklenmedi",

      "studio.empty.description":
        "Sol menüden bir üretim aracı seçerek başlayın.",

      "studio.outputLabel":
        "Üretim sonuçları",

      "studio.loadingModule":
        "Modül yükleniyor...",

      "studio.moduleLoadFailed":
        "Modül yüklenemedi. Lütfen tekrar deneyin.",

      /* =========================
         GENERIC / TOAST
         ========================= */

      "studio.toast.success":
        "Başarılı",

      "studio.toast.error":
        "Hata",

      "studio.toast.warning":
        "Uyarı",

      "studio.toast.loading":
        "İşleniyor",

      "studio.toast.info":
        "Bilgi",

      "studio.toast.connectionError":
        "Bağlantı hatası. Lütfen tekrar deneyin.",

      "studio.toast.unexpectedError":
        "Beklenmeyen bir hata oluştu.",

      /* =========================
         MUSIC / FORM
         ========================= */

      "studio.music.title":
        "AI Müzik Üret",

      "studio.music.subtitle":
        "Ritim, vokal, mood ve tür seç — AIVO şarkıyı senin için oluştursun.",

      "studio.music.workMode.title":
        "Çalışma Modu",

      "studio.music.workMode.subtitle":
        "Hızlı başlangıç için Basit Mod, detaylı kontrol için Gelişmiş Mod.",

      "studio.music.mode.basic":
        "Basit Mod",

      "studio.music.mode.advanced":
        "Gelişmiş Mod",

      "studio.music.songName":
        "Şarkı Adı",

      "studio.music.songNamePlaceholder":
        "Örn: Kül Bahçesi, Midnight Drive...",

      "studio.music.prompt":
        "Ek Açıklama / Prompt",

      "studio.music.promptPlaceholder":
        "Müzikte özellikle vurgulamak istediğin detayları yaz...",

      "studio.music.lyrics":
        "Şarkı Sözleri (isteğe bağlı)",

      "studio.music.lyricsPlaceholder":
        "Şarkı sözlerini buraya yazın...",

      "studio.music.mood":
        "Mood / Tür",

      "studio.music.moodPlaceholder":
        "Mood / tür seç",

      "studio.music.mood.pop":
        "Pop, enerjik, Türkçe vokal",

      "studio.music.mood.rap":
        "Rap / Trap",

      "studio.music.mood.arabesk":
        "Arabesk / Duygusal",

      "studio.music.mood.slow":
        "Slow / Romantik",

      "studio.music.mood.electronic":
        "Elektronik / Dans",

      "studio.music.mood.rock":
        "Rock",

      "studio.music.vocalType":
        "Vokal Tipi",

      "studio.music.vocalPlaceholder":
        "Vokal tipini seç",

      "studio.music.vocal.male":
        "Erkek Vokal (AI)",

      "studio.music.vocal.female":
        "Kadın Vokal (AI)",

      "studio.music.vocal.instrumental":
        "Enstrümantal (Vokalsiz)",

      "studio.music.generate":
        "🎵 Müzik Üret",

      "studio.music.generateWithCredit":
        "🎵 Müzik Üret ({count} Kredi)",

      "studio.music.credit":
        "{count} Kredi",

      /* =========================
         MUSIC / DYNAMIC STATUS
         ========================= */

      "studio.music.status.preparing":
        "Müzik üretimi hazırlanıyor...",

      "studio.music.status.sending":
        "Üretim isteği gönderiliyor...",

      "studio.music.status.queued":
        "Üretim sıraya alındı.",

      "studio.music.status.processing":
        "Müzik üretiliyor...",

      "studio.music.status.ready":
        "Müzik hazır.",

      "studio.music.status.failed":
        "Müzik üretimi tamamlanamadı.",

      "studio.music.error.promptRequired":
        "Müzik üretmek için bir açıklama veya seçim girin.",

      "studio.music.error.songNameRequired":
        "Lütfen şarkı adını girin.",

      "studio.music.error.insufficientCredit":
        "Yetersiz kredi.",

      "studio.music.error.requestFailed":
        "Müzik üretimi başlatılamadı. Lütfen tekrar deneyin.",

      /* =========================
         MUSIC / RESULTS PANEL
         ========================= */

      "studio.music.panel.title":
        "Müziklerim",

      "studio.music.panel.retention":
        "Müzik dosyaları 14 gün saklanır.",

      "studio.music.panel.searchPlaceholder":
        "Müziklerde ara...",

      "studio.music.panel.empty":
        "Henüz müzik üretimi bulunmuyor.",

      "studio.music.panel.noResults":
        "Aramanızla eşleşen müzik bulunamadı.",

      "studio.music.panel.status.ready":
        "Hazır",

      "studio.music.panel.status.processing":
        "İşleniyor",

      "studio.music.panel.status.failed":
        "Hata",

      "studio.music.panel.untitled":
        "İsimsiz Müzik",

      "studio.music.action.play":
        "Oynat",

      "studio.music.action.pause":
        "Duraklat",

      "studio.music.action.details":
        "Detayları aç",

      "studio.music.action.download":
        "Müziği indir",

      "studio.music.action.lyrics":
        "Şarkı sözlerini aç",

      "studio.music.action.delete":
        "Müziği sil",

      "studio.music.delete.confirm":
        "Bu müziği silmek istediğinize emin misiniz?",

      "studio.music.delete.success":
        "Müzik silindi.",

      "studio.music.delete.failed":
        "Müzik silinemedi.",

           "studio.music.download.failed":
        "Müzik indirilemedi.",

      /* =========================
         COVER / FORM
         ========================= */

      "studio.cover.title":
        "Kapak / Görsel Üret",

      "studio.cover.subtitle":
        "Spotify, Apple Music ve YouTube için kapaklarını AI ile tasarla.",

      "studio.cover.beta":
        "BETA",

      "studio.cover.prompt":
        "Prompt",

      "studio.cover.promptPlaceholder":
        "Örn: Gece şehirde yürüyen gizemli kadın, neon ışıklar, sinematik atmosfer",

      "studio.cover.qualityLevel":
        "Kalite Seviyesi",

      "studio.cover.qualityArtist":
        "Artist",

      "studio.cover.qualityUltra":
        "Cinematic Ultra HD",

      "studio.cover.credit6":
        "6 Kredi",

      "studio.cover.credit9":
        "9 Kredi",

      "studio.cover.styleOptions":
        "Stil Seçenekleri",

      "studio.cover.styleRealistic":
        "Gerçekçi",

      "studio.cover.styleRealisticSub":
        "Stüdyo ışığında net, doğal ve yüksek detaylı kapaklar",

      "studio.cover.styleArtistic":
        "Sanatsal",

      "studio.cover.styleArtisticSub":
        "Doku, ışık ve derin renklerle eser hissi veren kompozisyonlar",

      "studio.cover.styleCartoon":
        "Çizgi Film",

      "studio.cover.styleCartoonSub":
        "Temiz hatlar, canlı tonlar ve karakter odaklı eğlenceli stil",

      "studio.cover.styleAbstract":
        "Soyut",

      "studio.cover.styleAbstractSub":
        "Geometrik formlar ve yumuşak geçişlerle modern konsept tasarım",

      "studio.cover.stylePhoto":
        "Fotoğrafik",

      "studio.cover.stylePhotoSub":
        "Sinematik ışık, alan derinliği ve premium fotoğraf estetiği",

      "studio.cover.styleAnime":
        "Anime",

      "studio.cover.styleAnimeSub":
        "Manga dokusu, yumuşak ışık ve temiz çizgilerle anime dili",

      "studio.cover.imageCount":
        "Görüntü Sayısı",

      "studio.cover.image1":
        "1 Görüntü",

      "studio.cover.image2":
        "2 Görüntü",

      "studio.cover.image4":
        "4 Görüntü",

      "studio.cover.aspectRatio":
        "En / Boy Oranı",

      "studio.cover.ratioSquare":
        "Kare (1:1)",

      "studio.cover.ratioVertical":
        "Dikey (9:16)",

      "studio.cover.ratioHorizontal":
        "Yatay (16:9)",

      "studio.cover.engineTitle":
        "AIVO Kapak Motoru",

      "studio.cover.requiredCredit":
        "Gerekli Kredi:",

      "studio.cover.engineDesc":
        "6 kredi ile 1 kapak üretilir. Kalite artırımı daha fazla kredi tüketebilir.",

      "studio.cover.generate6":
        "🖼️ Kapak Üret (6 Kredi)",

      "studio.cover.generate9":
        "🖼️ Kapak Üret (9 Kredi)",

          "studio.cover.generateWithCredit":
        "🖼️ Kapak Üret ({count} Kredi)",

      /* =========================
         ATMOSPHERE / HEADER & MODE
         ========================= */

      "studio.atmo.title":
        "AI Atmosfer Video",

      "studio.atmo.subtitle":
        "Klip çekemeyenler için: kar yağsın, yağmur aksın, ışık titresin — 4–15 sn sinematik atmosfer videoları üret.",

      "studio.atmo.modeLabel":
        "Mod Seçimi",

      "studio.atmo.mode.basic":
        "Basit Mod",

      "studio.atmo.mode.super":
        "Süper Mod ✨",

      /* =========================
         ATMOSPHERE / BASIC SCENES
         ========================= */

      "studio.atmo.scene.title":
        "Arka Mekan",

      "studio.atmo.scene.subtitle":
        "Hazır sahne seç veya kendi görselini yükle.",

      "studio.atmo.scene.winterCafe.title":
        "Kış Kafe",

      "studio.atmo.scene.winterCafe.desc":
        "Neon ışıklar, kar, sıcak vibe.",

      "studio.atmo.scene.cozyCabin.title":
        "Dağ Evi",

      "studio.atmo.scene.cozyCabin.desc":
        "Şömine, ahşap, cozy.",

      "studio.atmo.scene.lakeCabin.title":
        "Göl Kenarı",

      "studio.atmo.scene.lakeCabin.desc":
        "Sakin, sinematik yansıma.",

      "studio.atmo.scene.cityNight.title":
        "Şehir Gecesi",

      "studio.atmo.scene.cityNight.desc":
        "Bokeh, sokak lambaları.",

      "studio.atmo.scene.rainyWindow.title":
        "Yağmurlu Pencere Önü",

      "studio.atmo.scene.rainyWindow.desc":
        "Cam damlaları, loş ışık, duygusal hava.",

      "studio.atmo.scene.cityRooftop.title":
        "Gece Şehir Terası",

      "studio.atmo.scene.cityRooftop.desc":
        "Şehir ışıkları, hafif rüzgar, sinematik görünüm.",

      "studio.atmo.scene.oldStoneStreet.title":
        "Eski Taş Sokak",

      "studio.atmo.scene.oldStoneStreet.desc":
        "Islak zemin, sıcak lambalar, klip hissi.",

      "studio.atmo.scene.atticWindow.title":
        "Çatı Katı Pencere Önü",

      "studio.atmo.scene.atticWindow.desc":
        "İçeride sıcak ışık, dışarıda gece hissi.",

      "studio.atmo.scene.seaCliffs.title":
        "Deniz Kenarı Kayalıklar",

      "studio.atmo.scene.seaCliffs.desc":
        "Rüzgar, ufuk, özgür ve sinematik atmosfer.",

      "studio.atmo.scene.pineMountainRoad.title":
        "Çam Ağaçlı Dağ Yolu",

      "studio.atmo.scene.pineMountainRoad.desc":
        "Serin doğa, yol hissi, hafif yalnızlık.",

      "studio.atmo.scene.sunsetHighway.title":
        "Gün Batımı Otoyol Kenarı",

      "studio.atmo.scene.sunsetHighway.desc":
        "Ufuk çizgisi, yol, melankolik akış.",

      "studio.atmo.scene.dimMotelCorridor.title":
        "Loş Motel Koridoru",

      "studio.atmo.scene.dimMotelCorridor.desc":
        "Sessiz, sinematik ve güçlü yalnızlık hissi.",

      /* =========================
         ATMOSPHERE / BASIC EFFECTS
         ========================= */

      "studio.atmo.effects.title":
        "Atmosfer",

      "studio.atmo.effects.subtitle":
        "İstediğin kadar seç. Örn: Kar + Işık",

      "studio.atmo.effects.label":
        "Atmosfer Seçimleri",

      "studio.atmo.effects.snow":
        "❄️ Kar",

      "studio.atmo.effects.rain":
        "🌧️ Yağmur",

      "studio.atmo.effects.leaf":
        "🍃 Yaprak",

      "studio.atmo.effects.fog":
        "🌫️ Sis",

      "studio.atmo.effects.light":
        "✨ Işık",

      "studio.atmo.effects.fire":
        "🔥 Ateş",

      "studio.atmo.effects.wind":
        "🌬️ Rüzgar",

         "studio.atmo.duration":
        "Süre",

      "studio.atmo.duration.seconds":
        "{count} sn",

      "studio.atmo.duration.4":
        "4 sn",

      "studio.atmo.duration.6":
        "6 sn",

      "studio.atmo.duration.8":
        "8 sn",

      "studio.atmo.duration.10":
        "10 sn",

      "studio.atmo.duration.12":
        "12 sn",

      "studio.atmo.duration.15":
        "15 sn",

      /* =========================
         ATMOSPHERE / PERSONALIZATION
         ========================= */

      "studio.atmo.personalization.title":
        "Kişiselleştirme (opsiyonel)",

      "studio.atmo.personalization.subtitle":
        "Oran / logo / jingle ekleyebilirsin. Üret butonu burada.",

      "studio.atmo.aspectRatio":
        "Oran",

      "studio.atmo.opacity":
        "Opaklık",

      "studio.atmo.silentCopy":
        "Spotify Canvas için sessiz kopya üret",

      "studio.atmo.logo":
        "Logo",

      "studio.atmo.audio":
        "Müzik / Jingle",

      "studio.atmo.credit.plus10":
        "+10 Kredi",

      "studio.atmo.credit.free":
        "Ücretsiz",

      "studio.atmo.file.chooseLogo":
        "🏷️ Logo Seç",

      "studio.atmo.file.chooseAudio":
        "🎵 Audio Seç",

      "studio.atmo.file.chooseImage":
        "🏞️ Resim Seç",

      "studio.atmo.file.chooseProLogo":
        "🖼️ Logo Seç",

      "studio.atmo.file.notSelected":
        "Dosya seçilmedi",

      "studio.atmo.file.removeLogoLabel":
        "Yüklenen logoyu kaldır",

      "studio.atmo.file.removeLogoTitle":
        "Logoyu kaldır",

      "studio.atmo.file.removeAudioLabel":
        "Yüklenen audioyu kaldır",

      "studio.atmo.file.removeAudioTitle":
        "Audioyu kaldır",

      "studio.atmo.file.removeImageLabel":
        "Yüklenen resmi kaldır",

      "studio.atmo.file.removeImageTitle":
        "Resmi kaldır",

      "studio.atmo.logoPosition.topLeft":
        "Sol Üst",

      "studio.atmo.logoPosition.topRight":
        "Sağ Üst",

      "studio.atmo.logoPosition.bottomLeft":
        "Sol Alt",

      "studio.atmo.logoPosition.bottomRight":
        "Sağ Alt",

      "studio.atmo.logoPosition.centerSmall":
        "Ortada (küçük)",

      "studio.atmo.logoSize.small":
        "Küçük",

      "studio.atmo.logoSize.medium":
        "Orta",

      "studio.atmo.generate.basic":
        "🎬 Atmosfer Video Oluştur (30 Kredi)",

      "studio.atmo.generate.basicWithCredit":
        "🎬 Atmosfer Video Oluştur ({count} Kredi)",

      "studio.atmo.generate.super":
        "🎬 Süper Atmosfer Video Oluştur (45 Kredi)",

      "studio.atmo.generate.superWithCredit":
        "🎬 Süper Atmosfer Video Oluştur ({count} Kredi)",

      /* =========================
         ATMOSPHERE / SUPER PROMPT
         ========================= */

      "studio.atmo.super.description":
        "Sahne, kamera ve atmosferi tek cümlede anlat; referanslar yalnızca yön verir, birebir kopyalanmaz.",

      "studio.atmo.super.promptPlaceholder":
        "Örn: Gece neon şehir, mor-mavi tonlar, yavaş kamera, hafif sis, sinematik...",

      /* =========================
         ATMOSPHERE / SUPER STYLE
         ========================= */

      "studio.atmo.style.title":
        "Atmosfer Stili",

      "studio.atmo.style.subtitle":
        "Işık ve duygu tonunu seç.",

      "studio.atmo.light.title":
        "💡 Işık",

      "studio.atmo.light.warm":
        "💡 Sıcak",

      "studio.atmo.light.cool":
        "❄️ Soğuk",

      "studio.atmo.light.golden":
        "🌅 Golden Hour",

      "studio.atmo.light.neon":
        "🟣 Neon",

      "studio.atmo.light.moon":
        "🌙 Ay Işığı",

      "studio.atmo.mood.title":
        "🎭 Duygu",

      "studio.atmo.mood.romantic":
        "💜 Romantik",

      "studio.atmo.mood.cinematic":
        "🎬 Sinematik",

      "studio.atmo.mood.cozy":
        "🫶 Cozy",

      "studio.atmo.mood.mysterious":
        "🕯️ Gizemli",

      "studio.atmo.mood.lofi":
        "📼 Lo-fi",

      /* =========================
         ATMOSPHERE / EXPORT SETTINGS
         ========================= */

      "studio.atmo.export.title":
        "Export Ayarları",

      "studio.atmo.export.subtitle":
        "Oran ve süre seçimi.",

      "studio.atmo.export.preparationTime":
        "Hazırlık süresi eklenen medya ve süreye göre artabilir. Ortalama hazırlık: 5–10 dk.",

      "studio.atmo.export.aspect":
        "📐 Oran",

      "studio.atmo.export.aspectNote":
        "Referans görsel yüklendiğinde oran kompozisyona göre etkilenebilir.",

      "studio.atmo.export.duration":
        "⏱️ Süre",

      "studio.atmo.export.refImageNote":
        "<strong>Not:</strong> Referans görsel minimum 300×300 px olmalıdır.",

      /* =========================
         ATMOSPHERE / DETAIL EFFECTS
         ========================= */

      "studio.atmo.details.title":
        "Detay Efektler",

      "studio.atmo.details.subtitle":
        "Az ama premium (render sonrası düşük maliyet).",

      "studio.atmo.details.grain":
        "🎞️ Hafif Film Grain",

      "studio.atmo.details.glow":
        "✨ Bloom / Lens Glow",

      "studio.atmo.details.vignette":
        "🌑 Vignette",

      "studio.atmo.details.sharpen":
        "🔍 Hafif Sharpen",

      "studio.atmo.details.motionBlur":
        "🌀 Motion Blur (Az)",

      "studio.atmo.details.dust":
        "📽️ Film Dust / Scratch",

      "studio.atmo.lut.title":
        "🎨 Color Grade / LUT",

      "studio.atmo.lut.off":
        "Kapalı",

      "studio.atmo.lut.warm":
        "Sıcak",

      "studio.atmo.lut.cold":
        "Soğuk",

      "studio.atmo.lut.cinematic":
        "Sinematik",

      "studio.atmo.lut.lofi":
        "Lo-fi",

      /* =========================
         ATMOSPHERE / SUPER MEDIA
         ========================= */

      "studio.atmo.media.mainImage":
        "Ana Görsel",

      "studio.atmo.media.uploadAudio":
        "Audio Yükle",

      "studio.atmo.media.uploadLogo":
        "Logo Yükle",

      /* =========================
         ATMOSPHERE / UPLOAD STATUS
         ========================= */

      "studio.atmo.upload.ready":
        "Hazır ✓",

      "studio.atmo.upload.uploading":
        "Yükleniyor…",

      "studio.atmo.upload.error":
        "Hata",

      "studio.atmo.upload.failed":
        "Yükleme hatası",

      "studio.atmo.upload.logoFailed":
        "Logo yükleme hatası",

      "studio.atmo.upload.imageFailed":
        "Resim yükleme hatası",

      "studio.atmo.upload.audioFailed":
        "Audio yükleme hatası",

      /* =========================
         ATMOSPHERE / GENERATION STATUS
         ========================= */

      "studio.atmo.status.preparing":
        "Atmosfer videosu hazırlanıyor...",

      "studio.atmo.status.uploading":
        "Dosyalar yükleniyor...",

      "studio.atmo.status.sending":
        "Üretim isteği gönderiliyor...",

      "studio.atmo.status.queued":
        "Atmosfer videosu üretim sırasına alındı.",

      "studio.atmo.status.generating":
        "Atmosfer videosu oluşturuluyor...",

      "studio.atmo.status.ready":
        "Atmosfer videosu hazır.",

      "studio.atmo.status.failed":
        "Atmosfer videosu oluşturulamadı.",

      "studio.atmo.status.creditDeducted":
        "{count} kredi kullanıldı.",

      "studio.atmo.toast.started":
        "Atmosfer video üretimi başlatıldı.",

      "studio.atmo.toast.superStarted":
        "Süper Atmosfer video üretimi başlatıldı.",

      "studio.atmo.toast.ready":
        "Atmosfer videonuz hazır.",

      "studio.atmo.toast.failed":
        "Atmosfer video üretimi başarısız oldu.",

      /* =========================
         ATMOSPHERE / VALIDATION
         ========================= */

      "studio.atmo.error.sceneRequired":
        "Lütfen bir arka mekan seçin.",

      "studio.atmo.error.effectRequired":
        "Lütfen en az bir atmosfer efekti seçin.",

      "studio.atmo.error.promptRequired":
        "Lütfen sahne ve atmosferi açıklayan bir prompt girin.",

      "studio.atmo.error.insufficientCredit":
        "Yetersiz kredi.",

      "studio.atmo.error.uploadInProgress":
        "Dosya yükleme işleminin tamamlanmasını bekleyin.",

      "studio.atmo.error.uploadFailed":
        "Dosyalardan biri yüklenemedi. Lütfen tekrar deneyin.",

      "studio.atmo.error.refImageMinimum":
        "Referans görsel minimum 300×300 px olmalıdır.",

      "studio.atmo.error.invalidImage":
        "Lütfen geçerli bir görsel dosyası seçin.",

      "studio.atmo.error.invalidLogo":
        "Lütfen geçerli bir logo dosyası seçin.",

      "studio.atmo.error.invalidAudio":
        "Lütfen geçerli bir audio dosyası seçin.",

      "studio.atmo.error.requestFailed":
        "Atmosfer video üretimi başlatılamadı. Lütfen tekrar deneyin.",

      /* =========================
         ATMOSPHERE / RESULTS PANEL
         ========================= */

      "studio.atmo.panel.title":
        "Atmosfer Videolarım",

      "studio.atmo.panel.searchPlaceholder":
        "Atmosfer videolarında ara...",

      "studio.atmo.panel.empty":
        "Henüz atmosfer videosu bulunmuyor.",

      "studio.atmo.panel.noResults":
        "Aramanızla eşleşen atmosfer videosu bulunamadı.",

      "studio.atmo.panel.untitled":
        "İsimsiz Atmosfer Videosu",

      "studio.atmo.panel.status.ready":
        "Hazır",

      "studio.atmo.panel.status.preparing":
        "Hazırlanıyor",

      "studio.atmo.panel.status.processing":
        "İşleniyor",

      "studio.atmo.panel.status.failed":
        "Hata",

      "studio.atmo.action.open":
        "Videoyu aç",

      "studio.atmo.action.fullscreen":
        "Tam ekran aç",

      "studio.atmo.action.download":
        "Videoyu indir",

      "studio.atmo.action.delete":
        "Videoyu sil",

      "studio.atmo.action.audioOn":
        "Sesi aç",

      "studio.atmo.action.audioOff":
        "Sesi kapat",

      "studio.atmo.download.success":
        "Atmosfer videosu indirildi.",

      "studio.atmo.download.failed":
        "Atmosfer videosu indirilemedi.",

      "studio.atmo.delete.confirm":
        "Bu atmosfer videosunu silmek istediğinize emin misiniz?",

      "studio.atmo.delete.success":
        "Atmosfer videosu silindi.",

      "studio.atmo.delete.failed":
        "Atmosfer videosu silinemedi.",

         /* =========================
         CARTOON / TR
         ========================= */

      "studio.cartoon.title": "AI Çocuk Çizgifilm",
      "studio.cartoon.subtitle": "Preset karakterlerle kısa çizgifilm sahneleri üret.",
      "studio.cartoon.mode.label": "Mod Seçimi",
      "studio.cartoon.mode.character": "Karakter Yarat",
      "studio.cartoon.mode.basic": "Basit Mod",
      "studio.cartoon.mode.story": "Hikaye Modu ✨",
      "studio.cartoon.mode.studio": "Montaj Stüdyosu",

      "studio.cartoon.common.select": "Seçiniz",
      "studio.cartoon.common.none": "Yok",
      "studio.cartoon.common.yes": "Evet",
      "studio.cartoon.common.no": "Hayır",
      "studio.cartoon.common.on": "Açık",
      "studio.cartoon.common.off": "Kapalı",
      "studio.cartoon.common.optional": "(opsiyonel)",
      "studio.cartoon.common.noFile": "Dosya seçilmedi",
      "studio.cartoon.common.free": "Ücretsiz",
      "studio.cartoon.common.plus10Credits": "+10 Kredi",
      "studio.cartoon.common.chooseImage": "Resim Seç",
      "studio.cartoon.common.chooseAudio": "Audio Seç",
      "studio.cartoon.common.chooseLogo": "Logo Seç",
      "studio.cartoon.common.chooseVoice": "Ses Seç",
      "studio.cartoon.common.chooseVideos": "Videoları Seç",
      "studio.cartoon.common.removeImage": "Resmi kaldır",
      "studio.cartoon.common.removeImageLabel": "Yüklenen resmi kaldır",
      "studio.cartoon.common.removeAudio": "Sesi kaldır",
      "studio.cartoon.common.removeAudioLabel": "Yüklenen sesi kaldır",
      "studio.cartoon.common.removeLogo": "Logoyu kaldır",
      "studio.cartoon.common.removeLogoLabel": "Yüklenen logoyu kaldır",
      "studio.cartoon.common.removeMusic": "Müziği kaldır",
      "studio.cartoon.common.removeMusicLabel": "Yüklenen müziği kaldır",
      "studio.cartoon.common.ready": "Hazır",
      "studio.cartoon.common.uploading": "Yükleniyor…",
      "studio.cartoon.common.generating": "Üretiliyor…",
      "studio.cartoon.common.processing": "İşleniyor",
      "studio.cartoon.common.preparing": "Hazırlanıyor…",
      "studio.cartoon.common.failed": "Hata",
      "studio.cartoon.common.scene": "Sahne",
      "studio.cartoon.common.seconds": "{count} sn",
      "studio.cartoon.common.minutes": "{count} dk",
      "studio.cartoon.common.duration4": "4 sn",
      "studio.cartoon.common.duration6": "6 sn",
      "studio.cartoon.common.duration8": "8 sn",
      "studio.cartoon.common.duration10": "10 sn",
      "studio.cartoon.common.duration12": "12 sn",
      "studio.cartoon.common.duration15": "15 sn",
      "studio.cartoon.common.ratioWide": "Geniş (16:9)",
      "studio.cartoon.common.ratioSquare": "Kare (1:1)",
      "studio.cartoon.common.ratioVertical": "Dikey (9:16)",
      "studio.cartoon.common.positionBottomRight": "Sağ Alt",
      "studio.cartoon.common.positionBottomLeft": "Sol Alt",
      "studio.cartoon.common.positionTopRight": "Sağ Üst",
      "studio.cartoon.common.positionTopLeft": "Sol Üst",
      "studio.cartoon.common.positionCenter": "Orta",
      "studio.cartoon.common.styleCute3d": "Sevimli 3D",
      "studio.cartoon.common.styleSoftCartoon": "Yumuşak Çizgifilm",
      "studio.cartoon.common.stylePastel": "Pastel",
      "studio.cartoon.common.styleBrightKids": "Parlak Çocuk Stili",

      "studio.cartoon.character.title": "Karakter Yarat",
      "studio.cartoon.character.shortDescription": "Kısa Tanım",
      "studio.cartoon.character.descriptionPlaceholder": "Örn: sarı yağmurluklu sevimli küçük tavşan",
      "studio.cartoon.character.type": "Tür",
      "studio.cartoon.character.type.animal": "Hayvan",
      "studio.cartoon.character.type.human": "İnsan",
      "studio.cartoon.character.type.fantasy": "Fantastik",
      "studio.cartoon.character.type.object": "Nesne",
      "studio.cartoon.character.type.custom": "Serbest",
      "studio.cartoon.character.name": "Karakter Adı",
      "studio.cartoon.character.namePlaceholder": "Örn: Mini Tavşan",
      "studio.cartoon.character.style": "Stil",
      "studio.cartoon.character.uploadInstruction": "Kendi veya çocuğunun fotoğrafını yükle, çizgi film karakterine dönüştür.",
      "studio.cartoon.character.libraryTitle": "Karakterlerim",
      "studio.cartoon.character.libraryEmpty": "Henüz karakter yok",
      "studio.cartoon.character.advancedTitle": "Gelişmiş Özelleştirme",
      "studio.cartoon.character.hairType": "Saç Tipi",
      "studio.cartoon.character.hair.short": "Kısa",
      "studio.cartoon.character.hair.long": "Uzun",
      "studio.cartoon.character.hair.curly": "Kıvırcık",
      "studio.cartoon.character.hair.wavy": "Dalgalı",
      "studio.cartoon.character.hair.straight": "Düz",
      "studio.cartoon.character.hairColor": "Saç Rengi",
      "studio.cartoon.character.color.black": "Siyah",
      "studio.cartoon.character.color.brown": "Kahverengi",
      "studio.cartoon.character.color.blonde": "Sarı",
      "studio.cartoon.character.color.red": "Kızıl",
      "studio.cartoon.character.color.pink": "Pembe",
      "studio.cartoon.character.color.blue": "Mavi",
      "studio.cartoon.character.outfit": "Kıyafet",
      "studio.cartoon.character.outfit.dress": "Elbise",
      "studio.cartoon.character.outfit.tshirtShorts": "Tişört + Şort",
      "studio.cartoon.character.outfit.hoodie": "Kapüşonlu",
      "studio.cartoon.character.outfit.superhero": "Süper Kahraman",
      "studio.cartoon.character.outfit.princess": "Prenses",
      "studio.cartoon.character.outfit.school": "Okul Kıyafeti",
      "studio.cartoon.character.glasses": "Gözlük",
      "studio.cartoon.character.glasses.round": "Yuvarlak",
      "studio.cartoon.character.glasses.square": "Kare",
      "studio.cartoon.character.glasses.star": "Yıldız",
      "studio.cartoon.character.glasses.heart": "Kalp",
      "studio.cartoon.character.accessory": "Aksesuar",
      "studio.cartoon.character.accessory.hat": "Şapka",
      "studio.cartoon.character.accessory.bow": "Fiyonk",
      "studio.cartoon.character.accessory.bag": "Çanta",
      "studio.cartoon.character.accessory.wand": "Sihirli Değnek",
      "studio.cartoon.character.accessory.crown": "Taç",
      "studio.cartoon.character.expression": "Yüz İfadesi",
      "studio.cartoon.character.expression.happy": "Mutlu",
      "studio.cartoon.character.expression.excited": "Heyecanlı",
      "studio.cartoon.character.expression.cute": "Sevimli",
      "studio.cartoon.character.expression.calm": "Sakin",
      "studio.cartoon.character.expression.funny": "Komik",
    "studio.cartoon.character.generate": "🧩 Karakter Oluştur (20 Kredi)",
"studio.cartoon.character.generateWithCredit": "🧩 Karakter Oluştur ({count} Kredi)",
"studio.cartoon.character.generateShort": "🧩 Karakter Oluştur",
"studio.cartoon.character.generating": "Karakter Oluşturuluyor...",
"studio.cartoon.character.referenceUploading": "Referans görsel henüz yükleniyor.",
"studio.cartoon.character.referenceUploadFailed": "Görseli değiştir veya yeniden yükle.",

"studio.cartoon.basic.promptTitle": "Ek Prompt",
      "studio.cartoon.basic.promptPlaceholder": "Örn: mutlu görünsün, baloncuk olsun, yavaş hareket etsin",
      "studio.cartoon.basic.mainCharacter": "Ana Karakter",
      "studio.cartoon.basic.helperCharacters": "Yardımcı Karakterler",
      "studio.cartoon.basic.character.redFish": "Kırmızı Balık",
      "studio.cartoon.basic.character.chick": "Civciv",
      "studio.cartoon.basic.character.duck": "Ördek",
      "studio.cartoon.basic.character.smallFish": "Küçük Balıklar",
      "studio.cartoon.basic.character.frog": "Kurbağa",
      "studio.cartoon.basic.character.crab": "Yengeç",
      "studio.cartoon.basic.sceneTitle": "Sahne",
      "studio.cartoon.basic.scene.underwater": "Deniz Altı",
      "studio.cartoon.basic.scene.pond": "Gölet",
      "studio.cartoon.basic.scene.forest": "Orman",
      "studio.cartoon.basic.scene.farm": "Çiftlik",
      "studio.cartoon.basic.scene.sky": "Gökyüzü",
      "studio.cartoon.basic.scene.beach": "Plaj",
      "studio.cartoon.basic.actionTitle": "Aksiyon",
      "studio.cartoon.basic.action.swimming": "Yüzüyor",
      "studio.cartoon.basic.action.jumping": "Zıplıyor",
      "studio.cartoon.basic.action.playing": "Oynuyor",
      "studio.cartoon.basic.action.laughing": "Gülüyor",
      "studio.cartoon.basic.action.dancing": "Dans Ediyor",
      "studio.cartoon.basic.action.waving": "El Sallıyor",
      "studio.cartoon.basic.action.movingSlowly": "Yavaş İlerliyor",
      "studio.cartoon.basic.action.running": "Koşuyor",
      "studio.cartoon.basic.personalization": "Kişiselleştirme",
      "studio.cartoon.basic.duration": "Süre",
      "studio.cartoon.basic.aspectRatio": "En / Boy Oranı",
      "studio.cartoon.basic.logoPosition": "Logo Yönü",
      "studio.cartoon.basic.style": "Stil",
      "studio.cartoon.basic.uploadVoice": "Kendi Sesini Yükle",
      "studio.cartoon.basic.uploadLogo": "Logo Yükle",
      "studio.cartoon.basic.uploadCharacter": "Kendi Karakterini Koy",
      "studio.cartoon.basic.generate": "🎬 Sahneyi Oluştur (30 Kredi)",
      "studio.cartoon.basic.generateWithCredit": "🎬 Sahneyi Oluştur ({count} Kredi)",

      "studio.cartoon.story.summaryTitle": "Hikaye Özeti",
      "studio.cartoon.story.summaryHelper": "Önce hikayenin genel yapısını oluştur. Ardından sahnelere tıklayarak her sahneyi ayrı düzenle.",
      "studio.cartoon.story.idea": "Hikaye Fikri",
      "studio.cartoon.story.ideaPlaceholder": "Örn: Kırmızı balık kaybolan inciyi bulmak için arkadaşlarıyla ormanda ve gölette maceraya çıkar.",
      "studio.cartoon.story.theme": "Tema / Duygu",
      "studio.cartoon.story.theme.cheerful": "Neşeli",
      "studio.cartoon.story.theme.curious": "Meraklı",
      "studio.cartoon.story.theme.exciting": "Heyecanlı",
      "studio.cartoon.story.theme.emotional": "Duygusal",
      "studio.cartoon.story.theme.fun": "Eğlenceli",
      "studio.cartoon.story.ageGroup": "Yaş Grubu",
      "studio.cartoon.story.age3to5": "3-5 Yaş",
      "studio.cartoon.story.age5to7": "5-7 Yaş",
      "studio.cartoon.story.age7to9": "7-9 Yaş",
      "studio.cartoon.story.style": "Stil",
      "studio.cartoon.story.charactersTitle": "Karakterler",
      "studio.cartoon.story.charactersNote": "Hazır karakterleri ücretsiz kullanabilir, kendi özel karakterini ayrı alandan ekleyebilirsin.",
      "studio.cartoon.story.specialCharactersTitle": "Özel Karakterler (her seçim +10 Kredi)",
      "studio.cartoon.story.specialCharactersNote": "Kendi fotoğrafını, çocuğunun görselini veya özel referans karakterlerini buradan ekle.",
      "studio.cartoon.story.specialCharactersCreditNote": "Her seçim için 10 kredi kullanılır. En fazla 4 karakter ekleyebilirsin.",
      "studio.cartoon.story.specialCharactersMoreNote": "Daha fazlasını sahne açıklamasında yazabilirsin.",
      "studio.cartoon.story.specialCharactersSizeNote": "Her karakter görseli için maksimum yükleme boyutu 10 MB'dir.",
      "studio.cartoon.story.character.main": "Ana Karakter",
      "studio.cartoon.story.character.helper1": "Yardımcı Karakter 1",
      "studio.cartoon.story.character.helper2": "Yardımcı Karakter 2",
      "studio.cartoon.story.character.extra": "Ek Karakter",
      "studio.cartoon.story.characterLimit": "En fazla 4 karakter seçebilirsin",
      "studio.cartoon.story.flowTitle": "Hikaye Akışı",
      "studio.cartoon.story.flowHelper": "Film süresine göre önerilen sahne dağılımı otomatik hazırlanır.",
      "studio.cartoon.story.flowNote": "Minimum süre 3 dk ile başlar. Sahneleri ihtiyacınıza göre düzenleyebilirsiniz; tüm alanları doldurmanız gerekmez.",
      "studio.cartoon.story.filmDuration": "Film Süresi",
      "studio.cartoon.story.duration3": "3 dk · Önerilen",
      "studio.cartoon.story.duration4": "4 dk",
      "studio.cartoon.story.duration5": "5 dk",
      "studio.cartoon.story.duration6": "6 dk",
      "studio.cartoon.story.section.intro": "Giriş",
      "studio.cartoon.story.section.introSub": "Dünya, ana karakter ve hedef tanıtılır",
      "studio.cartoon.story.section.setup": "Kurulum",
      "studio.cartoon.story.section.setupSub": "Yardımcı unsur gelir, yolculuk başlar, ilk engel çıkar",
      "studio.cartoon.story.section.adventure": "Macera",
      "studio.cartoon.story.section.adventureSub": "Olaylar büyür, risk artar ve doruk noktasına ulaşılır",
      "studio.cartoon.story.section.final": "Final",
      "studio.cartoon.story.section.finalSub": "Çözüm, kapanış ve sıcak final",
      "studio.cartoon.story.sceneCount": "{count} Sahne",
      "studio.cartoon.story.sceneTitle": "Sahne {count} · {title}",
      "studio.cartoon.story.settingsTitle": "Üretim Ayarları",
      "studio.cartoon.story.settingsSub": "Oran, stil, logo ve müzik",
      "studio.cartoon.story.settingsTimeNote": "Süre uzadıkça ve logo, müzik, görsel eklendikçe hazırlık süresi artabilir. Video yaklaşık 5–10 dakikada hazır olur.",
      "studio.cartoon.story.aspectRatio": "En / Boy Oranı",
      "studio.cartoon.story.logoPosition": "Logo Yönü",
      "studio.cartoon.story.includeMusic": "Müziği Videoya Dahil Et",
      "studio.cartoon.story.uploadLogo": "Logo Yükle",
      "studio.cartoon.story.uploadMusic": "Müzik Yükle",
      "studio.cartoon.story.footerInfo": "{count} sahne · yaklaşık {minutes} dk · sahne başı ort. {seconds} sn",
      "studio.cartoon.story.generate": "🎬 Hikayeyi Oluştur (Başlangıç 30 Kredi)",
      "studio.cartoon.story.generateWithCredit": "🎬 Hikayeyi Oluştur ({count} Kredi)",
      "studio.cartoon.story.editorTitle": "Sahne Düzenle",
      "studio.cartoon.story.sceneHeading": "Sahne Başlığı",
      "studio.cartoon.story.sceneDescription": "Sahne Açıklaması",
      "studio.cartoon.story.sceneCharacters": "Sahnedeki Karakterler",
      "studio.cartoon.story.sceneCharacterEmpty": "Önce üst bölümden karakter seç.",
      "studio.cartoon.story.sceneDuration": "Süre",
      "studio.cartoon.story.sceneCreditNote": "Her +2 sn için +5 kredi eklenir.",
      "studio.cartoon.story.sceneCreditTotal": "Toplam harcanan: {count} Kredi",
      "studio.cartoon.story.sceneMood": "Sahne Duygusu",
      "studio.cartoon.story.sceneType": "Sahne Tipi",
      "studio.cartoon.story.sceneType.intro": "Giriş",
      "studio.cartoon.story.sceneType.dialogue": "Diyalog",
      "studio.cartoon.story.sceneType.action": "Aksiyon",
      "studio.cartoon.story.sceneType.transition": "Geçiş",
      "studio.cartoon.story.sceneType.final": "Final",
      "studio.cartoon.story.directorNote": "Ek Yönetmen Notu",
      "studio.cartoon.story.directorNotePlaceholder": "Örn: kamera soldan açılsın, karakter koşarak gelsin",
      "studio.cartoon.story.cancel": "İptal",
      "studio.cartoon.story.save": "Kaydet",

      "studio.cartoon.story.blueprint.worldOpening.title": "Dünya Açılışı",
      "studio.cartoon.story.blueprint.worldOpening.description": "Ortam ve genel atmosfer kurulur.",
      "studio.cartoon.story.blueprint.mainIntro.title": "Ana Karakter Tanıtımı",
      "studio.cartoon.story.blueprint.mainIntro.description": "Ana karakter ilk kez görünür.",
      "studio.cartoon.story.blueprint.goalAppears.title": "Hedefin Ortaya Çıkışı",
      "studio.cartoon.story.blueprint.goalAppears.description": "Karakterin amacı netleşir.",
      "studio.cartoon.story.blueprint.emotionalBond.title": "İlk Duygusal Bağ",
      "studio.cartoon.story.blueprint.emotionalBond.description": "Karakterin iç dünyası görünür olur.",
      "studio.cartoon.story.blueprint.curiosity.title": "Merak Kıvılcımı",
      "studio.cartoon.story.blueprint.curiosity.description": "Yeni bir soru veya merak doğar.",
      "studio.cartoon.story.blueprint.worldRule.title": "Dünyanın Kuralı",
      "studio.cartoon.story.blueprint.worldRule.description": "Hikayenin temel düzeni iyice hissedilir.",
      "studio.cartoon.story.blueprint.callToJourney.title": "Yola Çağrı",
      "studio.cartoon.story.blueprint.callToJourney.description": "Karakter harekete geçmeye hazırlanır.",
      "studio.cartoon.story.blueprint.helperArrives.title": "Yardımcı Unsur Gelir",
      "studio.cartoon.story.blueprint.helperArrives.description": "Yardımcı karakter veya unsur hikayeye dahil olur.",
      "studio.cartoon.story.blueprint.journeyBegins.title": "Yolculuk Başlar",
      "studio.cartoon.story.blueprint.journeyBegins.description": "Karakterler harekete geçer.",
      "studio.cartoon.story.blueprint.firstObstacle.title": "İlk Engel",
      "studio.cartoon.story.blueprint.firstObstacle.description": "İlk zorluk ortaya çıkar.",
      "studio.cartoon.story.blueprint.plan.title": "Plan Kurulur",
      "studio.cartoon.story.blueprint.plan.description": "Sorunu çözmek için ilk plan yapılır.",
      "studio.cartoon.story.blueprint.clue.title": "Yeni İpucu",
      "studio.cartoon.story.blueprint.clue.description": "Hedefe giden yolda yeni bir bilgi öğrenilir.",
      "studio.cartoon.story.blueprint.balanceBreaks.title": "Denge Bozulur",
      "studio.cartoon.story.blueprint.balanceBreaks.description": "Karakterlerin düzeni iyice değişir.",
      "studio.cartoon.story.blueprint.decision.title": "Karar Anı",
      "studio.cartoon.story.blueprint.decision.description": "Geri dönmek yerine devam etme kararı verilir.",
      "studio.cartoon.story.blueprint.adventureDeepens.title": "Macera Derinleşir",
      "studio.cartoon.story.blueprint.adventureDeepens.description": "Olaylar büyümeye başlar.",
      "studio.cartoon.story.blueprint.effort.title": "Deneme ve Çaba",
      "studio.cartoon.story.blueprint.effort.description": "Karakterler çözüm için yeni bir yol dener.",
      "studio.cartoon.story.blueprint.tension.title": "Gerilim Artar",
      "studio.cartoon.story.blueprint.tension.description": "Risk yükselir, baskı artar.",
      "studio.cartoon.story.blueprint.climax.title": "Doruk Noktası",
      "studio.cartoon.story.blueprint.climax.description": "En kritik karşılaşma yaşanır.",
      "studio.cartoon.story.blueprint.surprise.title": "Beklenmedik Sürpriz",
      "studio.cartoon.story.blueprint.surprise.description": "Plan dışı yeni bir gelişme olur.",
      "studio.cartoon.story.blueprint.teamwork.title": "Takım Ruhu",
      "studio.cartoon.story.blueprint.teamwork.description": "Karakterler birlikte hareket etmeyi öğrenir.",
      "studio.cartoon.story.blueprint.bigObstacle.title": "Büyük Engel",
      "studio.cartoon.story.blueprint.bigObstacle.description": "Daha güçlü bir zorluk kahramanların önüne çıkar.",
      "studio.cartoon.story.blueprint.lastPreparation.title": "Son Hazırlık",
      "studio.cartoon.story.blueprint.lastPreparation.description": "Final öncesi son hazırlıklar yapılır.",
      "studio.cartoon.story.blueprint.hopeReturns.title": "Umut Yeniden Doğar",
      "studio.cartoon.story.blueprint.hopeReturns.description": "Karakterler tekrar güç kazanır.",
      "studio.cartoon.story.blueprint.bigEncounter.title": "Büyük Karşılaşma",
      "studio.cartoon.story.blueprint.bigEncounter.description": "Hikayenin en yoğun anı yaşanır.",
      "studio.cartoon.story.blueprint.solution.title": "Çözüm",
      "studio.cartoon.story.blueprint.solution.description": "Sorun çözülür.",
      "studio.cartoon.story.blueprint.closing.title": "Kapanış",
      "studio.cartoon.story.blueprint.closing.description": "Hikaye sıcak bir final ile biter.",
      "studio.cartoon.story.blueprint.celebration.title": "Kutlama",
      "studio.cartoon.story.blueprint.celebration.description": "Karakterler başarıyı birlikte yaşar.",
      "studio.cartoon.story.blueprint.farewell.title": "Duygusal Veda",
      "studio.cartoon.story.blueprint.farewell.description": "Hikayenin duygusal etkisi tamamlanır.",
      "studio.cartoon.story.blueprint.newBalance.title": "Yeni Denge",
      "studio.cartoon.story.blueprint.newBalance.description": "Dünyada yeni bir düzen kurulmuş olur.",
      "studio.cartoon.story.blueprint.lastSmile.title": "Son Gülümseme",
      "studio.cartoon.story.blueprint.lastSmile.description": "İzleyiciye sıcak bir son an bırakılır.",

      "studio.cartoon.studio.combineTitle": "Sahneleri Birleştir",
      "studio.cartoon.studio.combineHelper1": "Final videoya girecek sahneleri seç ve sırala.",
      "studio.cartoon.studio.combineHelper2": "Yüklediğin her video ayrı sahne olarak listeye eklenecek.",
      "studio.cartoon.studio.uploadVideo": "Video Yükle",
      "studio.cartoon.studio.include": "Dahil",
      "studio.cartoon.studio.preview": "Önizleme",
      "studio.cartoon.studio.editTitle": "Başlığı düzenle",
      "studio.cartoon.studio.deleteScene": "Sahneyi sil",
      "studio.cartoon.studio.selectedScenes": "Seçilen Sahne: {count}",
      "studio.cartoon.studio.totalDuration": "Toplam Süre: {duration}",
      "studio.cartoon.studio.format": "Format: {format}",
      "studio.cartoon.studio.mediaTitle": "Ses Ekle/Logo Ekle",
      "studio.cartoon.studio.mediaHelper": "Kendi ses dosyanı yükleyip final videoya ekle.",
      "studio.cartoon.studio.uploadVoice": "Kendi Sesini Yükle",
      "studio.cartoon.studio.voice": "Ses",
      "studio.cartoon.studio.uploadLogo": "Logo Yükle",
      "studio.cartoon.studio.logoPosition": "Logo Yönü",
      "studio.cartoon.studio.export": "🎬 Patlat Çıktıyı Al (Video Başı 5 Kredi)",
      "studio.cartoon.studio.exportWithCredit": "🎬 Çıktıyı Al ({count} Kredi)",
      "studio.cartoon.studio.previewClose": "Önizlemeyi kapat",
      "studio.cartoon.studio.previewTitle": "Video Önizleme",

      "studio.cartoon.panel.title": "Çizgifilm Videolarım",
      "studio.cartoon.panel.searchPlaceholder": "Çizgifilm videolarında ara...",
      "studio.cartoon.panel.empty": "Henüz çizgifilm videosu bulunmuyor.",
      "studio.cartoon.panel.noResults": "Aramanızla eşleşen çizgifilm videosu bulunamadı.",
      "studio.cartoon.panel.status.ready": "Hazır",
      "studio.cartoon.panel.status.processing": "İşleniyor",
      "studio.cartoon.panel.status.failed": "Hata",
      "studio.cartoon.panel.preparing": "Hazırlanıyor…",
      "studio.cartoon.panel.action.play": "Oynat",
      "studio.cartoon.panel.action.pause": "Duraklat",
      "studio.cartoon.panel.action.download": "Videoyu indir",
      "studio.cartoon.panel.action.share": "Videoyu paylaş",
      "studio.cartoon.panel.action.fullscreen": "Tam ekran aç",
      "studio.cartoon.panel.action.delete": "Videoyu sil",
      "studio.cartoon.panel.action.audioOn": "Sesi aç",
      "studio.cartoon.panel.action.audioOff": "Sesi kapat",
      "studio.cartoon.panel.toast.ready": "Çizgifilm videonuz hazır.",
      "studio.cartoon.panel.download.success": "Çizgifilm videosu indirildi.",
      "studio.cartoon.panel.download.failed": "Çizgifilm videosu indirilemedi.",
      "studio.cartoon.panel.delete.confirm": "Bu çizgifilm videosunu silmek istediğinize emin misiniz?",
      "studio.cartoon.panel.delete.success": "Çizgifilm videosu silindi.",
      "studio.cartoon.panel.delete.failed": "Çizgifilm videosu silinemedi.",

   "studio.cartoon.toast.characterStarted": "Karakter oluşturma başlatıldı.",
"studio.cartoon.toast.characterReady": "Karakteriniz hazır.",
"studio.cartoon.toast.characterFailed": "Karakter oluşturulamadı.",
"studio.cartoon.toast.creditRefunded": "İşlem başarısız oldu, kredi iade edildi.",
"studio.cartoon.toast.basicStarted": "Çizgifilm sahnesi üretimi başlatıldı.",
      "studio.cartoon.toast.basicReady": "Çizgifilm sahneniz hazır.",
      "studio.cartoon.toast.basicFailed": "Çizgifilm sahnesi oluşturulamadı.",
      "studio.cartoon.toast.storyStarted": "Hikaye üretimi başlatıldı.",
      "studio.cartoon.toast.storyReady": "Hikayeniz hazır.",
      "studio.cartoon.toast.storyFailed": "Hikaye oluşturulamadı.",
      "studio.cartoon.toast.studioStarted": "Montaj işlemi başlatıldı.",
      "studio.cartoon.toast.studioReady": "Montaj videonuz hazır.",
      "studio.cartoon.toast.studioFailed": "Montaj videosu oluşturulamadı.",
      "studio.cartoon.toast.imageAdded": "Görsel eklendi.",
      "studio.cartoon.toast.imageRemoved": "Görsel kaldırıldı.",
      "studio.cartoon.toast.audioAdded": "Ses eklendi.",
      "studio.cartoon.toast.audioRemoved": "Ses kaldırıldı.",
      "studio.cartoon.toast.logoAdded": "Logo eklendi.",
      "studio.cartoon.toast.logoRemoved": "Logo kaldırıldı.",
      "studio.cartoon.toast.videosAdded": "{count} video eklendi.",

      "studio.cartoon.error.descriptionRequired": "Lütfen karakter için kısa bir tanım yazın.",
      "studio.cartoon.error.storyIdeaRequired": "Lütfen hikaye fikrini yazın.",
      "studio.cartoon.error.sceneRequired": "Lütfen bir sahne seçin.",
      "studio.cartoon.error.characterRequired": "Lütfen en az bir karakter seçin.",
      "studio.cartoon.error.videoRequired": "Lütfen en az bir video seçin.",
      "studio.cartoon.error.uploadInProgress": "Dosya yükleme işleminin tamamlanmasını bekleyin.",
      "studio.cartoon.error.uploadFailed": "Dosya yüklenemedi. Lütfen tekrar deneyin.",
      "studio.cartoon.error.invalidImage": "Lütfen geçerli bir görsel dosyası seçin.",
      "studio.cartoon.error.invalidAudio": "Lütfen geçerli bir ses dosyası seçin.",
      "studio.cartoon.error.invalidVideo": "Lütfen geçerli bir video dosyası seçin.",
      "studio.cartoon.error.insufficientCredit": "Yetersiz kredi.",
      "studio.cartoon.error.requestFailed": "Üretim başlatılamadı. Lütfen tekrar deneyin.",
         "studio.cartoon.error.mediaPolicyBlocked": "Bu dosya kullanılamaz.",

      /* =========================
         PHOTOFX / FORM
         ========================= */

      "studio.photofx.title": "AI Foto Efekt Video Clip",
      "studio.photofx.subtitle": "Tek fotoğrafını kısa, hareketli ve efektli sosyal medya klibine dönüştür.",

      "studio.photofx.promptHintTitle":
        "Sahneyi tarif et ya da fotoğrafını konuştur. Videoda ne görmek istiyorsan buraya yaz.",

      "studio.photofx.promptHintNote":
        "Mekânı, atmosferi, konuşmayı veya kısa hikâyeyi anlat; AIVO bunu videoya dönüştürsün.",

      "studio.photofx.promptPlaceholder":
        "Örn: Gece neon şehir, mor-mavi tonlar, yavaş kamera yaklaşması, hafif glow, sinematik geçişler, enerjik sosyal medya klibi",

      "studio.photofx.effectStyle.title": "Efekt Stili",
      "studio.photofx.effectStyle.subtitle":
        "İstersen ekstra efekt stili seçebilirsin. Seçim başına +5 kredi eklenir.",
      "studio.photofx.effectStyle.credit": "Tek seçim · +5 Kredi",

      /* =========================
         PHOTOFX / PRESETS
         ========================= */

      "studio.photofx.preset.neonPulse.title": "Neon Pulse",
      "studio.photofx.preset.neonPulse.description":
        "Neon çizgiler, ışık akışı ve hafif parlama ile ritmik enerji verir.",
      "studio.photofx.preset.neonPulse.use":
        "Kullanım: Gece, stil ve havalı portreler.",

      "studio.photofx.preset.shakeEdit.title": "Shake Edit",
      "studio.photofx.preset.shakeEdit.description":
        "Beat hissi veren mikro sarsıntı ve hızlı vurgu hareketleri üretir.",
      "studio.photofx.preset.shakeEdit.use":
        "Kullanım: Rap, trap ve sert edit videolar.",

      "studio.photofx.preset.glitchScan.title": "Glitch Scan",
      "studio.photofx.preset.glitchScan.description":
        "Dijital bozulma, RGB kayma ve kısa ekran kırılması hissi verir.",
      "studio.photofx.preset.glitchScan.use":
        "Kullanım: Karanlık, teknoloji ve agresif hava.",

      "studio.photofx.preset.splitFlash.title": "Split Flash",
      "studio.photofx.preset.splitFlash.description":
        "Görseli bölüp kısa flash geçişleriyle güçlü dikkat etkisi kurar.",
      "studio.photofx.preset.splitFlash.use":
        "Kullanım: Dikkat çekici Reels girişleri.",

      "studio.photofx.preset.cinematicZoom.title": "Cinematic Zoom",
      "studio.photofx.preset.cinematicZoom.description":
        "Yavaş yakınlaşma, sinematik pan ve hafif derinlik hissi oluşturur.",
      "studio.photofx.preset.cinematicZoom.use":
        "Kullanım: Duygusal, kaliteli ve ağır akan videolar.",

      "studio.photofx.preset.auraGlow.title": "Aura Glow",
      "studio.photofx.preset.auraGlow.description":
        "Kişinin etrafında enerji halkası ve yumuşak aura ışığı oluşturur.",
      "studio.photofx.preset.auraGlow.use":
        "Kullanım: Dreamy, estetik ve manevi editler.",

      "studio.photofx.preset.fireEdge.title": "Fire Edge",
      "studio.photofx.preset.fireEdge.description":
        "Kenarlar boyunca ateş ve sıcak ışık akışıyla güçlü etki verir.",
      "studio.photofx.preset.fireEdge.use":
        "Kullanım: Güçlü, öfkeli ve epik görünüm.",

      "studio.photofx.preset.darkTrapMotion.title": "Dark Trap Motion",
      "studio.photofx.preset.darkTrapMotion.description":
        "Karanlık kontrast, sert zoom ve düşük ışık edit dili uygular.",
      "studio.photofx.preset.darkTrapMotion.use":
        "Kullanım: Trap müzik ve sert profil videoları.",

      "studio.photofx.preset.smokeFog.title": "Smoke Fog",
      "studio.photofx.preset.smokeFog.description":
        "Yoğun sis, duman katmanı ve atmosferik pus hissiyle sahneyi daha gizemli yapar.",
      "studio.photofx.preset.smokeFog.use":
        "Kullanım: Karanlık sahne, sahne ışığı, gizemli ve sinematik videolar.",

      "studio.photofx.preset.festivalLaser.title": "Festival Laser",
      "studio.photofx.preset.festivalLaser.description":
        "Arkadan geçen büyük lazer ışıkları ve sahne enerjisiyle güçlü festival havası verir.",
      "studio.photofx.preset.festivalLaser.use":
        "Kullanım: Konser, DJ, sahne performansı ve enerjik sosyal medya klipleri.",

      /* =========================
         PHOTOFX / SETTINGS
         ========================= */

      "studio.photofx.settings.title": "Klip Ayarları",
      "studio.photofx.settings.subtitle":
        "Çıkış süresi, oran, çözünürlük, FPS ve efekt yoğunluğunu belirle.",
      "studio.photofx.settings.maxImageSize": "Maksimum görsel boyutu: 20 MB",

      "studio.photofx.field.mainImage": "Ana Görsel",
      "studio.photofx.field.audioUpload": "Audio Yükle",
      "studio.photofx.field.logoUpload": "Logo Yükle",
      "studio.photofx.field.logoPosition": "Logo Yönü",

      "studio.photofx.badge.free": "Ücretsiz",
      "studio.photofx.badge.plus10Credits": "+10 Kredi",
      "studio.photofx.badge.included": "Dahil",

      "studio.photofx.action.chooseImage": "Resim Seç",
      "studio.photofx.action.chooseAudio": "Audio Seç",
      "studio.photofx.action.chooseLogo": "Logo Seç",
      "studio.photofx.action.removeSelectedFile": "Seçili dosyayı kaldır",

      "studio.photofx.common.noFile": "Dosya seçilmedi",

      "studio.photofx.position.topLeft": "Sol Üst",
      "studio.photofx.position.topRight": "Sağ Üst",
      "studio.photofx.position.bottomLeft": "Sol Alt",
      "studio.photofx.position.bottomRight": "Sağ Alt",

      "studio.photofx.duration.label": "Klip Süresi",
      "studio.photofx.duration.6": "6 saniye",
      "studio.photofx.duration.8": "8 saniye",
      "studio.photofx.duration.10": "10 saniye",
      "studio.photofx.duration.12": "12 saniye",
      "studio.photofx.duration.14": "14 saniye",
      "studio.photofx.duration.16": "16 saniye",
      "studio.photofx.duration.18": "18 saniye",
      "studio.photofx.duration.20": "20 saniye",

      "studio.photofx.aspectRatio.label": "En / Boy Oranı",
      "studio.photofx.aspectRatio.auto": "Otomatik",
      "studio.photofx.aspectRatio.vertical": "Dikey (9:16)",
      "studio.photofx.aspectRatio.horizontal": "Yatay (16:9)",

      "studio.photofx.motion.label": "Hareket Seviyesi",
      "studio.photofx.motion.soft": "Yumuşak",
      "studio.photofx.motion.balanced": "Dengeli",
      "studio.photofx.motion.strong": "Güçlü",

      "studio.photofx.effectPower.label": "Efekt Gücü",
      "studio.photofx.effectPower.light": "Hafif",
      "studio.photofx.effectPower.medium": "Orta",
      "studio.photofx.effectPower.high": "Yüksek",

      "studio.photofx.colorMood.label": "Renk Havası",
      "studio.photofx.colorMood.original": "Orijinal",
      "studio.photofx.colorMood.cold": "Soğuk",
      "studio.photofx.colorMood.warm": "Sıcak",
      "studio.photofx.colorMood.neon": "Neon",
      "studio.photofx.colorMood.dark": "Karanlık",
      "studio.photofx.colorMood.cinematic": "Sinematik",

      "studio.photofx.transitionSpeed.label": "Geçiş Hızı",
      "studio.photofx.transitionSpeed.slow": "Yavaş",
      "studio.photofx.transitionSpeed.normal": "Normal",
      "studio.photofx.transitionSpeed.fast": "Hızlı",

      /* =========================
         PHOTOFX / ENGINE
         ========================= */

      "studio.photofx.engine.title": "AIVO Foto Efekt Motoru",
      "studio.photofx.engine.subtitle":
        "20 saniyelik ilk videolarda üretim süresi yoğunluğa bağlı olarak 5–10 dakika sürebilir. Lütfen işlem tamamlanana kadar bekleyin.",

      "studio.photofx.generate": "🎬 Klip Oluştur",
      "studio.photofx.generateWithCredit": "🎬 Klip Oluştur ({count} Kredi)",
      "studio.photofx.generating": "Üretiliyor...",

      /* =========================
         PHOTOFX / DYNAMIC
         ========================= */

      "studio.photofx.status.uploading": "Yükleniyor...",
      "studio.photofx.status.uploadFailed": "Yükleme hatası",
      "studio.photofx.status.fileUnavailable": "Bu dosya kullanılamaz",

      "studio.photofx.toast.imageAdded": "Resim eklendi.",
      "studio.photofx.toast.imageRemoved": "Resim kaldırıldı.",
      "studio.photofx.toast.logoAdded": "Logo eklendi · +10 kredi",
      "studio.photofx.toast.logoRemoved": "Logo kaldırıldı · -10 kredi",
      "studio.photofx.toast.audioAdded": "Müzik eklendi · +10 kredi",
      "studio.photofx.toast.audioRemoved": "Müzik kaldırıldı · -10 kredi",
      "studio.photofx.toast.presetSelected": "{name} seçildi · +5 kredi",
      "studio.photofx.toast.presetRemoved": "{name} kaldırıldı · -5 kredi",
      "studio.photofx.toast.videoPreparing": "Video hazırlanıyor.",
      "studio.photofx.toast.videoReady": "Video hazır.",
      "studio.photofx.toast.creditRefunded":
        "İşlem başarısız oldu, kredi iade edildi.",
      "studio.photofx.toast.generationFailed": "Klip oluşturma hatası.",

      /* =========================
         PHOTOFX / ERRORS
         ========================= */

      "studio.photofx.error.promptRequired": "Prompt yazmalısın.",
      "studio.photofx.error.imageRequired": "Lütfen bir ana görsel seç.",
      "studio.photofx.error.styleRequired":
        "Lütfen en az 1 efekt stili seç.",
      "studio.photofx.error.imageNotReady":
        "Ana görsel henüz hazır değil.",
      "studio.photofx.error.audioNotReady":
        "Müzik henüz hazır değil.",
      "studio.photofx.error.heicUnsupported":
        "HEIC desteklenmiyor · JPG veya PNG yükle.",
      "studio.photofx.error.mediaPolicyBlocked":
        "Bu görsel kullanılamaz.",
      "studio.photofx.error.uploadFailed":
        "Dosya yüklenemedi. Lütfen tekrar deneyin.",
      "studio.photofx.error.generationFailed":
        "Klip oluşturulamadı. Lütfen tekrar deneyin.",
      "studio.photofx.error.insufficientCredit": "Yetersiz kredi.",

      "studio.photofx.policy.blocked":
        "Gerçek sanatçı veya siyasi/kamu figürü adı kullanılamaz. İsim yerine efekti, geçişi ve görsel atmosferi tarif et.",

      /* =========================
         PHOTOFX / RESULTS PANEL
         ========================= */

      "studio.photofx.panel.title": "PhotoFX Kliplerim",
      "studio.photofx.panel.searchPlaceholder":
        "PhotoFX kliplerinde ara...",
      "studio.photofx.panel.empty":
        "Henüz PhotoFX klibi bulunmuyor.",
      "studio.photofx.panel.noResults":
        "Aramanızla eşleşen PhotoFX klibi bulunamadı.",
      "studio.photofx.panel.untitled": "İsimsiz PhotoFX Klip",

      "studio.photofx.panel.status.ready": "Hazır",
      "studio.photofx.panel.status.processing": "İşleniyor",
      "studio.photofx.panel.status.preparing": "Hazırlanıyor…",
      "studio.photofx.panel.status.failed": "Hata",

      "studio.photofx.panel.action.play": "Oynat",
      "studio.photofx.panel.action.pause": "Duraklat",
      "studio.photofx.panel.action.download": "Videoyu indir",
      "studio.photofx.panel.action.share": "Videoyu paylaş",
      "studio.photofx.panel.action.fullscreen": "Tam ekran aç",
      "studio.photofx.panel.action.delete": "Videoyu sil",
      "studio.photofx.panel.action.audioOn": "Sesi aç",
      "studio.photofx.panel.action.audioOff": "Sesi kapat",

      "studio.photofx.panel.download.success":
        "PhotoFX klibi indirildi.",
      "studio.photofx.panel.download.failed":
        "PhotoFX klibi indirilemedi.",

      "studio.photofx.panel.delete.confirm":
        "Bu PhotoFX klibini silmek istediğinize emin misiniz?",
      "studio.photofx.panel.delete.success":
        "PhotoFX klibi silindi.",
         "studio.photofx.panel.delete.failed":
        "PhotoFX klibi silinemedi.",

      /* =========================
         VIDEO / FORM
         ========================= */

      "studio.video.title":
        "AI Video Üret",

      "studio.video.subtitle":
        "Yazıdan veya görselden sinematik videolar oluştur.",

      "studio.video.settings.duration":
        "Süre",

      "studio.video.settings.resolution":
        "Çözünürlük",

      "studio.video.settings.aspectRatio":
        "En / Boy Oranı",

      "studio.video.duration.5":
        "5 Saniye",

      "studio.video.duration.8":
        "8 Saniye",

      "studio.video.duration.10":
        "10 Saniye",

      "studio.video.resolution.720":
        "720p HD",

      "studio.video.resolution.1080":
        "1080p Full HD",

      "studio.video.ratio.wide":
        "Geniş (16:9)",

      "studio.video.ratio.vertical":
        "Dikey (9:16)",

      /* =========================
         VIDEO / TABS
         ========================= */

      "studio.video.tab.text":
        "Yazıdan Video",

      "studio.video.tab.image":
        "Resimden Video",

      /* =========================
         VIDEO / TEXT TO VIDEO
         ========================= */

      "studio.video.text.title":
        "Video Açıklaması",

      "studio.video.text.maxCharacters":
        "Maksimum 1000 karakter",

      "studio.video.text.promptTip":
        "Örn: Gece neon şehir, mor-mavi tonlar, yavaş kamera hareketi, hafif sis, sinematik.",

      "studio.video.text.promptPlaceholder":
        "Video açıklaması (maksimum 1000 karakter)...",

      /* =========================
         VIDEO / IMAGE TO VIDEO
         ========================= */

      "studio.video.image.title":
        "Resim Yükle",

      "studio.video.image.fileFormats":
        "PNG / JPG – Maksimum 10 MB",

      "studio.video.image.uploadPrompt":
        "Resim seç veya sürükleyip bırak",

      "studio.video.image.maxSize":
        "PNG / JPG • Maksimum 10 MB",

      "studio.video.image.clearAria":
        "Yüklenen resmi kaldır",

      "studio.video.image.clearTitle":
        "Resmi kaldır",

      "studio.video.image.promptTip":
        "Örn: Kamera yaklaşsın, hafif paralaks ve ışık geçişleri olsun.",

      "studio.video.image.promptPlaceholder":
        "Resim nasıl canlansın? (isteğe bağlı)",

      /* =========================
         VIDEO / GENERATION
         ========================= */

      "studio.video.credit.withCount":
        "{count} Kredi",

      "studio.video.generate":
        "🎬 Video Oluştur",

      "studio.video.generateWithCredit":
        "🎬 Video Oluştur ({count} Kredi)",

      "studio.video.generating":
        "Üretiliyor...",

      /* =========================
         VIDEO / UPLOAD STATUS
         ========================= */

      "studio.video.upload.selected":
        "Seçildi: {name}{size}",

      "studio.video.upload.uploading":
        "Seçildi: {name}{size} · Yükleniyor...",

      "studio.video.upload.ready":
        "Seçildi: {name}{size} · Hazır ✓",

      "studio.video.upload.policyBlocked":
        "Seçildi: {name}{size} · Bu görsel kullanılamaz",

      "studio.video.upload.failed":
        "Seçildi: {name}{size} · Yükleme hatası",

      "studio.video.status.uploading":
        "Yükleniyor...",

      "studio.video.status.ready":
        "Hazır",

      "studio.video.status.uploadFailed":
        "Yükleme hatası",

      "studio.video.status.imageUnavailable":
        "Bu görsel kullanılamaz",

      /* =========================
         VIDEO / TOAST
         ========================= */

      "studio.video.toast.creditDeducted":
        "{count} kredi düşüldü.",

      "studio.video.toast.videoPreparing":
        "Video hazırlanıyor.",

      "studio.video.toast.videoReady":
        "Video hazır.",

      "studio.video.toast.creditRefunded":
        "İşlem başarısız oldu, kredi iade edildi.",

      "studio.video.toast.audioEnabled":
        "Ses üretimi açıldı · +5 kredi",

      "studio.video.toast.audioDisabled":
        "Ses üretimi kapatıldı · -5 kredi",

      "studio.video.toast.linkCopied":
        "Link kopyalandı.",

      /* =========================
         VIDEO / ERRORS
         ========================= */

      "studio.video.error.promptRequired":
        "Prompt yazmalısın.",

      "studio.video.error.imageRequired":
        "Resim seçmelisin.",

      "studio.video.error.imageUploading":
        "Görsel hâlâ yükleniyor.",

      "studio.video.error.imageUnavailable":
        "Bu görsel kullanılamaz.",

      "studio.video.error.uploadFailed":
        "Yükleme hatası.",

      "studio.video.error.generationFailed":
        "Video oluşturulamadı. Lütfen tekrar deneyin.",

      "studio.video.error.timeout":
        "Video oluşturma işlemi zaman aşımına uğradı.",

      "studio.video.error.insufficientCredit":
        "Yetersiz kredi.",

      "studio.video.policy.blocked":
        "Bu istek bu haliyle üretilemez. Lütfen sanatçı veya siyasi kişi adı kullanmadan video sahnesini ve aksiyonu tarif et.",

      /* =========================
         VIDEO / RESULTS PANEL
         ========================= */

      "studio.video.panel.title":
        "Videolarım",

      "studio.video.panel.searchPlaceholder":
        "Videolarda ara...",

      "studio.video.panel.empty":
        "Henüz video yok.",

      "studio.video.panel.noResults":
        "Aramana uygun video bulunamadı.",

      "studio.video.panel.dbUnavailable":
        "Video kayıtları yüklenemedi.",

      "studio.video.panel.untitled":
        "İsimsiz Video",

      "studio.video.panel.imageToVideo":
        "Resimden Video",

      "studio.video.panel.textToVideo":
        "Yazıdan Video",

      "studio.video.panel.status.ready":
        "Hazır",

      "studio.video.panel.status.processing":
        "İşleniyor",

      "studio.video.panel.status.preparing":
        "Hazırlanıyor…",

      "studio.video.panel.status.failed":
        "Hata",

      "studio.video.panel.action.play":
        "Oynat",

      "studio.video.panel.action.pause":
        "Duraklat",

      "studio.video.panel.action.download":
        "Videoyu indir",

      "studio.video.panel.action.share":
        "Videoyu paylaş",

      "studio.video.panel.action.fullscreen":
        "Tam ekran aç",

      "studio.video.panel.action.delete":
        "Videoyu sil",

      "studio.video.panel.action.audioOn":
        "Sesi aç",

      "studio.video.panel.action.audioOff":
        "Sesi kapat",

      "studio.video.panel.download.success":
        "Video indirildi.",

      "studio.video.panel.download.failed":
        "Video indirilemedi.",

      "studio.video.panel.delete.success":
        "Video silindi.",

      "studio.video.panel.delete.failed":
        "Video silinemedi.",

         "studio.video.panel.share.copied":
        "Video bağlantısı kopyalandı.",

      /* =========================
         LIPSYNC / FORM
         ========================= */

      "studio.lipsync.title":
        "AI Dudak Senkron Video",

      "studio.lipsync.subtitle":
        "Fotoğrafını yükle, metin yaz veya ses dosyası ekle. Kredi, tahmini konuşma süresine göre hesaplanır.",

      "studio.lipsync.speech.title":
        "Konuşma",

      "studio.lipsync.speech.subtitle":
        "Metin yaz veya hazır ses dosyası yükle.",

      "studio.lipsync.action.recordAudio":
        "Ses kaydet",

      "studio.lipsync.action.uploadAudio":
        "Hazır ses dosyası yükle",

      "studio.lipsync.script.placeholder":
        "Ne konuşturmak istiyorsun? Metni buraya yaz...",

      "studio.lipsync.audio.none":
        "Ses yüklenmedi.",

      /* =========================
         LIPSYNC / VOICES
         ========================= */

      "studio.lipsync.voice.tranquilTulin":
        "Ses: Tranquil Tülin",

      "studio.lipsync.voice.iker":
        "Ses: Iker",

      "studio.lipsync.voice.deepDieter":
        "Ses: Deep Dieter",

      "studio.lipsync.voice.william":
        "Ses: William Prescott",

      "studio.lipsync.voice.menon":
        "Ses: Menon",

      "studio.lipsync.voice.knox":
        "Ses: Knox",

      "studio.lipsync.voice.aaron":
        "Ses: Aaron",

      "studio.lipsync.voice.lily":
        "Ses: Lily",

      "studio.lipsync.voice.april":
        "Ses: April",

      "studio.lipsync.voice.tiffany":
        "Ses: Tiffany",

      "studio.lipsync.voice.brianna":
        "Ses: Brianna",

      "studio.lipsync.voice.evelyn":
        "Ses: Evelyn Harper",

      "studio.lipsync.voice.laurel":
        "Ses: Laurel",

      "studio.lipsync.voice.seena":
        "Ses: Seena Professional",

      "studio.lipsync.voice.preview":
        "Sesi dinle",

      "studio.lipsync.voice.previewUnavailable":
        "Bu ses için ön izleme bulunamadı.",

      "studio.lipsync.voice.previewFailed":
        "Ses ön izlemesi çalınamadı.",

      /* =========================
         LIPSYNC / PHOTO
         ========================= */

      "studio.lipsync.photo.title":
        "Fotoğraf yükle",

      "studio.lipsync.photo.requirements":
        "Yüz net görünmeli • JPG/PNG • En az 300×300 px",

      "studio.lipsync.photo.remove":
        "Fotoğrafı kaldır",

      "studio.lipsync.photo.defaultName":
        "Fotoğraf",

      /* =========================
         LIPSYNC / VOICE SETTINGS
         ========================= */

      "studio.lipsync.settings.title":
        "Ses Ayarları",

      "studio.lipsync.settings.subtitle":
        "Konuşma hızını ve ses seviyesini ayarla.",

      "studio.lipsync.settings.textOnly":
        "Sadece metin üretiminde geçerlidir.",

      "studio.lipsync.settings.speed":
        "Hız",

      "studio.lipsync.settings.speed.slow":
        "Yavaş",

      "studio.lipsync.settings.speed.normal":
        "Normal",

      "studio.lipsync.settings.speed.fast":
        "Hızlı",

      "studio.lipsync.settings.volume":
        "Ses Seviyesi",

      /* =========================
         LIPSYNC / CREDIT INFO
         ========================= */

      "studio.lipsync.credit.title":
        "Kredi ve Süre Bilgisi",

      "studio.lipsync.credit.rule":
        "Kredi, konuşma süresine göre hesaplanır. Her başlayan 2 sn = 3 kredi.",

      "studio.lipsync.credit.maximum":
        "Tek videoda maksimum 60 sn üretilebilir.",

      "studio.lipsync.estimate":
        "Tahmini: {seconds} sn • {credits} kredi",

      /* =========================
         LIPSYNC / GENERATION
         ========================= */

      "studio.lipsync.generate":
        "Dudak Senkron Video Üret",

      "studio.lipsync.generateWithCredit":
        "Dudak Senkron Video Üret ({count} Kredi)",

      "studio.lipsync.generationBlocked":
        "Üretim Engellendi",

      "studio.lipsync.status.photoUploading":
        "Fotoğraf yükleniyor...",

      "studio.lipsync.status.audioUploading":
        "Ses yükleniyor...",

      "studio.lipsync.status.videoPreparing":
        "Video hazırlanıyor...",

      /* =========================
         LIPSYNC / RECORD MODAL
         ========================= */

      "studio.lipsync.record.title":
        "Ses Kaydet",

      "studio.lipsync.record.tab.record":
        "Ses Kaydı",

      "studio.lipsync.record.tab.upload":
        "Ses Yükle",

      "studio.lipsync.record.description":
        "Bir ses kaydı oluştur. Karakterin bu sese göre dudak senkron yapacak.",

      "studio.lipsync.record.microphoneWaiting":
        "🎙 Mikrofon hazır bekleniyor...",

      "studio.lipsync.record.uploadTitle":
        "Ses dosyası yükle",

      "studio.lipsync.record.uploadDescription":
        "MP3, WAV veya WEBM dosyası seç",

      "studio.lipsync.record.audioWaiting":
        "Hazır ses dosyası bekleniyor...",

      "studio.lipsync.record.uploadedReady":
        "Yüklenen ses hazır",

      "studio.lipsync.record.recordedReady":
        "Kaydedilen ses hazır",

      "studio.lipsync.record.use":
        "Kullan",

      "studio.lipsync.record.listenAudio":
        "Sesi dinle",

      "studio.lipsync.record.listenRecording":
        "Kaydı dinle",

      "studio.lipsync.record.removeAudio":
        "Sesi sil",

      "studio.lipsync.record.removeRecording":
        "Kaydı sil",

      "studio.lipsync.record.preparing":
        "⏳ Kayıt hazırlanıyor...",

      "studio.lipsync.record.notFound":
        "Kayıt bulunamadı.",

      "studio.lipsync.record.selected":
        "Kayıt seçildi.",

      "studio.lipsync.record.audioReady":
        "🎧 Ses hazır: {name}",

      "studio.lipsync.record.recordingReady":
        "🎙 Kayıt hazır: {name}",

      "studio.lipsync.record.recording":
        "Kayıt alınıyor",

      "studio.lipsync.record.stopHint":
        "Durdurmak için tekrar bas",

      "studio.lipsync.record.recordingDevice":
        "🔴 Kayıt alınıyor... Durdurmak için tekrar bas.",

      "studio.lipsync.record.microphoneDenied":
        "Mikrofon izni alınamadı.",

      /* =========================
         LIPSYNC / TOASTS
         ========================= */

      "studio.lipsync.toast.maximumDuration":
        "Maksimum konuşma süresi 60 saniye olabilir.",

      "studio.lipsync.toast.audioSelected":
        "Ses dosyası seçildi.",

      "studio.lipsync.toast.recordSelected":
        "Kayıt seçildi.",

      "studio.lipsync.toast.audioRemoved":
        "Ses kaldırıldı.",

      "studio.lipsync.toast.audioPlayFailed":
        "Ses çalınamadı.",

      "studio.lipsync.toast.audioNotFound":
        "Dinlenecek ses bulunamadı.",

      "studio.lipsync.toast.microphoneDenied":
        "Mikrofon izni alınamadı.",

      "studio.lipsync.toast.creditDeducted":
        "{count} kredi düşüldü.",

      "studio.lipsync.toast.videoPreparing":
        "Video hazırlanıyor...",

      "studio.lipsync.toast.videoReady":
        "Dudak senkron videosu hazır.",

      "studio.lipsync.toast.creditRefunded":
        "İşlem başarısız oldu, kredi iade edildi.",

      "studio.lipsync.toast.generationFailed":
        "Dudak senkron üretimi başarısız oldu.",

      "studio.lipsync.toast.timeout":
        "Dudak senkron üretimi zaman aşımına uğradı.",

      /* =========================
         LIPSYNC / ERRORS
         ========================= */

      "studio.lipsync.error.badLanguage":
        "Bu metin uygunsuz dil içerdiği için üretim başlatılamadı. Lütfen küfür, hakaret veya nefret söylemi içermeyen bir metin girin.",

      "studio.lipsync.error.speechOrAudioRequired":
        "Konuşma metni yazmalısın veya ses dosyası seçmelisin.",

      "studio.lipsync.error.contentTooLong":
        "Bu içerik yaklaşık {seconds} saniye sürer. Maksimum süre 60 saniye.",

      "studio.lipsync.error.scriptTooLong":
        "Bu metin seçilen süre için çok uzun. Lütfen daha kısa yaz veya daha uzun süre seç.",

      "studio.lipsync.error.photoRequired":
        "Fotoğraf yüklemelisin.",

      "studio.lipsync.error.photoUploadFailed":
        "Fotoğraf yüklenemedi.",

      "studio.lipsync.error.audioUploadFailed":
        "Ses dosyası yüklenemedi.",

      "studio.lipsync.error.mediaPolicyBlocked":
        "Bu görsel kullanılamaz.",

      "studio.lipsync.error.insufficientCredit":
        "Yetersiz kredi.",

      "studio.lipsync.error.policyGenerationFailed":
        "Bu metin uygunsuz dil içerdiği için video üretilemedi.",

      "studio.lipsync.error.generationFailed":
        "Video oluşturulamadı. Lütfen metni veya içeriği kontrol edip tekrar deneyin.",

      /* =========================
         LIPSYNC / RESULTS PANEL
         ========================= */

      "studio.lipsync.panel.title":
        "Dudak Senkron Videolarım",

      "studio.lipsync.panel.meta.preparing":
        "Hazırlanıyor",

      "studio.lipsync.panel.searchPlaceholder":
        "Dudak senkron videolarda ara...",

      "studio.lipsync.panel.empty":
        "Henüz dudak senkron videosu yok.",

      "studio.lipsync.panel.noResults":
        "Aramanızla eşleşen dudak senkron videosu bulunamadı.",

      "studio.lipsync.panel.audioTitle":
        "Ses: {name}",

      "studio.lipsync.panel.defaultTitle":
        "Dudak Senkron Video",

      "studio.lipsync.panel.status.ready":
        "Hazır",

      "studio.lipsync.panel.status.processing":
        "İşleniyor",

      "studio.lipsync.panel.status.preparing":
        "Hazırlanıyor…",

      "studio.lipsync.panel.status.failed":
        "Hata",

      "studio.lipsync.panel.action.play":
        "Oynat",

      "studio.lipsync.panel.action.pause":
        "Duraklat",

      "studio.lipsync.panel.action.download":
        "Videoyu indir",

      "studio.lipsync.panel.action.share":
        "Videoyu paylaş",

      "studio.lipsync.panel.action.fullscreen":
        "Tam ekran aç",

      "studio.lipsync.panel.action.delete":
        "Videoyu sil",

      "studio.lipsync.panel.action.audioOn":
        "Sesi aç",

      "studio.lipsync.panel.action.audioOff":
        "Sesi kapat",

      "studio.lipsync.panel.download.success":
        "Dudak senkron videosu indirildi.",

      "studio.lipsync.panel.download.failed":
        "Dudak senkron videosu indirilemedi.",

      "studio.lipsync.panel.share.copied":
        "Dudak senkron video bağlantısı kopyalandı.",

      "studio.lipsync.panel.delete.success":
        "Dudak senkron videosu silindi.",

        "studio.lipsync.panel.delete.failed":
        "Dudak senkron videosu silinemedi.",

      /* =========================
         PROFILE / PAGE
         ========================= */

      "studio.profile.title":
        "Profil",

      "studio.profile.subtitle":
        "Hesap bilgilerin, planın ve kullanım detayların burada yer alır.",

      "studio.profile.action.buyCredits":
        "Kredi Satın Al",

      "studio.profile.action.upgradePlan":
        "Planı Yükselt",

      /* =========================
         PROFILE / INFORMATION
         ========================= */

      "studio.profile.info.title":
        "Profil Bilgileri",

      "studio.profile.info.subtitle":
        "Kişisel hesap bilgilerin",

      "studio.profile.field.name":
        "Ad",

      "studio.profile.field.namePlaceholder":
        "Adın",

      "studio.profile.field.surname":
        "Soyad",

      "studio.profile.field.surnamePlaceholder":
        "Soyadın",

      "studio.profile.field.email":
        "E-posta",

      "studio.profile.field.emailLocked":
        "Güvenlik nedeniyle e-posta adresi değiştirilemez.",

      "studio.profile.action.save":
        "Profili Güncelle",

      /* =========================
         PROFILE / SECURITY
         ========================= */

      "studio.profile.security.title":
        "Güvenlik",

      "studio.profile.security.subtitle":
        "Şifre ve hesap güvenliği",

      "studio.profile.security.description":
        "Hesabını güvende tutmak için şifreni düzenli aralıklarla güncelle.",

      "studio.profile.security.changePassword":
        "Şifre Değiştir",

      /* =========================
         PROFILE / USAGE
         ========================= */

      "studio.profile.usage.title":
        "Kullanım İstatistikleri",

      "studio.profile.usage.subtitle":
        "Bu ayki özet",

      "studio.profile.usage.music":
        "AI Müzik Üret",

      "studio.profile.usage.cover":
        "AI Kapak Üret",

      "studio.profile.usage.atmo":
        "AI Atmosfer Video",

      "studio.profile.usage.cartoon":
        "AI Çocuk Çizgifilm",

      "studio.profile.usage.photofx":
        "AI Foto Efekt Video Klip",

      "studio.profile.usage.imageToVideo":
        "AI Resimden Video Üret",

      "studio.profile.usage.spentCredits":
        "Harcanan kredi",

      "studio.profile.usage.totalCredits":
        "Toplam kredi",

      "studio.profile.usage.goLibrary":
        "Ürettiklerime Git",

      /* =========================
         PROFILE / DYNAMIC
         ========================= */

      "studio.profile.userFallback":
        "Kullanıcı",

      "studio.profile.planPrefix":
        "Plan: {plan}",

      "studio.profile.creditPrefix":
        "Kredi: {credit}",

      "studio.profile.error.nameRequired":
        "Ad alanı boş olamaz.",

      "studio.profile.toast.saved":
        "Profil güncellendi.",

      "studio.profile.toast.saveFailed":
        "Profil kaydedilemedi.",

      /* =========================
         PROFILE / PASSWORD MODAL
         ========================= */

      "studio.profile.password.title":
        "Şifre Değiştir",

      "studio.profile.password.subtitle":
        "Hesabını güvende tutmak için güçlü bir şifre kullan.",

      "studio.profile.password.close":
        "Kapat",

      "studio.profile.password.current":
        "Mevcut Şifre",

      "studio.profile.password.currentPlaceholder":
        "Mevcut şifren",

      "studio.profile.password.new":
        "Yeni Şifre",

      "studio.profile.password.newPlaceholder":
        "Yeni şifre",

      "studio.profile.password.confirm":
        "Yeni Şifre (Tekrar)",

      "studio.profile.password.confirmPlaceholder":
        "Yeni şifre tekrar",

      "studio.profile.password.hint":
        "En az 8 karakter, mümkünse harf + sayı + sembol.",

      "studio.profile.password.cancel":
        "İptal",

      "studio.profile.password.update":
        "Şifreyi Güncelle",

      "studio.profile.password.error.allFields":
        "Lütfen tüm alanları doldurun.",

      "studio.profile.password.error.tooShort":
        "Yeni şifre en az 8 karakter olmalı.",

      "studio.profile.password.error.mismatch":
        "Yeni şifreler eşleşmiyor.",

      "studio.profile.password.error.currentInvalid":
        "Mevcut şifre yanlış.",

      "studio.profile.password.error.sameAsOld":
        "Yeni şifre mevcut şifreyle aynı olamaz.",

      "studio.profile.password.error.updateFailed":
        "Şifre güncellenemedi.",

      "studio.profile.password.toast.updated":
        "Şifre başarıyla güncellendi.",

      /* =========================
         PROFILE / RIGHT PANEL
         ========================= */

      "studio.profile.panel.title":
        "Profil",

      "studio.profile.panel.subtitle":
        "Hesap özeti",

      "studio.profile.panel.account":
        "Hesap",

      "studio.profile.panel.user":
        "Kullanıcı",

      "studio.profile.panel.email":
        "E-posta",

      "studio.profile.panel.credits":
        "Krediler",

      "studio.profile.panel.total":
        "Toplam",

      "studio.profile.panel.spent":
        "Harcanan",

      "studio.profile.panel.shortcuts":
        "Kısayollar",

      "studio.profile.panel.buyCredits":
        "Kredi Satın Al",

      "studio.profile.panel.library":
        "Ürettiklerim",

        "studio.profile.panel.hint":
        "Profil özeti ve hızlı erişim bu panelde gösterilir.",

      /* =========================
         INVOICES / PAGE
         ========================= */

      "studio.invoices.title":
        "Faturalarım",

      "studio.invoices.subtitle":
        "Geçmiş satın alımlarına ait faturalar ve ödeme belgeleri burada listelenir.",

      "studio.invoices.filter.all":
        "Tümü",

      "studio.invoices.filter.purchase":
        "Satın Alım",

      "studio.invoices.filter.refund":
        "İade",

      "studio.invoices.listLabel":
        "Fatura listesi",

      "studio.invoices.empty.default":
        "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.",

      "studio.invoices.more":
        "Daha fazla yükle",

      /* =========================
         INVOICES / EMPTY & ERRORS
         ========================= */

      "studio.invoices.empty.filtered":
        "Bu filtre için gösterilecek fatura bulunamadı.",

      "studio.invoices.empty.sessionMissing":
        "Faturaları göstermek için oturum bilgisi bulunamadı.",

      "studio.invoices.empty.loadFailed":
        "Faturalar şu an yüklenemedi.",

      /* =========================
         INVOICES / TYPE & STATUS
         ========================= */

      "studio.invoices.type.purchase":
        "Satın Alım",

      "studio.invoices.type.refund":
        "İade",

      "studio.invoices.status.paid":
        "Ödendi",

      "studio.invoices.status.pending":
        "Beklemede",

      "studio.invoices.status.ready":
        "Hazır",

      "studio.invoices.status.refunded":
        "İade Edildi",

      "studio.invoices.status.failed":
        "Başarısız",

      "studio.invoices.status.canceled":
        "İptal",

      /* =========================
         INVOICES / CARD
         ========================= */

      "studio.invoices.recordTitle":
        "AIVO FATURA KAYDI",

      "studio.invoices.defaultPurchaseTitle":
        "Satın Alım",

      "studio.invoices.package.withCredits":
        "{count} Kredilik Paket",

      "studio.invoices.package.default":
        "Kredi Paketi",

      "studio.invoices.package.creditDefinition":
        "Toplam {count} kredi tanımı",

      "studio.invoices.package.purchaseDetail":
        "Satın alım detayı",

      "studio.invoices.field.date":
        "Tarih",

      "studio.invoices.field.status":
        "Durum",

      "studio.invoices.field.paymentAmount":
        "Ödeme Tutarı",

      "studio.invoices.field.refundAmount":
        "İade Tutarı",

      "studio.invoices.detail.purchase":
        "Paket ödemesi başarıyla tamamlandı.",

      "studio.invoices.detail.refund":
        "İşlem türü iade olarak işlendi.",

      "studio.invoices.action.openInvoice":
        "Faturayı Görüntüle",

      "studio.invoices.action.openRefund":
        "İade Belgesini Aç",

      "studio.invoices.action.documentUnavailable":
        "Belge Hazır Değil",

      /* =========================
         INVOICES / RIGHT PANEL
         ========================= */

      "studio.invoices.panel.title":
        "Faturalarım",

      "studio.invoices.panel.subtitle":
        "Faturalama özeti ve hızlı erişim",

      "studio.invoices.panel.meta":
        "Faturalama özeti",

      "studio.invoices.panel.tips":
        "İpuçları",

      "studio.invoices.panel.tip.list":
        "Fatura detayları orta panelde listelenir.",

      "studio.invoices.panel.tip.records":
        "Satın alım ve iade kayıtları orta alandaki kartlarda görüntülenir.",

          "studio.invoices.panel.tip.documents":
        "Belge açma ve inceleme işlemleri orta panel üzerinden yapılır.",

      /* =========================
         SETTINGS / PAGE
         ========================= */

      "studio.settings.title":
        "Ayarlar",

      "studio.settings.subtitle":
        "Uygulama tercihlerini ve hesap ayarlarını yönet.",

      "studio.settings.save":
        "Ayarları Kaydet",

      "studio.settings.categories.label":
        "Ayar Kategorileri",

      "studio.settings.categories.title":
        "Ayar Kategorileri",

      "studio.settings.categories.subtitle":
        "Bir kategori seç ve ayarlarını düzenle.",

      "studio.settings.tab.notifications":
        "Bildirimler",

      "studio.settings.tab.music":
        "Müzik",

      "studio.settings.tab.privacy":
        "Gizlilik",

      "studio.settings.tab.security":
        "Hesap & Güvenlik",

      "studio.settings.tab.data":
        "Veri Hakları",

      /* =========================
         SETTINGS / NOTIFICATIONS
         ========================= */

      "studio.settings.notifications.title":
        "Bildirim Ayarları",

      "studio.settings.notifications.subtitle":
        "Hangi bildirimleri almak istediğini seç.",

      "studio.settings.notifications.email.title":
        "E-posta Bildirimleri",

      "studio.settings.notifications.email.subtitle":
        "Önemli olaylarda e-posta al.",

      "studio.settings.notifications.done.title":
        "Müzik üretimi tamamlandığında",

      "studio.settings.notifications.done.subtitle":
        "Şarkın hazır olduğunda e-posta al.",

      "studio.settings.notifications.lowCredit.title":
        "Kredi azaldığında",

      "studio.settings.notifications.lowCredit.subtitle":
        "Krediniz belirli bir eşiğin altına düştüğünde uyarı al.",

      "studio.settings.notifications.weekly.title":
        "Haftalık rapor",

      "studio.settings.notifications.weekly.subtitle":
        "Haftalık aktivite özetini al.",

      "studio.settings.notifications.promos.title":
        "Promosyonlar ve kampanyalar",

      "studio.settings.notifications.promos.subtitle":
        "Özel tekliflerden haberdar ol.",

      /* =========================
         SETTINGS / MUSIC
         ========================= */

      "studio.settings.music.title":
        "Müzik Ayarları",

      "studio.settings.music.subtitle":
        "Çalma ve üretim tercihlerini ayarla.",

      "studio.settings.music.quality.title":
        "Varsayılan Kalite",

      "studio.settings.music.quality.subtitle":
        "Üretim ve indirmelerde kullanılacak varsayılan ses kalitesi.",

      "studio.settings.music.quality.low.title":
        "Düşük",

      "studio.settings.music.quality.low.subtitle":
        "128 kbps – Daha hızlı üretim, daha az veri",

      "studio.settings.music.quality.high.title":
        "Yüksek",

      "studio.settings.music.quality.high.subtitle":
        "256 kbps – Dengeli kalite (önerilen)",

      "studio.settings.music.quality.studio.title":
        "Studio",

      "studio.settings.music.quality.studio.subtitle":
        "320 kbps – En yüksek kalite",

      "studio.settings.music.autoplay.title":
        "Otomatik çalma",

      "studio.settings.music.autoplay.subtitle":
        "Üretim tamamlandığında müzik otomatik olarak oynatılsın.",

      "studio.settings.music.volume.title":
        "Varsayılan Ses Seviyesi",

      "studio.settings.music.volume.subtitle":
        "Player açıldığında başlangıç ses seviyesi.",

      "studio.settings.music.volume.silent":
        "Sessiz",

      "studio.settings.music.volume.maximum":
        "Maksimum",

      /* =========================
         SETTINGS / PRIVACY
         ========================= */

      "studio.settings.privacy.title":
        "Gizlilik Ayarları",

      "studio.settings.privacy.subtitle":
        "Verilerinin nasıl kullanıldığını kontrol et.",

      "studio.settings.privacy.visibility.title":
        "Profil Görünürlüğü",

      "studio.settings.privacy.visibility.subtitle":
        "Profilinin kimler tarafından görülebileceğini seç.",

      "studio.settings.privacy.visibility.public.title":
        "Herkese Açık",

      "studio.settings.privacy.visibility.public.subtitle":
        "Profilin herkes tarafından görülebilir.",

      "studio.settings.privacy.visibility.private.title":
        "Özel",

      "studio.settings.privacy.visibility.private.subtitle":
        "Sadece sen görebilirsin.",

      "studio.settings.privacy.activity.title":
        "Aktivite paylaşımı",

      "studio.settings.privacy.activity.subtitle":
        "Üretim aktiviten (başlık/tür) profilinde görünebilir.",

      "studio.settings.privacy.analytics.title":
        "Anonim veri toplama",

      "studio.settings.privacy.analytics.subtitle":
        "Uygulamayı geliştirmek için anonim kullanım verileri.",

      /* =========================
         SETTINGS / SECURITY
         ========================= */

      "studio.settings.security.title":
        "Hesap & Güvenlik",

      "studio.settings.security.subtitle":
        "Oturum süresi ve güvenlik tercihlerini yönet.",

      "studio.settings.security.session.title":
        "Oturum Süresi",

      "studio.settings.security.session.subtitle":
        "Belirli bir süre işlem olmazsa otomatik çıkış.",

      "studio.settings.security.timeout.title":
        "Otomatik çıkış zamanı",

      "studio.settings.security.timeout.subtitle":
        "MVP: sadece tercih kaydedilir, backend sonra.",

      "studio.settings.security.timeout.off":
        "Kapalı (Bu cihazda beni hatırla)",

      "studio.settings.security.timeout.15m":
        "15 dakika",

      "studio.settings.security.timeout.30m":
        "30 dakika",

      "studio.settings.security.timeout.1h":
        "1 saat",

      "studio.settings.security.timeout.6h":
        "6 saat",

      "studio.settings.security.timeout.24h":
        "24 saat",

      "studio.settings.security.devices.title":
        "Aktif Cihazlar",

      "studio.settings.security.devices.subtitle":
        "Hesabının açık olduğu cihazları kontrol et.",

      "studio.settings.security.devices.list.title":
        "Cihaz listesi",

      "studio.settings.security.devices.list.subtitle":
        "MVP: Liste backend ile gelecek. Şimdilik bu bölüm bilgilendirme amaçlıdır.",

      "studio.settings.security.comingSoon":
        "Yakında",

      "studio.settings.security.twoFactor.title":
        "2 Adımlı Doğrulama (2FA)",

      "studio.settings.security.twoFactor.subtitle":
        "MVP: iskelet. Kurulum akışı sonra eklenecek.",

      "studio.settings.security.twoFactor.enable.title":
        "2FA’yı etkinleştir",

      "studio.settings.security.twoFactor.enable.subtitle":
        "Şimdilik devre dışı (yakında).",

      /* =========================
         SETTINGS / DATA RIGHTS
         ========================= */

      "studio.settings.data.title":
        "Veri Hakları",

      "studio.settings.data.subtitle":
        "Veri indirme, düzeltme ve silme taleplerini yönet.",

      "studio.settings.data.access.title":
        "Verilerime Erişim",

      "studio.settings.data.access.subtitle":
        "Kişisel verilerinin bir kopyasını indir.",

      "studio.settings.data.format.title":
        "Format",

      "studio.settings.data.format.subtitle":
        "Şimdilik sadece JSON (ZIP sonra).",

      "studio.settings.data.format.json":
        "JSON",

      "studio.settings.data.format.zipSoon":
        "ZIP (yakında)",

      "studio.settings.data.export.note":
        "MVP: API bağlanınca aktif edilecek.",

      "studio.settings.data.export.download":
        "Verilerimi İndir",

      "studio.settings.data.rectification.title":
        "Düzeltme Talebi",

      "studio.settings.data.rectification.subtitle":
        "Yanlış/eksik verilerin için talep oluştur.",

      "studio.settings.data.rectification.placeholder":
        "Düzeltme talebini kısaca yaz…",

      "studio.settings.data.rectification.note":
        "Şimdilik talep alınır ve bilgilendirme toast’ı gösterilir.",

      "studio.settings.data.rectification.submit":
        "Düzeltme Talebi Gönder",

      "studio.settings.data.delete.title":
        "Silme Talebi (Unutulma Hakkı)",

      "studio.settings.data.delete.subtitle":
        "Hesabının ve içeriklerinin silinmesi (ileride).",

      "studio.settings.data.delete.warning":
        "Uyarı: Bu talep hesabının kapatılmasına ve içeriklerinin kalıcı olarak silinmesine neden olabilir.",

      "studio.settings.data.delete.ack":
        "“Anladım” onayı (MVP) — silme akışı sonra bağlanacak.",

      "studio.settings.data.delete.submit":
        "Silme Talebi Gönder",

      /* =========================
         SETTINGS / DYNAMIC
         ========================= */

      "studio.settings.toast.saved":
        "Ayarlar kaydedildi",

      "studio.settings.toast.rectificationReceived":
        "Düzeltme talebi alındı",

      "studio.settings.toast.exportReady":
        "Export hazır: aivo-export.json indirildi",

      "studio.settings.toast.exportFailed":
        "Export oluşturulamadı",

      "studio.settings.toast.downloadFailed":
        "Export indirilemedi.",

      "studio.settings.export.metaNote":
        "MVP geçici dışa aktarım: localStorage ve uygulama verilerinin anlık görüntüsü. Backend entegre edildiğinde gerçek dışa aktarım ile değiştirilecek.",

      /* =========================
         SETTINGS / RIGHT PANEL
         ========================= */

      "studio.settings.panel.title":
        "Ayarlar",

      "studio.settings.panel.subtitle":
        "Bağlamsal yardım ve kısa bilgiler",

      "studio.settings.panel.activeCategory":
        "Aktif kategori",

      "studio.settings.panel.quickNotes":
        "Kısa Notlar",

      "studio.settings.panel.helperNote":
        "Yardımcı Not",

      "studio.settings.panel.panelNote":
        "Panel Notu",

      "studio.settings.panel.panelNoteText":
        "Bu alan yalnızca aktif ayar sekmesi için özet ve yardımcı bilgi gösterir.",

      "studio.settings.panel.footer":
        "Bu sağ panel özet ve yönlendirme alanıdır. Form alanlarının sahibi orta paneldir.",

      "studio.settings.panel.notifications.title":
        "Bildirimler",

      "studio.settings.panel.notifications.subtitle":
        "Bildirim tercihleri ve bilgilendirme akışı",

      "studio.settings.panel.notifications.bullet1":
        "E-posta bildirimleri üretim, kredi ve kampanya akışını kontrol eder.",

      "studio.settings.panel.notifications.bullet2":
        "Tarayıcı bildirimi tarafı şu an MVP/stub davranışında olabilir.",

      "studio.settings.panel.notifications.bullet3":
        "Gerçek kayıt işlemi orta paneldeki Ayarları Kaydet aksiyonuyla yapılır.",

      "studio.settings.panel.notifications.hint":
        "Öncelik: hangi bildirimlerin gerçekten gerekli olduğunu sade tutmak.",

      "studio.settings.panel.music.title":
        "Müzik",

      "studio.settings.panel.music.subtitle":
        "Kalite, otomatik çalma ve ses seviyesi tercihleri",

      "studio.settings.panel.music.bullet1":
        "Varsayılan kalite üretim ve indirme deneyimini etkiler.",

      "studio.settings.panel.music.bullet2":
        "Otomatik çalma player davranışını açılış sonrası etkiler.",

      "studio.settings.panel.music.bullet3":
        "Ses seviyesi etiketi range input ile senkron çalışmalıdır.",

      "studio.settings.panel.music.hint":
        "Öncelik: kalite + autoplay + volume üçlüsünün birlikte tutarlı kalması.",

      "studio.settings.panel.privacy.title":
        "Gizlilik",

      "studio.settings.panel.privacy.subtitle":
        "Profil görünürlüğü ve veri paylaşım tercihleri",

      "studio.settings.panel.privacy.bullet1":
        "Profil görünürlüğü herkese açık veya özel olarak saklanır.",

      "studio.settings.panel.privacy.bullet2":
        "Aktivite paylaşımı profil üzerinde üretim görünürlüğünü etkiler.",

      "studio.settings.panel.privacy.bullet3":
        "Anonim veri toplama uygulama geliştirme için ayrı bir tercihtir.",

      "studio.settings.panel.privacy.hint":
        "Öncelik: görünürlük ve anonim veri tercihlerini birbirine karıştırmamak.",

      "studio.settings.panel.security.title":
        "Hesap & Güvenlik",

      "studio.settings.panel.security.subtitle":
        "Oturum süresi ve güvenlik tercihleri",

      "studio.settings.panel.security.bullet1":
        "Oturum süresi seçimi local state tarafında tutuluyor.",

      "studio.settings.panel.security.bullet2":
        "2FA alanı şu an hazırlık/stub aşamasında olabilir.",

      "studio.settings.panel.security.bullet3":
        "Security idle timeout akışı eski owner’dan taşınacak parçalardan biridir.",

      "studio.settings.panel.security.hint":
        "Öncelik: session timeout davranışını yeni owner yapısında netleştirmek.",

      "studio.settings.panel.data.title":
        "Veri Hakları",

      "studio.settings.panel.data.subtitle":
        "Veri indirme, düzeltme ve silme talepleri",

      "studio.settings.panel.data.bullet1":
        "Veri indirme alanı export formatı seçimiyle birlikte çalışır.",

      "studio.settings.panel.data.bullet2":
        "Düzeltme talebi textarea içeriği local state içinde tutulur.",

      "studio.settings.panel.data.bullet3":
        "Silme talebi onayı ayrı bir güvenlik adımı olarak ele alınır.",

      "studio.settings.panel.data.hint":
        "Öncelik: export / rectification / delete alanlarının pane sınırını bozmamak.",

      /* =========================
         SUPPORT
         ========================= */

      "studio.support":
        "Destek Merkezi"
    },

    en: {
      /* =========================
         STUDIO / SEO
         ========================= */

      "studio.seoTitle":
        "AIVO Studio — AI Creation Workspace",

      "studio.seoDescription":
        "Create AI music, cover art, atmosphere videos, cartoons, photo effects, image-to-video and lip-sync content with AIVO Studio.",

      /* =========================
         STUDIO / SHELL
         ========================= */

      "studio.pageLabel":
        "AIVO Studio creation workspace",

      "studio.sidebar.aiCreate":
        "AI Creation",

      "studio.sidebar.panels":
        "Panels",

      "studio.sidebar.notes":
        "Quick Notes",

      "studio.tool.music":
        "Create AI Music",

      "studio.tool.cover":
        "Create AI Cover Art",

      "studio.tool.atmo":
        "AI Atmosphere Video",

      "studio.tool.cartoon":
        "AI Kids Cartoon",

      "studio.tool.photofx":
        "AI Photo Effect Video Clip",

      "studio.tool.video":
        "Create AI Image-to-Video",

      "studio.tool.lipsync":
        "AI Lip-Sync Video",

      "studio.panel.profile":
        "Profile",

      "studio.panel.invoices":
        "My Invoices",

      "studio.panel.buyCredits":
        "Buy Credits",

      "studio.panel.settings":
        "Settings",

      "studio.panel.logout":
        "Log Out",

      "studio.notes.retention":
        "Files are stored for a limited time.",

      "studio.notes.deleted":
        "Deleted creations cannot be restored.",

      "studio.notes.busy":
        "Generation may take longer during busy periods.",

      "studio.empty.title":
        "No module loaded yet",

      "studio.empty.description":
        "Choose a creation tool from the left menu to begin.",

      "studio.outputLabel":
        "Generation results",

      "studio.loadingModule":
        "Loading module...",

      "studio.moduleLoadFailed":
        "The module could not be loaded. Please try again.",

      /* =========================
         GENERIC / TOAST
         ========================= */

      "studio.toast.success":
        "Success",

      "studio.toast.error":
        "Error",

      "studio.toast.warning":
        "Warning",

      "studio.toast.loading":
        "Processing",

      "studio.toast.info":
        "Information",

      "studio.toast.connectionError":
        "Connection error. Please try again.",

      "studio.toast.unexpectedError":
        "An unexpected error occurred.",

      /* =========================
         MUSIC / FORM
         ========================= */

      "studio.music.title":
        "Create AI Music",

      "studio.music.subtitle":
        "Choose the rhythm, vocals, mood and genre — AIVO will create the song for you.",

      "studio.music.workMode.title":
        "Creation Mode",

      "studio.music.workMode.subtitle":
        "Use Simple Mode for a quick start or Advanced Mode for detailed control.",

      "studio.music.mode.basic":
        "Simple Mode",

      "studio.music.mode.advanced":
        "Advanced Mode",

      "studio.music.songName":
        "Song Title",

      "studio.music.songNamePlaceholder":
        "E.g. Ash Garden, Midnight Drive...",

      "studio.music.prompt":
        "Additional Description / Prompt",

      "studio.music.promptPlaceholder":
        "Describe the details you want to emphasize in the music...",

      "studio.music.lyrics":
        "Lyrics (optional)",

      "studio.music.lyricsPlaceholder":
        "Write or paste your lyrics here...",

      "studio.music.mood":
        "Mood / Genre",

      "studio.music.moodPlaceholder":
        "Select a mood / genre",

      "studio.music.mood.pop":
        "Pop, energetic, Turkish vocals",

      "studio.music.mood.rap":
        "Rap / Trap",

      "studio.music.mood.arabesk":
        "Arabesque / Emotional",

      "studio.music.mood.slow":
        "Slow / Romantic",

      "studio.music.mood.electronic":
        "Electronic / Dance",

      "studio.music.mood.rock":
        "Rock",

      "studio.music.vocalType":
        "Vocal Type",

      "studio.music.vocalPlaceholder":
        "Select a vocal type",

      "studio.music.vocal.male":
        "Male Vocal (AI)",

      "studio.music.vocal.female":
        "Female Vocal (AI)",

      "studio.music.vocal.instrumental":
        "Instrumental (No Vocals)",

      "studio.music.generate":
        "🎵 Generate Music",

      "studio.music.generateWithCredit":
        "🎵 Generate Music ({count} Credits)",

      "studio.music.credit":
        "{count} Credits",

      /* =========================
         MUSIC / DYNAMIC STATUS
         ========================= */

      "studio.music.status.preparing":
        "Preparing music generation...",

      "studio.music.status.sending":
        "Sending generation request...",

      "studio.music.status.queued":
        "Generation added to the queue.",

      "studio.music.status.processing":
        "Generating music...",

      "studio.music.status.ready":
        "Music is ready.",

      "studio.music.status.failed":
        "Music generation could not be completed.",

      "studio.music.error.promptRequired":
        "Enter a description or make a selection before generating music.",

      "studio.music.error.songNameRequired":
        "Enter a song title.",

      "studio.music.error.insufficientCredit":
        "Insufficient credits.",

      "studio.music.error.requestFailed":
        "Music generation could not be started. Please try again.",

      /* =========================
         MUSIC / RESULTS PANEL
         ========================= */

      "studio.music.panel.title":
        "My Music",

      "studio.music.panel.retention":
        "Music files are stored for 14 days.",

      "studio.music.panel.searchPlaceholder":
        "Search music...",

      "studio.music.panel.empty":
        "No music has been generated yet.",

      "studio.music.panel.noResults":
        "No music matches your search.",

      "studio.music.panel.status.ready":
        "Ready",

      "studio.music.panel.status.processing":
        "Processing",

      "studio.music.panel.status.failed":
        "Failed",

      "studio.music.panel.untitled":
        "Untitled Track",

      "studio.music.action.play":
        "Play",

      "studio.music.action.pause":
        "Pause",

      "studio.music.action.details":
        "Open details",

      "studio.music.action.download":
        "Download music",

      "studio.music.action.lyrics":
        "Open lyrics",

      "studio.music.action.delete":
        "Delete music",

      "studio.music.delete.confirm":
        "Are you sure you want to delete this music?",

      "studio.music.delete.success":
        "Music deleted.",

      "studio.music.delete.failed":
        "Music could not be deleted.",

          "studio.music.download.failed":
        "Music could not be downloaded.",

      /* =========================
         COVER / FORM
         ========================= */

      "studio.cover.title":
        "Create Cover Art / Visual",

      "studio.cover.subtitle":
        "Design cover art for Spotify, Apple Music and YouTube with AI.",

      "studio.cover.beta":
        "BETA",

      "studio.cover.prompt":
        "Prompt",

      "studio.cover.promptPlaceholder":
        "E.g. A mysterious woman walking through a neon city at night, cinematic atmosphere",

      "studio.cover.qualityLevel":
        "Quality Level",

      "studio.cover.qualityArtist":
        "Artist",

      "studio.cover.qualityUltra":
        "Cinematic Ultra HD",

      "studio.cover.credit6":
        "6 Credits",

      "studio.cover.credit9":
        "9 Credits",

      "studio.cover.styleOptions":
        "Style Options",

      "studio.cover.styleRealistic":
        "Realistic",

      "studio.cover.styleRealisticSub":
        "Natural, sharp and highly detailed covers with studio lighting",

      "studio.cover.styleArtistic":
        "Artistic",

      "studio.cover.styleArtisticSub":
        "Expressive compositions with texture, light and deep colors",

      "studio.cover.styleCartoon":
        "Cartoon",

      "studio.cover.styleCartoonSub":
        "Clean lines, vivid colors and a playful character-focused style",

      "studio.cover.styleAbstract":
        "Abstract",

      "studio.cover.styleAbstractSub":
        "Modern concept designs with geometric forms and soft gradients",

      "studio.cover.stylePhoto":
        "Photographic",

      "studio.cover.stylePhotoSub":
        "Cinematic lighting, depth of field and a premium photography aesthetic",

      "studio.cover.styleAnime":
        "Anime",

      "studio.cover.styleAnimeSub":
        "Anime visuals with manga texture, soft lighting and clean lines",

      "studio.cover.imageCount":
        "Image Count",

      "studio.cover.image1":
        "1 Image",

      "studio.cover.image2":
        "2 Images",

      "studio.cover.image4":
        "4 Images",

      "studio.cover.aspectRatio":
        "Aspect Ratio",

      "studio.cover.ratioSquare":
        "Square (1:1)",

      "studio.cover.ratioVertical":
        "Portrait (9:16)",

      "studio.cover.ratioHorizontal":
        "Landscape (16:9)",

      "studio.cover.engineTitle":
        "AIVO Cover Engine",

      "studio.cover.requiredCredit":
        "Required Credits:",

      "studio.cover.engineDesc":
        "Generate one cover for 6 credits. Higher quality may use more credits.",

      "studio.cover.generate6":
        "🖼️ Generate Cover (6 Credits)",

      "studio.cover.generate9":
        "🖼️ Generate Cover (9 Credits)",

          "studio.cover.generateWithCredit":
        "🖼️ Generate Cover ({count} Credits)",

      /* =========================
         ATMOSPHERE / HEADER & MODE
         ========================= */

      "studio.atmo.title":
        "AI Atmosphere Video",

      "studio.atmo.subtitle":
        "For creators who cannot shoot a clip: add falling snow, flowing rain and flickering lights — create 4–15 second cinematic atmosphere videos.",

      "studio.atmo.modeLabel":
        "Mode Selection",

      "studio.atmo.mode.basic":
        "Basic Mode",

      "studio.atmo.mode.super":
        "Super Mode ✨",

      /* =========================
         ATMOSPHERE / BASIC SCENES
         ========================= */

      "studio.atmo.scene.title":
        "Background Scene",

      "studio.atmo.scene.subtitle":
        "Choose a ready-made scene or upload your own image.",

      "studio.atmo.scene.winterCafe.title":
        "Winter Café",

      "studio.atmo.scene.winterCafe.desc":
        "Neon lights, snow and a warm vibe.",

      "studio.atmo.scene.cozyCabin.title":
        "Mountain Cabin",

      "studio.atmo.scene.cozyCabin.desc":
        "Fireplace, wood and a cozy atmosphere.",

      "studio.atmo.scene.lakeCabin.title":
        "Lakeside",

      "studio.atmo.scene.lakeCabin.desc":
        "Calm reflections with a cinematic feel.",

      "studio.atmo.scene.cityNight.title":
        "City Night",

      "studio.atmo.scene.cityNight.desc":
        "Bokeh and streetlights.",

      "studio.atmo.scene.rainyWindow.title":
        "Rainy Window",

      "studio.atmo.scene.rainyWindow.desc":
        "Raindrops on glass, dim lighting and an emotional mood.",

      "studio.atmo.scene.cityRooftop.title":
        "City Rooftop at Night",

      "studio.atmo.scene.cityRooftop.desc":
        "City lights, a gentle breeze and a cinematic look.",

      "studio.atmo.scene.oldStoneStreet.title":
        "Old Stone Street",

      "studio.atmo.scene.oldStoneStreet.desc":
        "Wet pavement, warm lamps and a music-video feel.",

      "studio.atmo.scene.atticWindow.title":
        "Attic Window",

      "studio.atmo.scene.atticWindow.desc":
        "Warm light indoors with a nighttime atmosphere outside.",

      "studio.atmo.scene.seaCliffs.title":
        "Seaside Cliffs",

      "studio.atmo.scene.seaCliffs.desc":
        "Wind, horizon and a free cinematic atmosphere.",

      "studio.atmo.scene.pineMountainRoad.title":
        "Pine Mountain Road",

      "studio.atmo.scene.pineMountainRoad.desc":
        "Cool nature, an open-road feeling and gentle solitude.",

      "studio.atmo.scene.sunsetHighway.title":
        "Sunset Highway",

      "studio.atmo.scene.sunsetHighway.desc":
        "The horizon, the road and a melancholic flow.",

      "studio.atmo.scene.dimMotelCorridor.title":
        "Dim Motel Corridor",

      "studio.atmo.scene.dimMotelCorridor.desc":
        "A quiet, cinematic scene with a strong sense of solitude.",

      /* =========================
         ATMOSPHERE / BASIC EFFECTS
         ========================= */

      "studio.atmo.effects.title":
        "Atmosphere Effects",

      "studio.atmo.effects.subtitle":
        "Select as many as you like. Example: Snow + Light",

      "studio.atmo.effects.label":
        "Atmosphere Selections",

      "studio.atmo.effects.snow":
        "❄️ Snow",

      "studio.atmo.effects.rain":
        "🌧️ Rain",

      "studio.atmo.effects.leaf":
        "🍃 Leaves",

      "studio.atmo.effects.fog":
        "🌫️ Fog",

      "studio.atmo.effects.light":
        "✨ Light",

      "studio.atmo.effects.fire":
        "🔥 Fire",

      "studio.atmo.effects.wind":
        "🌬️ Wind",

         "studio.atmo.duration":
        "Duration",

      "studio.atmo.duration.seconds":
        "{count} sec",

      "studio.atmo.duration.4":
        "4 sec",

      "studio.atmo.duration.6":
        "6 sec",

      "studio.atmo.duration.8":
        "8 sec",

      "studio.atmo.duration.10":
        "10 sec",

      "studio.atmo.duration.12":
        "12 sec",

      "studio.atmo.duration.15":
        "15 sec",

      /* =========================
         ATMOSPHERE / PERSONALIZATION
         ========================= */

      "studio.atmo.personalization.title":
        "Personalization (optional)",

      "studio.atmo.personalization.subtitle":
        "Add an aspect ratio, logo or jingle. The generation button is located here.",

      "studio.atmo.aspectRatio":
        "Aspect Ratio",

      "studio.atmo.opacity":
        "Opacity",

      "studio.atmo.silentCopy":
        "Create a silent copy for Spotify Canvas",

      "studio.atmo.logo":
        "Logo",

      "studio.atmo.audio":
        "Music / Jingle",

      "studio.atmo.credit.plus10":
        "+10 Credits",

      "studio.atmo.credit.free":
        "Free",

      "studio.atmo.file.chooseLogo":
        "🏷️ Choose Logo",

      "studio.atmo.file.chooseAudio":
        "🎵 Choose Audio",

      "studio.atmo.file.chooseImage":
        "🏞️ Choose Image",

      "studio.atmo.file.chooseProLogo":
        "🖼️ Choose Logo",

      "studio.atmo.file.notSelected":
        "No file selected",

      "studio.atmo.file.removeLogoLabel":
        "Remove the uploaded logo",

      "studio.atmo.file.removeLogoTitle":
        "Remove logo",

      "studio.atmo.file.removeAudioLabel":
        "Remove the uploaded audio",

      "studio.atmo.file.removeAudioTitle":
        "Remove audio",

      "studio.atmo.file.removeImageLabel":
        "Remove the uploaded image",

      "studio.atmo.file.removeImageTitle":
        "Remove image",

      "studio.atmo.logoPosition.topLeft":
        "Top Left",

      "studio.atmo.logoPosition.topRight":
        "Top Right",

      "studio.atmo.logoPosition.bottomLeft":
        "Bottom Left",

      "studio.atmo.logoPosition.bottomRight":
        "Bottom Right",

      "studio.atmo.logoPosition.centerSmall":
        "Center (small)",

      "studio.atmo.logoSize.small":
        "Small",

      "studio.atmo.logoSize.medium":
        "Medium",

      "studio.atmo.generate.basic":
        "🎬 Create Atmosphere Video (30 Credits)",

      "studio.atmo.generate.basicWithCredit":
        "🎬 Create Atmosphere Video ({count} Credits)",

      "studio.atmo.generate.super":
        "🎬 Create Super Atmosphere Video (45 Credits)",

      "studio.atmo.generate.superWithCredit":
        "🎬 Create Super Atmosphere Video ({count} Credits)",

      /* =========================
         ATMOSPHERE / SUPER PROMPT
         ========================= */

      "studio.atmo.super.description":
        "Describe the scene, camera and atmosphere in one sentence; references only provide direction and are not copied exactly.",

      "studio.atmo.super.promptPlaceholder":
        "Example: Neon city at night, purple and blue tones, slow camera movement, light fog, cinematic...",

      /* =========================
         ATMOSPHERE / SUPER STYLE
         ========================= */

      "studio.atmo.style.title":
        "Atmosphere Style",

      "studio.atmo.style.subtitle":
        "Choose the lighting and emotional tone.",

      "studio.atmo.light.title":
        "💡 Lighting",

      "studio.atmo.light.warm":
        "💡 Warm",

      "studio.atmo.light.cool":
        "❄️ Cool",

      "studio.atmo.light.golden":
        "🌅 Golden Hour",

      "studio.atmo.light.neon":
        "🟣 Neon",

      "studio.atmo.light.moon":
        "🌙 Moonlight",

      "studio.atmo.mood.title":
        "🎭 Mood",

      "studio.atmo.mood.romantic":
        "💜 Romantic",

      "studio.atmo.mood.cinematic":
        "🎬 Cinematic",

      "studio.atmo.mood.cozy":
        "🫶 Cozy",

      "studio.atmo.mood.mysterious":
        "🕯️ Mysterious",

      "studio.atmo.mood.lofi":
        "📼 Lo-fi",

      /* =========================
         ATMOSPHERE / EXPORT SETTINGS
         ========================= */

      "studio.atmo.export.title":
        "Export Settings",

      "studio.atmo.export.subtitle":
        "Choose the aspect ratio and duration.",

      "studio.atmo.export.preparationTime":
        "Preparation time may increase depending on the added media and duration. Average preparation time: 5–10 minutes.",

      "studio.atmo.export.aspect":
        "📐 Aspect Ratio",

      "studio.atmo.export.aspectNote":
        "When a reference image is uploaded, the aspect ratio may be affected by its composition.",

      "studio.atmo.export.duration":
        "⏱️ Duration",

      "studio.atmo.export.refImageNote":
        "<strong>Note:</strong> The reference image must be at least 300×300 px.",

      /* =========================
         ATMOSPHERE / DETAIL EFFECTS
         ========================= */

      "studio.atmo.details.title":
        "Detail Effects",

      "studio.atmo.details.subtitle":
        "A small selection of premium, low-cost post-render effects.",

      "studio.atmo.details.grain":
        "🎞️ Light Film Grain",

      "studio.atmo.details.glow":
        "✨ Bloom / Lens Glow",

      "studio.atmo.details.vignette":
        "🌑 Vignette",

      "studio.atmo.details.sharpen":
        "🔍 Light Sharpening",

      "studio.atmo.details.motionBlur":
        "🌀 Light Motion Blur",

      "studio.atmo.details.dust":
        "📽️ Film Dust / Scratches",

      "studio.atmo.lut.title":
        "🎨 Color Grade / LUT",

      "studio.atmo.lut.off":
        "Off",

      "studio.atmo.lut.warm":
        "Warm",

      "studio.atmo.lut.cold":
        "Cool",

      "studio.atmo.lut.cinematic":
        "Cinematic",

      "studio.atmo.lut.lofi":
        "Lo-fi",

      /* =========================
         ATMOSPHERE / SUPER MEDIA
         ========================= */

      "studio.atmo.media.mainImage":
        "Main Image",

      "studio.atmo.media.uploadAudio":
        "Upload Audio",

      "studio.atmo.media.uploadLogo":
        "Upload Logo",

      /* =========================
         ATMOSPHERE / UPLOAD STATUS
         ========================= */

      "studio.atmo.upload.ready":
        "Ready ✓",

      "studio.atmo.upload.uploading":
        "Uploading…",

      "studio.atmo.upload.error":
        "Error",

      "studio.atmo.upload.failed":
        "Upload error",

      "studio.atmo.upload.logoFailed":
        "Logo upload failed",

      "studio.atmo.upload.imageFailed":
        "Image upload failed",

      "studio.atmo.upload.audioFailed":
        "Audio upload failed",

      /* =========================
         ATMOSPHERE / GENERATION STATUS
         ========================= */

      "studio.atmo.status.preparing":
        "Preparing the atmosphere video...",

      "studio.atmo.status.uploading":
        "Uploading files...",

      "studio.atmo.status.sending":
        "Sending the generation request...",

      "studio.atmo.status.queued":
        "The atmosphere video has been added to the generation queue.",

      "studio.atmo.status.generating":
        "Creating the atmosphere video...",

      "studio.atmo.status.ready":
        "The atmosphere video is ready.",

      "studio.atmo.status.failed":
        "The atmosphere video could not be created.",

      "studio.atmo.status.creditDeducted":
        "{count} credits used.",

      "studio.atmo.toast.started":
        "Atmosphere video generation has started.",

      "studio.atmo.toast.superStarted":
        "Super Atmosphere video generation has started.",

      "studio.atmo.toast.ready":
        "Your atmosphere video is ready.",

      "studio.atmo.toast.failed":
        "Atmosphere video generation failed.",

      /* =========================
         ATMOSPHERE / VALIDATION
         ========================= */

      "studio.atmo.error.sceneRequired":
        "Please select a background scene.",

      "studio.atmo.error.effectRequired":
        "Please select at least one atmosphere effect.",

      "studio.atmo.error.promptRequired":
        "Please enter a prompt describing the scene and atmosphere.",

      "studio.atmo.error.insufficientCredit":
        "Insufficient credits.",

      "studio.atmo.error.uploadInProgress":
        "Please wait for the file upload to finish.",

      "studio.atmo.error.uploadFailed":
        "One of the files could not be uploaded. Please try again.",

      "studio.atmo.error.refImageMinimum":
        "The reference image must be at least 300×300 px.",

      "studio.atmo.error.invalidImage":
        "Please select a valid image file.",

      "studio.atmo.error.invalidLogo":
        "Please select a valid logo file.",

      "studio.atmo.error.invalidAudio":
        "Please select a valid audio file.",

      "studio.atmo.error.requestFailed":
        "Atmosphere video generation could not be started. Please try again.",

      /* =========================
         ATMOSPHERE / RESULTS PANEL
         ========================= */

      "studio.atmo.panel.title":
        "My Atmosphere Videos",

      "studio.atmo.panel.searchPlaceholder":
        "Search atmosphere videos...",

      "studio.atmo.panel.empty":
        "No atmosphere videos yet.",

      "studio.atmo.panel.noResults":
        "No atmosphere videos matched your search.",

      "studio.atmo.panel.untitled":
        "Untitled Atmosphere Video",

      "studio.atmo.panel.status.ready":
        "Ready",

      "studio.atmo.panel.status.preparing":
        "Preparing",

      "studio.atmo.panel.status.processing":
        "Processing",

      "studio.atmo.panel.status.failed":
        "Failed",

      "studio.atmo.action.open":
        "Open video",

      "studio.atmo.action.fullscreen":
        "Open fullscreen",

      "studio.atmo.action.download":
        "Download video",

      "studio.atmo.action.delete":
        "Delete video",

      "studio.atmo.action.audioOn":
        "Turn sound on",

      "studio.atmo.action.audioOff":
        "Turn sound off",

      "studio.atmo.download.success":
        "Atmosphere video downloaded.",

      "studio.atmo.download.failed":
        "Atmosphere video could not be downloaded.",

      "studio.atmo.delete.confirm":
        "Are you sure you want to delete this atmosphere video?",

      "studio.atmo.delete.success":
        "Atmosphere video deleted.",

      "studio.atmo.delete.failed":
        "Atmosphere video could not be deleted.",

       /* =========================
         CARTOON / EN
         ========================= */

      "studio.cartoon.title": "AI Kids Cartoon",
      "studio.cartoon.subtitle": "Create short cartoon scenes with preset characters.",
      "studio.cartoon.mode.label": "Mode Selection",
      "studio.cartoon.mode.character": "Create Character",
      "studio.cartoon.mode.basic": "Basic Mode",
      "studio.cartoon.mode.story": "Story Mode ✨",
      "studio.cartoon.mode.studio": "Montage Studio",

      "studio.cartoon.common.select": "Select",
      "studio.cartoon.common.none": "None",
      "studio.cartoon.common.yes": "Yes",
      "studio.cartoon.common.no": "No",
      "studio.cartoon.common.on": "On",
      "studio.cartoon.common.off": "Off",
      "studio.cartoon.common.optional": "(optional)",
      "studio.cartoon.common.noFile": "No file selected",
      "studio.cartoon.common.free": "Free",
      "studio.cartoon.common.plus10Credits": "+10 Credits",
      "studio.cartoon.common.chooseImage": "Choose Image",
      "studio.cartoon.common.chooseAudio": "Choose Audio",
      "studio.cartoon.common.chooseLogo": "Choose Logo",
      "studio.cartoon.common.chooseVoice": "Choose Voice",
      "studio.cartoon.common.chooseVideos": "Choose Videos",
      "studio.cartoon.common.removeImage": "Remove image",
      "studio.cartoon.common.removeImageLabel": "Remove uploaded image",
      "studio.cartoon.common.removeAudio": "Remove audio",
      "studio.cartoon.common.removeAudioLabel": "Remove uploaded audio",
      "studio.cartoon.common.removeLogo": "Remove logo",
      "studio.cartoon.common.removeLogoLabel": "Remove uploaded logo",
      "studio.cartoon.common.removeMusic": "Remove music",
      "studio.cartoon.common.removeMusicLabel": "Remove uploaded music",
      "studio.cartoon.common.ready": "Ready",
      "studio.cartoon.common.uploading": "Uploading…",
      "studio.cartoon.common.generating": "Generating…",
      "studio.cartoon.common.processing": "Processing",
      "studio.cartoon.common.preparing": "Preparing…",
      "studio.cartoon.common.failed": "Failed",
      "studio.cartoon.common.scene": "Scene",
      "studio.cartoon.common.seconds": "{count} sec",
      "studio.cartoon.common.minutes": "{count} min",
      "studio.cartoon.common.duration4": "4 sec",
      "studio.cartoon.common.duration6": "6 sec",
      "studio.cartoon.common.duration8": "8 sec",
      "studio.cartoon.common.duration10": "10 sec",
      "studio.cartoon.common.duration12": "12 sec",
      "studio.cartoon.common.duration15": "15 sec",
      "studio.cartoon.common.ratioWide": "Widescreen (16:9)",
      "studio.cartoon.common.ratioSquare": "Square (1:1)",
      "studio.cartoon.common.ratioVertical": "Vertical (9:16)",
      "studio.cartoon.common.positionBottomRight": "Bottom Right",
      "studio.cartoon.common.positionBottomLeft": "Bottom Left",
      "studio.cartoon.common.positionTopRight": "Top Right",
      "studio.cartoon.common.positionTopLeft": "Top Left",
      "studio.cartoon.common.positionCenter": "Center",
      "studio.cartoon.common.styleCute3d": "Cute 3D",
      "studio.cartoon.common.styleSoftCartoon": "Soft Cartoon",
      "studio.cartoon.common.stylePastel": "Pastel",
      "studio.cartoon.common.styleBrightKids": "Bright Kids Style",

      "studio.cartoon.character.title": "Create Character",
      "studio.cartoon.character.shortDescription": "Short Description",
      "studio.cartoon.character.descriptionPlaceholder": "E.g. a cute little rabbit in a yellow raincoat",
      "studio.cartoon.character.type": "Type",
      "studio.cartoon.character.type.animal": "Animal",
      "studio.cartoon.character.type.human": "Human",
      "studio.cartoon.character.type.fantasy": "Fantasy",
      "studio.cartoon.character.type.object": "Object",
      "studio.cartoon.character.type.custom": "Custom",
      "studio.cartoon.character.name": "Character Name",
      "studio.cartoon.character.namePlaceholder": "E.g. Mini Bunny",
      "studio.cartoon.character.style": "Style",
      "studio.cartoon.character.uploadInstruction": "Upload a photo of yourself or your child and turn it into a cartoon character.",
      "studio.cartoon.character.libraryTitle": "My Characters",
      "studio.cartoon.character.libraryEmpty": "No characters yet",
      "studio.cartoon.character.advancedTitle": "Advanced Customization",
      "studio.cartoon.character.hairType": "Hair Type",
      "studio.cartoon.character.hair.short": "Short",
      "studio.cartoon.character.hair.long": "Long",
      "studio.cartoon.character.hair.curly": "Curly",
      "studio.cartoon.character.hair.wavy": "Wavy",
      "studio.cartoon.character.hair.straight": "Straight",
      "studio.cartoon.character.hairColor": "Hair Color",
      "studio.cartoon.character.color.black": "Black",
      "studio.cartoon.character.color.brown": "Brown",
      "studio.cartoon.character.color.blonde": "Blonde",
      "studio.cartoon.character.color.red": "Red",
      "studio.cartoon.character.color.pink": "Pink",
      "studio.cartoon.character.color.blue": "Blue",
      "studio.cartoon.character.outfit": "Outfit",
      "studio.cartoon.character.outfit.dress": "Dress",
      "studio.cartoon.character.outfit.tshirtShorts": "T-shirt + Shorts",
      "studio.cartoon.character.outfit.hoodie": "Hoodie",
      "studio.cartoon.character.outfit.superhero": "Superhero",
      "studio.cartoon.character.outfit.princess": "Princess",
      "studio.cartoon.character.outfit.school": "School Outfit",
      "studio.cartoon.character.glasses": "Glasses",
      "studio.cartoon.character.glasses.round": "Round",
      "studio.cartoon.character.glasses.square": "Square",
      "studio.cartoon.character.glasses.star": "Star",
      "studio.cartoon.character.glasses.heart": "Heart",
      "studio.cartoon.character.accessory": "Accessory",
      "studio.cartoon.character.accessory.hat": "Hat",
      "studio.cartoon.character.accessory.bow": "Bow",
      "studio.cartoon.character.accessory.bag": "Bag",
      "studio.cartoon.character.accessory.wand": "Magic Wand",
      "studio.cartoon.character.accessory.crown": "Crown",
      "studio.cartoon.character.expression": "Facial Expression",
      "studio.cartoon.character.expression.happy": "Happy",
      "studio.cartoon.character.expression.excited": "Excited",
      "studio.cartoon.character.expression.cute": "Cute",
      "studio.cartoon.character.expression.calm": "Calm",
      "studio.cartoon.character.expression.funny": "Funny",
    "studio.cartoon.character.generate": "🧩 Create Character (20 Credits)",
"studio.cartoon.character.generateWithCredit": "🧩 Create Character ({count} Credits)",
"studio.cartoon.character.generateShort": "🧩 Create Character",
"studio.cartoon.character.generating": "Creating Character...",
"studio.cartoon.character.referenceUploading": "The reference image is still uploading.",
"studio.cartoon.character.referenceUploadFailed": "Change the image or upload it again.",

"studio.cartoon.basic.promptTitle": "Additional Prompt",
      "studio.cartoon.basic.promptPlaceholder": "E.g. look happy, add bubbles, move slowly",
      "studio.cartoon.basic.mainCharacter": "Main Character",
      "studio.cartoon.basic.helperCharacters": "Supporting Characters",
      "studio.cartoon.basic.character.redFish": "Red Fish",
      "studio.cartoon.basic.character.chick": "Chick",
      "studio.cartoon.basic.character.duck": "Duck",
      "studio.cartoon.basic.character.smallFish": "Small Fish",
      "studio.cartoon.basic.character.frog": "Frog",
      "studio.cartoon.basic.character.crab": "Crab",
      "studio.cartoon.basic.sceneTitle": "Scene",
      "studio.cartoon.basic.scene.underwater": "Underwater",
      "studio.cartoon.basic.scene.pond": "Pond",
      "studio.cartoon.basic.scene.forest": "Forest",
      "studio.cartoon.basic.scene.farm": "Farm",
      "studio.cartoon.basic.scene.sky": "Sky",
      "studio.cartoon.basic.scene.beach": "Beach",
      "studio.cartoon.basic.actionTitle": "Action",
      "studio.cartoon.basic.action.swimming": "Swimming",
      "studio.cartoon.basic.action.jumping": "Jumping",
      "studio.cartoon.basic.action.playing": "Playing",
      "studio.cartoon.basic.action.laughing": "Laughing",
      "studio.cartoon.basic.action.dancing": "Dancing",
      "studio.cartoon.basic.action.waving": "Waving",
      "studio.cartoon.basic.action.movingSlowly": "Moving Slowly",
      "studio.cartoon.basic.action.running": "Running",
      "studio.cartoon.basic.personalization": "Personalization",
      "studio.cartoon.basic.duration": "Duration",
      "studio.cartoon.basic.aspectRatio": "Aspect Ratio",
      "studio.cartoon.basic.logoPosition": "Logo Position",
      "studio.cartoon.basic.style": "Style",
      "studio.cartoon.basic.uploadVoice": "Upload Your Voice",
      "studio.cartoon.basic.uploadLogo": "Upload Logo",
      "studio.cartoon.basic.uploadCharacter": "Add Your Own Character",
      "studio.cartoon.basic.generate": "🎬 Create Scene (30 Credits)",
      "studio.cartoon.basic.generateWithCredit": "🎬 Create Scene ({count} Credits)",

      "studio.cartoon.story.summaryTitle": "Story Summary",
      "studio.cartoon.story.summaryHelper": "Create the overall structure of the story first. Then click each scene to edit it separately.",
      "studio.cartoon.story.idea": "Story Idea",
      "studio.cartoon.story.ideaPlaceholder": "E.g. The red fish goes on an adventure through the forest and pond with friends to find a lost pearl.",
      "studio.cartoon.story.theme": "Theme / Mood",
      "studio.cartoon.story.theme.cheerful": "Cheerful",
      "studio.cartoon.story.theme.curious": "Curious",
      "studio.cartoon.story.theme.exciting": "Exciting",
      "studio.cartoon.story.theme.emotional": "Emotional",
      "studio.cartoon.story.theme.fun": "Fun",
      "studio.cartoon.story.ageGroup": "Age Group",
      "studio.cartoon.story.age3to5": "Ages 3–5",
      "studio.cartoon.story.age5to7": "Ages 5–7",
      "studio.cartoon.story.age7to9": "Ages 7–9",
      "studio.cartoon.story.style": "Style",
      "studio.cartoon.story.charactersTitle": "Characters",
      "studio.cartoon.story.charactersNote": "Use preset characters for free or add your own custom character in the separate section.",
      "studio.cartoon.story.specialCharactersTitle": "Custom Characters (+10 Credits each)",
      "studio.cartoon.story.specialCharactersNote": "Add your own photo, your child’s image or custom reference characters here.",
      "studio.cartoon.story.specialCharactersCreditNote": "Each selection costs 10 credits. You can add up to 4 characters.",
      "studio.cartoon.story.specialCharactersMoreNote": "You can describe additional characters in the scene description.",
      "studio.cartoon.story.specialCharactersSizeNote": "The maximum upload size for each character image is 10 MB.",
      "studio.cartoon.story.character.main": "Main Character",
      "studio.cartoon.story.character.helper1": "Supporting Character 1",
      "studio.cartoon.story.character.helper2": "Supporting Character 2",
      "studio.cartoon.story.character.extra": "Extra Character",
      "studio.cartoon.story.characterLimit": "You can select up to 4 characters",
      "studio.cartoon.story.flowTitle": "Story Flow",
      "studio.cartoon.story.flowHelper": "The recommended scene distribution is prepared automatically based on the film duration.",
      "studio.cartoon.story.flowNote": "The minimum duration starts at 3 minutes. Edit scenes as needed; you do not have to fill every field.",
      "studio.cartoon.story.filmDuration": "Film Duration",
      "studio.cartoon.story.duration3": "3 min · Recommended",
      "studio.cartoon.story.duration4": "4 min",
      "studio.cartoon.story.duration5": "5 min",
      "studio.cartoon.story.duration6": "6 min",
      "studio.cartoon.story.section.intro": "Introduction",
      "studio.cartoon.story.section.introSub": "Introduce the world, main character and goal",
      "studio.cartoon.story.section.setup": "Setup",
      "studio.cartoon.story.section.setupSub": "A supporting element arrives, the journey begins and the first obstacle appears",
      "studio.cartoon.story.section.adventure": "Adventure",
      "studio.cartoon.story.section.adventureSub": "Events grow, risks rise and the story reaches its climax",
      "studio.cartoon.story.section.final": "Finale",
      "studio.cartoon.story.section.finalSub": "Resolution, closing and a warm ending",
      "studio.cartoon.story.sceneCount": "{count} Scenes",
      "studio.cartoon.story.sceneTitle": "Scene {count} · {title}",
      "studio.cartoon.story.settingsTitle": "Generation Settings",
      "studio.cartoon.story.settingsSub": "Ratio, style, logo and music",
      "studio.cartoon.story.settingsTimeNote": "Preparation may take longer as duration increases or when a logo, music or images are added. The video is usually ready in about 5–10 minutes.",
      "studio.cartoon.story.aspectRatio": "Aspect Ratio",
      "studio.cartoon.story.logoPosition": "Logo Position",
      "studio.cartoon.story.includeMusic": "Include Music in Video",
      "studio.cartoon.story.uploadLogo": "Upload Logo",
      "studio.cartoon.story.uploadMusic": "Upload Music",
      "studio.cartoon.story.footerInfo": "{count} scenes · about {minutes} min · avg. {seconds} sec per scene",
      "studio.cartoon.story.generate": "🎬 Create Story (Starting at 30 Credits)",
      "studio.cartoon.story.generateWithCredit": "🎬 Create Story ({count} Credits)",
      "studio.cartoon.story.editorTitle": "Edit Scene",
      "studio.cartoon.story.sceneHeading": "Scene Title",
      "studio.cartoon.story.sceneDescription": "Scene Description",
      "studio.cartoon.story.sceneCharacters": "Characters in the Scene",
      "studio.cartoon.story.sceneCharacterEmpty": "Select characters in the section above first.",
      "studio.cartoon.story.sceneDuration": "Duration",
      "studio.cartoon.story.sceneCreditNote": "Each additional 2 sec adds 5 credits.",
      "studio.cartoon.story.sceneCreditTotal": "Total spent: {count} Credits",
      "studio.cartoon.story.sceneMood": "Scene Mood",
      "studio.cartoon.story.sceneType": "Scene Type",
      "studio.cartoon.story.sceneType.intro": "Introduction",
      "studio.cartoon.story.sceneType.dialogue": "Dialogue",
      "studio.cartoon.story.sceneType.action": "Action",
      "studio.cartoon.story.sceneType.transition": "Transition",
      "studio.cartoon.story.sceneType.final": "Finale",
      "studio.cartoon.story.directorNote": "Additional Director Note",
      "studio.cartoon.story.directorNotePlaceholder": "E.g. open the camera from the left and have the character run into the scene",
      "studio.cartoon.story.cancel": "Cancel",
      "studio.cartoon.story.save": "Save",

      "studio.cartoon.story.blueprint.worldOpening.title": "World Opening",
      "studio.cartoon.story.blueprint.worldOpening.description": "The setting and overall atmosphere are established.",
      "studio.cartoon.story.blueprint.mainIntro.title": "Main Character Introduction",
      "studio.cartoon.story.blueprint.mainIntro.description": "The main character appears for the first time.",
      "studio.cartoon.story.blueprint.goalAppears.title": "The Goal Appears",
      "studio.cartoon.story.blueprint.goalAppears.description": "The character’s objective becomes clear.",
      "studio.cartoon.story.blueprint.emotionalBond.title": "First Emotional Connection",
      "studio.cartoon.story.blueprint.emotionalBond.description": "The character’s inner world becomes visible.",
      "studio.cartoon.story.blueprint.curiosity.title": "Spark of Curiosity",
      "studio.cartoon.story.blueprint.curiosity.description": "A new question or curiosity appears.",
      "studio.cartoon.story.blueprint.worldRule.title": "Rule of the World",
      "studio.cartoon.story.blueprint.worldRule.description": "The basic order of the story world becomes clear.",
      "studio.cartoon.story.blueprint.callToJourney.title": "Call to the Journey",
      "studio.cartoon.story.blueprint.callToJourney.description": "The character prepares to take action.",
      "studio.cartoon.story.blueprint.helperArrives.title": "A Helper Arrives",
      "studio.cartoon.story.blueprint.helperArrives.description": "A supporting character or element joins the story.",
      "studio.cartoon.story.blueprint.journeyBegins.title": "The Journey Begins",
      "studio.cartoon.story.blueprint.journeyBegins.description": "The characters set off.",
      "studio.cartoon.story.blueprint.firstObstacle.title": "First Obstacle",
      "studio.cartoon.story.blueprint.firstObstacle.description": "The first challenge appears.",
      "studio.cartoon.story.blueprint.plan.title": "A Plan Is Made",
      "studio.cartoon.story.blueprint.plan.description": "The first plan is made to solve the problem.",
      "studio.cartoon.story.blueprint.clue.title": "New Clue",
      "studio.cartoon.story.blueprint.clue.description": "New information is learned on the way to the goal.",
      "studio.cartoon.story.blueprint.balanceBreaks.title": "The Balance Breaks",
      "studio.cartoon.story.blueprint.balanceBreaks.description": "The characters’ normal order changes.",
      "studio.cartoon.story.blueprint.decision.title": "Decision Moment",
      "studio.cartoon.story.blueprint.decision.description": "They decide to continue instead of turning back.",
      "studio.cartoon.story.blueprint.adventureDeepens.title": "The Adventure Deepens",
      "studio.cartoon.story.blueprint.adventureDeepens.description": "Events begin to grow.",
      "studio.cartoon.story.blueprint.effort.title": "Trial and Effort",
      "studio.cartoon.story.blueprint.effort.description": "The characters try a new path toward a solution.",
      "studio.cartoon.story.blueprint.tension.title": "Tension Rises",
      "studio.cartoon.story.blueprint.tension.description": "The risk and pressure increase.",
      "studio.cartoon.story.blueprint.climax.title": "Climax",
      "studio.cartoon.story.blueprint.climax.description": "The most critical encounter takes place.",
      "studio.cartoon.story.blueprint.surprise.title": "Unexpected Surprise",
      "studio.cartoon.story.blueprint.surprise.description": "An unplanned development occurs.",
      "studio.cartoon.story.blueprint.teamwork.title": "Team Spirit",
      "studio.cartoon.story.blueprint.teamwork.description": "The characters learn to work together.",
      "studio.cartoon.story.blueprint.bigObstacle.title": "Major Obstacle",
      "studio.cartoon.story.blueprint.bigObstacle.description": "A stronger challenge stands in the heroes’ way.",
      "studio.cartoon.story.blueprint.lastPreparation.title": "Final Preparation",
      "studio.cartoon.story.blueprint.lastPreparation.description": "The final preparations are made before the finale.",
      "studio.cartoon.story.blueprint.hopeReturns.title": "Hope Returns",
      "studio.cartoon.story.blueprint.hopeReturns.description": "The characters regain their strength.",
      "studio.cartoon.story.blueprint.bigEncounter.title": "The Great Encounter",
      "studio.cartoon.story.blueprint.bigEncounter.description": "The most intense moment of the story takes place.",
      "studio.cartoon.story.blueprint.solution.title": "Resolution",
      "studio.cartoon.story.blueprint.solution.description": "The problem is solved.",
      "studio.cartoon.story.blueprint.closing.title": "Closing",
      "studio.cartoon.story.blueprint.closing.description": "The story ends with a warm finale.",
      "studio.cartoon.story.blueprint.celebration.title": "Celebration",
      "studio.cartoon.story.blueprint.celebration.description": "The characters celebrate their success together.",
      "studio.cartoon.story.blueprint.farewell.title": "Emotional Farewell",
      "studio.cartoon.story.blueprint.farewell.description": "The emotional effect of the story is completed.",
      "studio.cartoon.story.blueprint.newBalance.title": "New Balance",
      "studio.cartoon.story.blueprint.newBalance.description": "A new order is established in the world.",
      "studio.cartoon.story.blueprint.lastSmile.title": "Final Smile",
      "studio.cartoon.story.blueprint.lastSmile.description": "A warm final moment is left with the audience.",

      "studio.cartoon.studio.combineTitle": "Combine Scenes",
      "studio.cartoon.studio.combineHelper1": "Select and arrange the scenes that will appear in the final video.",
      "studio.cartoon.studio.combineHelper2": "Each uploaded video will be added to the list as a separate scene.",
      "studio.cartoon.studio.uploadVideo": "Upload Video",
      "studio.cartoon.studio.include": "Include",
      "studio.cartoon.studio.preview": "Preview",
      "studio.cartoon.studio.editTitle": "Edit title",
      "studio.cartoon.studio.deleteScene": "Delete scene",
      "studio.cartoon.studio.selectedScenes": "Selected Scenes: {count}",
      "studio.cartoon.studio.totalDuration": "Total Duration: {duration}",
      "studio.cartoon.studio.format": "Format: {format}",
      "studio.cartoon.studio.mediaTitle": "Add Audio / Add Logo",
      "studio.cartoon.studio.mediaHelper": "Upload your own audio file and add it to the final video.",
      "studio.cartoon.studio.uploadVoice": "Upload Your Voice",
      "studio.cartoon.studio.voice": "Audio",
      "studio.cartoon.studio.uploadLogo": "Upload Logo",
      "studio.cartoon.studio.logoPosition": "Logo Position",
      "studio.cartoon.studio.export": "🎬 Create Final Output (5 Credits per Video)",
      "studio.cartoon.studio.exportWithCredit": "🎬 Create Final Output ({count} Credits)",
      "studio.cartoon.studio.previewClose": "Close preview",
      "studio.cartoon.studio.previewTitle": "Video Preview",

      "studio.cartoon.panel.title": "My Cartoon Videos",
      "studio.cartoon.panel.searchPlaceholder": "Search cartoon videos...",
      "studio.cartoon.panel.empty": "No cartoon videos yet.",
      "studio.cartoon.panel.noResults": "No cartoon videos matched your search.",
      "studio.cartoon.panel.status.ready": "Ready",
      "studio.cartoon.panel.status.processing": "Processing",
      "studio.cartoon.panel.status.failed": "Failed",
      "studio.cartoon.panel.preparing": "Preparing…",
      "studio.cartoon.panel.action.play": "Play",
      "studio.cartoon.panel.action.pause": "Pause",
      "studio.cartoon.panel.action.download": "Download video",
      "studio.cartoon.panel.action.share": "Share video",
      "studio.cartoon.panel.action.fullscreen": "Open fullscreen",
      "studio.cartoon.panel.action.delete": "Delete video",
      "studio.cartoon.panel.action.audioOn": "Turn sound on",
      "studio.cartoon.panel.action.audioOff": "Turn sound off",
      "studio.cartoon.panel.toast.ready": "Your cartoon video is ready.",
      "studio.cartoon.panel.download.success": "Cartoon video downloaded.",
      "studio.cartoon.panel.download.failed": "Cartoon video could not be downloaded.",
      "studio.cartoon.panel.delete.confirm": "Are you sure you want to delete this cartoon video?",
      "studio.cartoon.panel.delete.success": "Cartoon video deleted.",
      "studio.cartoon.panel.delete.failed": "Cartoon video could not be deleted.",

    "studio.cartoon.toast.characterStarted": "Character creation started.",
"studio.cartoon.toast.characterReady": "Your character is ready.",
"studio.cartoon.toast.characterFailed": "The character could not be created.",
"studio.cartoon.toast.creditRefunded": "The operation failed and the credits were refunded.",
"studio.cartoon.toast.basicStarted": "Cartoon scene generation started.",
      "studio.cartoon.toast.basicReady": "Your cartoon scene is ready.",
      "studio.cartoon.toast.basicFailed": "The cartoon scene could not be created.",
      "studio.cartoon.toast.storyStarted": "Story generation started.",
      "studio.cartoon.toast.storyReady": "Your story is ready.",
      "studio.cartoon.toast.storyFailed": "The story could not be created.",
      "studio.cartoon.toast.studioStarted": "Montage processing started.",
      "studio.cartoon.toast.studioReady": "Your montage video is ready.",
      "studio.cartoon.toast.studioFailed": "The montage video could not be created.",
      "studio.cartoon.toast.imageAdded": "Image added.",
      "studio.cartoon.toast.imageRemoved": "Image removed.",
      "studio.cartoon.toast.audioAdded": "Audio added.",
      "studio.cartoon.toast.audioRemoved": "Audio removed.",
      "studio.cartoon.toast.logoAdded": "Logo added.",
      "studio.cartoon.toast.logoRemoved": "Logo removed.",
      "studio.cartoon.toast.videosAdded": "{count} videos added.",

      "studio.cartoon.error.descriptionRequired": "Please enter a short description for the character.",
      "studio.cartoon.error.storyIdeaRequired": "Please enter a story idea.",
      "studio.cartoon.error.sceneRequired": "Please select a scene.",
      "studio.cartoon.error.characterRequired": "Please select at least one character.",
      "studio.cartoon.error.videoRequired": "Please select at least one video.",
      "studio.cartoon.error.uploadInProgress": "Please wait for the file upload to finish.",
      "studio.cartoon.error.uploadFailed": "The file could not be uploaded. Please try again.",
      "studio.cartoon.error.invalidImage": "Please select a valid image file.",
      "studio.cartoon.error.invalidAudio": "Please select a valid audio file.",
      "studio.cartoon.error.invalidVideo": "Please select a valid video file.",
      "studio.cartoon.error.insufficientCredit": "Insufficient credits.",
      "studio.cartoon.error.requestFailed": "Generation could not be started. Please try again.",
       "studio.cartoon.error.mediaPolicyBlocked": "This file cannot be used.",

      /* =========================
         PHOTOFX / FORM
         ========================= */

      "studio.photofx.title": "AI Photo Effect Video Clip",
      "studio.photofx.subtitle":
        "Turn a single photo into a short, animated and effect-rich social media clip.",

      "studio.photofx.promptHintTitle":
        "Describe the scene or make your photo speak. Write what you want to see in the video.",

      "studio.photofx.promptHintNote":
        "Describe the location, atmosphere, dialogue or short story, and AIVO will turn it into a video.",

      "studio.photofx.promptPlaceholder":
        "E.g. neon city at night, purple-blue tones, slow camera push-in, light glow, cinematic transitions, energetic social media clip",

      "studio.photofx.effectStyle.title": "Effect Style",
      "studio.photofx.effectStyle.subtitle":
        "You can select additional effect styles. Each selection adds 5 credits.",
      "studio.photofx.effectStyle.credit":
        "Per selection · +5 Credits",

      /* =========================
         PHOTOFX / PRESETS
         ========================= */

      "studio.photofx.preset.neonPulse.title": "Neon Pulse",
      "studio.photofx.preset.neonPulse.description":
        "Adds rhythmic energy with neon lines, flowing light and a subtle glow.",
      "studio.photofx.preset.neonPulse.use":
        "Best for: Night scenes, stylish and cool portraits.",

      "studio.photofx.preset.shakeEdit.title": "Shake Edit",
      "studio.photofx.preset.shakeEdit.description":
        "Creates beat-driven micro shakes and fast accent movements.",
      "studio.photofx.preset.shakeEdit.use":
        "Best for: Rap, trap and hard-hitting edits.",

      "studio.photofx.preset.glitchScan.title": "Glitch Scan",
      "studio.photofx.preset.glitchScan.description":
        "Adds digital distortion, RGB shifting and brief screen-break effects.",
      "studio.photofx.preset.glitchScan.use":
        "Best for: Dark, technological and aggressive visuals.",

      "studio.photofx.preset.splitFlash.title": "Split Flash",
      "studio.photofx.preset.splitFlash.description":
        "Splits the image and uses short flash transitions to create a strong attention effect.",
      "studio.photofx.preset.splitFlash.use":
        "Best for: Attention-grabbing Reels intros.",

      "studio.photofx.preset.cinematicZoom.title": "Cinematic Zoom",
      "studio.photofx.preset.cinematicZoom.description":
        "Creates a slow push-in, cinematic pan and subtle sense of depth.",
      "studio.photofx.preset.cinematicZoom.use":
        "Best for: Emotional, premium and slow-paced videos.",

      "studio.photofx.preset.auraGlow.title": "Aura Glow",
      "studio.photofx.preset.auraGlow.description":
        "Creates an energy ring and soft aura light around the person.",
      "studio.photofx.preset.auraGlow.use":
        "Best for: Dreamy, aesthetic and spiritual edits.",

      "studio.photofx.preset.fireEdge.title": "Fire Edge",
      "studio.photofx.preset.fireEdge.description":
        "Adds a strong effect with fire and warm light flowing along the edges.",
      "studio.photofx.preset.fireEdge.use":
        "Best for: Powerful, intense and epic visuals.",

      "studio.photofx.preset.darkTrapMotion.title": "Dark Trap Motion",
      "studio.photofx.preset.darkTrapMotion.description":
        "Applies dark contrast, hard zooms and a low-light editing style.",
      "studio.photofx.preset.darkTrapMotion.use":
        "Best for: Trap music and hard-profile videos.",

      "studio.photofx.preset.smokeFog.title": "Smoke Fog",
      "studio.photofx.preset.smokeFog.description":
        "Makes the scene more mysterious with dense fog, smoke layers and atmospheric haze.",
      "studio.photofx.preset.smokeFog.use":
        "Best for: Dark scenes, stage lighting and mysterious cinematic videos.",

      "studio.photofx.preset.festivalLaser.title": "Festival Laser",
      "studio.photofx.preset.festivalLaser.description":
        "Creates a powerful festival atmosphere with large background lasers and stage energy.",
      "studio.photofx.preset.festivalLaser.use":
        "Best for: Concerts, DJs, stage performances and energetic social media clips.",

      /* =========================
         PHOTOFX / SETTINGS
         ========================= */

      "studio.photofx.settings.title": "Clip Settings",
      "studio.photofx.settings.subtitle":
        "Set the output duration, aspect ratio, resolution, FPS and effect intensity.",
      "studio.photofx.settings.maxImageSize":
        "Maximum image size: 20 MB",

      "studio.photofx.field.mainImage": "Main Image",
      "studio.photofx.field.audioUpload": "Upload Audio",
      "studio.photofx.field.logoUpload": "Upload Logo",
      "studio.photofx.field.logoPosition": "Logo Position",

      "studio.photofx.badge.free": "Free",
      "studio.photofx.badge.plus10Credits": "+10 Credits",
      "studio.photofx.badge.included": "Included",

      "studio.photofx.action.chooseImage": "Select Image",
      "studio.photofx.action.chooseAudio": "Select Audio",
      "studio.photofx.action.chooseLogo": "Select Logo",
      "studio.photofx.action.removeSelectedFile":
        "Remove selected file",

      "studio.photofx.common.noFile": "No file selected",

      "studio.photofx.position.topLeft": "Top Left",
      "studio.photofx.position.topRight": "Top Right",
      "studio.photofx.position.bottomLeft": "Bottom Left",
      "studio.photofx.position.bottomRight": "Bottom Right",

      "studio.photofx.duration.label": "Clip Duration",
      "studio.photofx.duration.6": "6 seconds",
      "studio.photofx.duration.8": "8 seconds",
      "studio.photofx.duration.10": "10 seconds",
      "studio.photofx.duration.12": "12 seconds",
      "studio.photofx.duration.14": "14 seconds",
      "studio.photofx.duration.16": "16 seconds",
      "studio.photofx.duration.18": "18 seconds",
      "studio.photofx.duration.20": "20 seconds",

      "studio.photofx.aspectRatio.label": "Aspect Ratio",
      "studio.photofx.aspectRatio.auto": "Automatic",
      "studio.photofx.aspectRatio.vertical": "Vertical (9:16)",
      "studio.photofx.aspectRatio.horizontal": "Horizontal (16:9)",

      "studio.photofx.motion.label": "Motion Level",
      "studio.photofx.motion.soft": "Soft",
      "studio.photofx.motion.balanced": "Balanced",
      "studio.photofx.motion.strong": "Strong",

      "studio.photofx.effectPower.label": "Effect Power",
      "studio.photofx.effectPower.light": "Light",
      "studio.photofx.effectPower.medium": "Medium",
      "studio.photofx.effectPower.high": "High",

      "studio.photofx.colorMood.label": "Color Mood",
      "studio.photofx.colorMood.original": "Original",
      "studio.photofx.colorMood.cold": "Cool",
      "studio.photofx.colorMood.warm": "Warm",
      "studio.photofx.colorMood.neon": "Neon",
      "studio.photofx.colorMood.dark": "Dark",
      "studio.photofx.colorMood.cinematic": "Cinematic",

      "studio.photofx.transitionSpeed.label": "Transition Speed",
      "studio.photofx.transitionSpeed.slow": "Slow",
      "studio.photofx.transitionSpeed.normal": "Normal",
      "studio.photofx.transitionSpeed.fast": "Fast",

      /* =========================
         PHOTOFX / ENGINE
         ========================= */

      "studio.photofx.engine.title": "AIVO Photo Effect Engine",
      "studio.photofx.engine.subtitle":
        "Initial 20-second videos may take approximately 5–10 minutes depending on demand. Please wait until processing is complete.",

      "studio.photofx.generate": "🎬 Create Clip",
      "studio.photofx.generateWithCredit":
        "🎬 Create Clip ({count} Credits)",
      "studio.photofx.generating": "Generating...",

      /* =========================
         PHOTOFX / DYNAMIC
         ========================= */

      "studio.photofx.status.uploading": "Uploading...",
      "studio.photofx.status.uploadFailed": "Upload failed",
      "studio.photofx.status.fileUnavailable":
        "This file cannot be used",

      "studio.photofx.toast.imageAdded": "Image added.",
      "studio.photofx.toast.imageRemoved": "Image removed.",
      "studio.photofx.toast.logoAdded":
        "Logo added · +10 credits",
      "studio.photofx.toast.logoRemoved":
        "Logo removed · -10 credits",
      "studio.photofx.toast.audioAdded":
        "Music added · +10 credits",
      "studio.photofx.toast.audioRemoved":
        "Music removed · -10 credits",
      "studio.photofx.toast.presetSelected":
        "{name} selected · +5 credits",
      "studio.photofx.toast.presetRemoved":
        "{name} removed · -5 credits",
      "studio.photofx.toast.videoPreparing":
        "Video is being prepared.",
      "studio.photofx.toast.videoReady": "Video is ready.",
      "studio.photofx.toast.creditRefunded":
        "The operation failed and the credits were refunded.",
      "studio.photofx.toast.generationFailed":
        "Clip generation failed.",

      /* =========================
         PHOTOFX / ERRORS
         ========================= */

      "studio.photofx.error.promptRequired": "Enter a prompt.",
      "studio.photofx.error.imageRequired":
        "Please select a main image.",
      "studio.photofx.error.styleRequired":
        "Please select at least one effect style.",
      "studio.photofx.error.imageNotReady":
        "The main image is not ready yet.",
      "studio.photofx.error.audioNotReady":
        "The music file is not ready yet.",
      "studio.photofx.error.heicUnsupported":
        "HEIC is not supported · Upload a JPG or PNG file.",
      "studio.photofx.error.mediaPolicyBlocked":
        "This image cannot be used.",
      "studio.photofx.error.uploadFailed":
        "The file could not be uploaded. Please try again.",
      "studio.photofx.error.generationFailed":
        "The clip could not be created. Please try again.",
      "studio.photofx.error.insufficientCredit":
        "Insufficient credits.",

      "studio.photofx.policy.blocked":
        "Real artist names and political or public-figure names cannot be used. Describe the effect, transition and visual atmosphere instead of using a name.",

      /* =========================
         PHOTOFX / RESULTS PANEL
         ========================= */

      "studio.photofx.panel.title": "My PhotoFX Clips",
      "studio.photofx.panel.searchPlaceholder":
        "Search PhotoFX clips...",
      "studio.photofx.panel.empty": "No PhotoFX clips yet.",
      "studio.photofx.panel.noResults":
        "No PhotoFX clips match your search.",
      "studio.photofx.panel.untitled": "Untitled PhotoFX Clip",

      "studio.photofx.panel.status.ready": "Ready",
      "studio.photofx.panel.status.processing": "Processing",
      "studio.photofx.panel.status.preparing": "Preparing…",
      "studio.photofx.panel.status.failed": "Failed",

      "studio.photofx.panel.action.play": "Play",
      "studio.photofx.panel.action.pause": "Pause",
      "studio.photofx.panel.action.download": "Download video",
      "studio.photofx.panel.action.share": "Share video",
      "studio.photofx.panel.action.fullscreen": "Open fullscreen",
      "studio.photofx.panel.action.delete": "Delete video",
      "studio.photofx.panel.action.audioOn": "Turn sound on",
      "studio.photofx.panel.action.audioOff": "Turn sound off",

      "studio.photofx.panel.download.success":
        "The PhotoFX clip was downloaded.",
      "studio.photofx.panel.download.failed":
        "The PhotoFX clip could not be downloaded.",

      "studio.photofx.panel.delete.confirm":
        "Are you sure you want to delete this PhotoFX clip?",
      "studio.photofx.panel.delete.success":
        "The PhotoFX clip was deleted.",
         "studio.photofx.panel.delete.failed":
        "The PhotoFX clip could not be deleted.",

      /* =========================
         VIDEO / FORM
         ========================= */

      "studio.video.title":
        "Create AI Video",

      "studio.video.subtitle":
        "Create cinematic videos from text or images.",

      "studio.video.settings.duration":
        "Duration",

      "studio.video.settings.resolution":
        "Resolution",

      "studio.video.settings.aspectRatio":
        "Aspect Ratio",

      "studio.video.duration.5":
        "5 Seconds",

      "studio.video.duration.8":
        "8 Seconds",

      "studio.video.duration.10":
        "10 Seconds",

      "studio.video.resolution.720":
        "720p HD",

      "studio.video.resolution.1080":
        "1080p Full HD",

      "studio.video.ratio.wide":
        "Widescreen (16:9)",

      "studio.video.ratio.vertical":
        "Vertical (9:16)",

      /* =========================
         VIDEO / TABS
         ========================= */

      "studio.video.tab.text":
        "Text to Video",

      "studio.video.tab.image":
        "Image to Video",

      /* =========================
         VIDEO / TEXT TO VIDEO
         ========================= */

      "studio.video.text.title":
        "Video Description",

      "studio.video.text.maxCharacters":
        "Maximum 1000 characters",

      "studio.video.text.promptTip":
        "E.g. a neon city at night, purple-blue tones, slow camera movement, light fog and a cinematic atmosphere.",

      "studio.video.text.promptPlaceholder":
        "Video description (maximum 1000 characters)...",

      /* =========================
         VIDEO / IMAGE TO VIDEO
         ========================= */

      "studio.video.image.title":
        "Upload Image",

      "studio.video.image.fileFormats":
        "PNG / JPG – Maximum 10 MB",

      "studio.video.image.uploadPrompt":
        "Select an image or drag and drop it here",

      "studio.video.image.maxSize":
        "PNG / JPG • Maximum 10 MB",

      "studio.video.image.clearAria":
        "Remove uploaded image",

      "studio.video.image.clearTitle":
        "Remove image",

      "studio.video.image.promptTip":
        "E.g. slowly push the camera in with subtle parallax and light transitions.",

      "studio.video.image.promptPlaceholder":
        "How should the image be animated? (optional)",

      /* =========================
         VIDEO / GENERATION
         ========================= */

      "studio.video.credit.withCount":
        "{count} Credits",

      "studio.video.generate":
        "🎬 Create Video",

      "studio.video.generateWithCredit":
        "🎬 Create Video ({count} Credits)",

      "studio.video.generating":
        "Generating...",

      /* =========================
         VIDEO / UPLOAD STATUS
         ========================= */

      "studio.video.upload.selected":
        "Selected: {name}{size}",

      "studio.video.upload.uploading":
        "Selected: {name}{size} · Uploading...",

      "studio.video.upload.ready":
        "Selected: {name}{size} · Ready ✓",

      "studio.video.upload.policyBlocked":
        "Selected: {name}{size} · This image cannot be used",

      "studio.video.upload.failed":
        "Selected: {name}{size} · Upload failed",

      "studio.video.status.uploading":
        "Uploading...",

      "studio.video.status.ready":
        "Ready",

      "studio.video.status.uploadFailed":
        "Upload failed",

      "studio.video.status.imageUnavailable":
        "This image cannot be used",

      /* =========================
         VIDEO / TOAST
         ========================= */

      "studio.video.toast.creditDeducted":
        "{count} credits deducted.",

      "studio.video.toast.videoPreparing":
        "Video is being prepared.",

      "studio.video.toast.videoReady":
        "Video is ready.",

      "studio.video.toast.creditRefunded":
        "The operation failed and the credits were refunded.",

      "studio.video.toast.audioEnabled":
        "Audio generation enabled · +5 credits",

      "studio.video.toast.audioDisabled":
        "Audio generation disabled · -5 credits",

      "studio.video.toast.linkCopied":
        "Link copied.",

      /* =========================
         VIDEO / ERRORS
         ========================= */

      "studio.video.error.promptRequired":
        "Enter a prompt.",

      "studio.video.error.imageRequired":
        "Select an image.",

      "studio.video.error.imageUploading":
        "The image is still uploading.",

      "studio.video.error.imageUnavailable":
        "This image cannot be used.",

      "studio.video.error.uploadFailed":
        "Upload failed.",

      "studio.video.error.generationFailed":
        "The video could not be created. Please try again.",

      "studio.video.error.timeout":
        "Video generation timed out.",

      "studio.video.error.insufficientCredit":
        "Insufficient credits.",

      "studio.video.policy.blocked":
        "This request cannot be generated as written. Describe the video scene and action without using an artist or political figure's name.",

      /* =========================
         VIDEO / RESULTS PANEL
         ========================= */

      "studio.video.panel.title":
        "My Videos",

      "studio.video.panel.searchPlaceholder":
        "Search videos...",

      "studio.video.panel.empty":
        "No videos yet.",

      "studio.video.panel.noResults":
        "No videos match your search.",

      "studio.video.panel.dbUnavailable":
        "Video records could not be loaded.",

      "studio.video.panel.untitled":
        "Untitled Video",

      "studio.video.panel.imageToVideo":
        "Image to Video",

      "studio.video.panel.textToVideo":
        "Text to Video",

      "studio.video.panel.status.ready":
        "Ready",

      "studio.video.panel.status.processing":
        "Processing",

      "studio.video.panel.status.preparing":
        "Preparing…",

      "studio.video.panel.status.failed":
        "Failed",

      "studio.video.panel.action.play":
        "Play",

      "studio.video.panel.action.pause":
        "Pause",

      "studio.video.panel.action.download":
        "Download video",

      "studio.video.panel.action.share":
        "Share video",

      "studio.video.panel.action.fullscreen":
        "Open fullscreen",

      "studio.video.panel.action.delete":
        "Delete video",

      "studio.video.panel.action.audioOn":
        "Turn sound on",

      "studio.video.panel.action.audioOff":
        "Turn sound off",

      "studio.video.panel.download.success":
        "The video was downloaded.",

      "studio.video.panel.download.failed":
        "The video could not be downloaded.",

      "studio.video.panel.delete.success":
        "The video was deleted.",

      "studio.video.panel.delete.failed":
        "The video could not be deleted.",

         "studio.video.panel.share.copied":
        "The video link was copied.",

      /* =========================
         LIPSYNC / FORM
         ========================= */

      "studio.lipsync.title":
        "AI Lip-Sync Video",

      "studio.lipsync.subtitle":
        "Upload a photo, enter text or add an audio file. Credits are calculated based on the estimated speech duration.",

      "studio.lipsync.speech.title":
        "Speech",

      "studio.lipsync.speech.subtitle":
        "Enter text or upload a ready-made audio file.",

      "studio.lipsync.action.recordAudio":
        "Record audio",

      "studio.lipsync.action.uploadAudio":
        "Upload an audio file",

      "studio.lipsync.script.placeholder":
        "What do you want the character to say? Enter the text here...",

      "studio.lipsync.audio.none":
        "No audio uploaded.",

      /* =========================
         LIPSYNC / VOICES
         ========================= */

      "studio.lipsync.voice.tranquilTulin":
        "Voice: Tranquil Tülin",

      "studio.lipsync.voice.iker":
        "Voice: Iker",

      "studio.lipsync.voice.deepDieter":
        "Voice: Deep Dieter",

      "studio.lipsync.voice.william":
        "Voice: William Prescott",

      "studio.lipsync.voice.menon":
        "Voice: Menon",

      "studio.lipsync.voice.knox":
        "Voice: Knox",

      "studio.lipsync.voice.aaron":
        "Voice: Aaron",

      "studio.lipsync.voice.lily":
        "Voice: Lily",

      "studio.lipsync.voice.april":
        "Voice: April",

      "studio.lipsync.voice.tiffany":
        "Voice: Tiffany",

      "studio.lipsync.voice.brianna":
        "Voice: Brianna",

      "studio.lipsync.voice.evelyn":
        "Voice: Evelyn Harper",

      "studio.lipsync.voice.laurel":
        "Voice: Laurel",

      "studio.lipsync.voice.seena":
        "Voice: Seena Professional",

      "studio.lipsync.voice.preview":
        "Preview voice",

      "studio.lipsync.voice.previewUnavailable":
        "No preview is available for this voice.",

      "studio.lipsync.voice.previewFailed":
        "The voice preview could not be played.",

      /* =========================
         LIPSYNC / PHOTO
         ========================= */

      "studio.lipsync.photo.title":
        "Upload Photo",

      "studio.lipsync.photo.requirements":
        "The face must be clearly visible • JPG/PNG • At least 300×300 px",

      "studio.lipsync.photo.remove":
        "Remove photo",

      "studio.lipsync.photo.defaultName":
        "Photo",

      /* =========================
         LIPSYNC / VOICE SETTINGS
         ========================= */

      "studio.lipsync.settings.title":
        "Voice Settings",

      "studio.lipsync.settings.subtitle":
        "Adjust the speech speed and volume.",

      "studio.lipsync.settings.textOnly":
        "Only applies to text generation.",

      "studio.lipsync.settings.speed":
        "Speed",

      "studio.lipsync.settings.speed.slow":
        "Slow",

      "studio.lipsync.settings.speed.normal":
        "Normal",

      "studio.lipsync.settings.speed.fast":
        "Fast",

      "studio.lipsync.settings.volume":
        "Volume",

      /* =========================
         LIPSYNC / CREDIT INFO
         ========================= */

      "studio.lipsync.credit.title":
        "Credit and Duration Information",

      "studio.lipsync.credit.rule":
        "Credits are calculated based on speech duration. Every started 2 seconds costs 3 credits.",

      "studio.lipsync.credit.maximum":
        "A maximum of 60 seconds can be generated in a single video.",

      "studio.lipsync.estimate":
        "Estimated: {seconds} sec • {credits} credits",

      /* =========================
         LIPSYNC / GENERATION
         ========================= */

      "studio.lipsync.generate":
        "Generate Lip-Sync Video",

      "studio.lipsync.generateWithCredit":
        "Generate Lip-Sync Video ({count} Credits)",

      "studio.lipsync.generationBlocked":
        "Generation Blocked",

      "studio.lipsync.status.photoUploading":
        "Uploading photo...",

      "studio.lipsync.status.audioUploading":
        "Uploading audio...",

      "studio.lipsync.status.videoPreparing":
        "Preparing video...",

      /* =========================
         LIPSYNC / RECORD MODAL
         ========================= */

      "studio.lipsync.record.title":
        "Record Audio",

      "studio.lipsync.record.tab.record":
        "Recording",

      "studio.lipsync.record.tab.upload":
        "Upload Audio",

      "studio.lipsync.record.description":
        "Create an audio recording. The character will lip-sync to this audio.",

      "studio.lipsync.record.microphoneWaiting":
        "🎙 Waiting for the microphone...",

      "studio.lipsync.record.uploadTitle":
        "Upload an audio file",

      "studio.lipsync.record.uploadDescription":
        "Select an MP3, WAV or WEBM file",

      "studio.lipsync.record.audioWaiting":
        "Waiting for an audio file...",

      "studio.lipsync.record.uploadedReady":
        "Uploaded audio is ready",

      "studio.lipsync.record.recordedReady":
        "Recorded audio is ready",

      "studio.lipsync.record.use":
        "Use",

      "studio.lipsync.record.listenAudio":
        "Listen to audio",

      "studio.lipsync.record.listenRecording":
        "Listen to recording",

      "studio.lipsync.record.removeAudio":
        "Delete audio",

      "studio.lipsync.record.removeRecording":
        "Delete recording",

      "studio.lipsync.record.preparing":
        "⏳ Preparing recording...",

      "studio.lipsync.record.notFound":
        "No recording was found.",

      "studio.lipsync.record.selected":
        "Recording selected.",

      "studio.lipsync.record.audioReady":
        "🎧 Audio ready: {name}",

      "studio.lipsync.record.recordingReady":
        "🎙 Recording ready: {name}",

      "studio.lipsync.record.recording":
        "Recording",

      "studio.lipsync.record.stopHint":
        "Press again to stop",

      "studio.lipsync.record.recordingDevice":
        "🔴 Recording... Press again to stop.",

      "studio.lipsync.record.microphoneDenied":
        "Microphone permission could not be obtained.",

      /* =========================
         LIPSYNC / TOASTS
         ========================= */

      "studio.lipsync.toast.maximumDuration":
        "The maximum speech duration is 60 seconds.",

      "studio.lipsync.toast.audioSelected":
        "Audio file selected.",

      "studio.lipsync.toast.recordSelected":
        "Recording selected.",

      "studio.lipsync.toast.audioRemoved":
        "Audio removed.",

      "studio.lipsync.toast.audioPlayFailed":
        "The audio could not be played.",

      "studio.lipsync.toast.audioNotFound":
        "No audio is available to play.",

      "studio.lipsync.toast.microphoneDenied":
        "Microphone permission could not be obtained.",

      "studio.lipsync.toast.creditDeducted":
        "{count} credits deducted.",

      "studio.lipsync.toast.videoPreparing":
        "Video is being prepared...",

      "studio.lipsync.toast.videoReady":
        "The lip-sync video is ready.",

      "studio.lipsync.toast.creditRefunded":
        "The operation failed and the credits were refunded.",

      "studio.lipsync.toast.generationFailed":
        "Lip-sync generation failed.",

      "studio.lipsync.toast.timeout":
        "Lip-sync generation timed out.",

      /* =========================
         LIPSYNC / ERRORS
         ========================= */

      "studio.lipsync.error.badLanguage":
        "Generation could not be started because this text contains inappropriate language. Enter text without profanity, insults or hate speech.",

      "studio.lipsync.error.speechOrAudioRequired":
        "Enter speech text or select an audio file.",

      "studio.lipsync.error.contentTooLong":
        "This content is approximately {seconds} seconds long. The maximum duration is 60 seconds.",

      "studio.lipsync.error.scriptTooLong":
        "This text is too long for the selected duration. Enter shorter text or select a longer duration.",

      "studio.lipsync.error.photoRequired":
        "Upload a photo.",

      "studio.lipsync.error.photoUploadFailed":
        "The photo could not be uploaded.",

      "studio.lipsync.error.audioUploadFailed":
        "The audio file could not be uploaded.",

      "studio.lipsync.error.mediaPolicyBlocked":
        "This image cannot be used.",

      "studio.lipsync.error.insufficientCredit":
        "Insufficient credits.",

      "studio.lipsync.error.policyGenerationFailed":
        "The video could not be created because the text contains inappropriate language.",

      "studio.lipsync.error.generationFailed":
        "The video could not be created. Check the text or content and try again.",

      /* =========================
         LIPSYNC / RESULTS PANEL
         ========================= */

      "studio.lipsync.panel.title":
        "My Lip-Sync Videos",

      "studio.lipsync.panel.meta.preparing":
        "Preparing",

      "studio.lipsync.panel.searchPlaceholder":
        "Search lip-sync videos...",

      "studio.lipsync.panel.empty":
        "No lip-sync videos yet.",

      "studio.lipsync.panel.noResults":
        "No lip-sync videos match your search.",

      "studio.lipsync.panel.audioTitle":
        "Audio: {name}",

      "studio.lipsync.panel.defaultTitle":
        "Lip-Sync Video",

      "studio.lipsync.panel.status.ready":
        "Ready",

      "studio.lipsync.panel.status.processing":
        "Processing",

      "studio.lipsync.panel.status.preparing":
        "Preparing…",

      "studio.lipsync.panel.status.failed":
        "Failed",

      "studio.lipsync.panel.action.play":
        "Play",

      "studio.lipsync.panel.action.pause":
        "Pause",

      "studio.lipsync.panel.action.download":
        "Download video",

      "studio.lipsync.panel.action.share":
        "Share video",

      "studio.lipsync.panel.action.fullscreen":
        "Open fullscreen",

      "studio.lipsync.panel.action.delete":
        "Delete video",

      "studio.lipsync.panel.action.audioOn":
        "Turn sound on",

      "studio.lipsync.panel.action.audioOff":
        "Turn sound off",

      "studio.lipsync.panel.download.success":
        "The lip-sync video was downloaded.",

      "studio.lipsync.panel.download.failed":
        "The lip-sync video could not be downloaded.",

      "studio.lipsync.panel.share.copied":
        "The lip-sync video link was copied.",

      "studio.lipsync.panel.delete.success":
        "The lip-sync video was deleted.",

         "studio.lipsync.panel.delete.failed":
        "The lip-sync video could not be deleted.",

      /* =========================
         PROFILE / PAGE
         ========================= */

      "studio.profile.title":
        "Profile",

      "studio.profile.subtitle":
        "Your account information, plan and usage details are shown here.",

      "studio.profile.action.buyCredits":
        "Buy Credits",

      "studio.profile.action.upgradePlan":
        "Upgrade Plan",

      /* =========================
         PROFILE / INFORMATION
         ========================= */

      "studio.profile.info.title":
        "Profile Information",

      "studio.profile.info.subtitle":
        "Your personal account information",

      "studio.profile.field.name":
        "First Name",

      "studio.profile.field.namePlaceholder":
        "Your first name",

      "studio.profile.field.surname":
        "Last Name",

      "studio.profile.field.surnamePlaceholder":
        "Your last name",

      "studio.profile.field.email":
        "Email",

      "studio.profile.field.emailLocked":
        "The email address cannot be changed for security reasons.",

      "studio.profile.action.save":
        "Update Profile",

      /* =========================
         PROFILE / SECURITY
         ========================= */

      "studio.profile.security.title":
        "Security",

      "studio.profile.security.subtitle":
        "Password and account security",

      "studio.profile.security.description":
        "Update your password regularly to keep your account secure.",

      "studio.profile.security.changePassword":
        "Change Password",

      /* =========================
         PROFILE / USAGE
         ========================= */

      "studio.profile.usage.title":
        "Usage Statistics",

      "studio.profile.usage.subtitle":
        "Summary for this month",

      "studio.profile.usage.music":
        "AI Music Creations",

      "studio.profile.usage.cover":
        "AI Cover Art Creations",

      "studio.profile.usage.atmo":
        "AI Atmosphere Videos",

      "studio.profile.usage.cartoon":
        "AI Kids Cartoons",

      "studio.profile.usage.photofx":
        "AI Photo Effect Video Clips",

      "studio.profile.usage.imageToVideo":
        "AI Image-to-Video Creations",

      "studio.profile.usage.spentCredits":
        "Credits spent",

      "studio.profile.usage.totalCredits":
        "Total credits",

      "studio.profile.usage.goLibrary":
        "Go to My Creations",

      /* =========================
         PROFILE / DYNAMIC
         ========================= */

      "studio.profile.userFallback":
        "User",

      "studio.profile.planPrefix":
        "Plan: {plan}",

      "studio.profile.creditPrefix":
        "Credits: {credit}",

      "studio.profile.error.nameRequired":
        "The first name field cannot be empty.",

      "studio.profile.toast.saved":
        "Profile updated.",

      "studio.profile.toast.saveFailed":
        "The profile could not be saved.",

      /* =========================
         PROFILE / PASSWORD MODAL
         ========================= */

      "studio.profile.password.title":
        "Change Password",

      "studio.profile.password.subtitle":
        "Use a strong password to keep your account secure.",

      "studio.profile.password.close":
        "Close",

      "studio.profile.password.current":
        "Current Password",

      "studio.profile.password.currentPlaceholder":
        "Your current password",

      "studio.profile.password.new":
        "New Password",

      "studio.profile.password.newPlaceholder":
        "New password",

      "studio.profile.password.confirm":
        "Confirm New Password",

      "studio.profile.password.confirmPlaceholder":
        "Enter the new password again",

      "studio.profile.password.hint":
        "Use at least 8 characters, preferably including letters, numbers and symbols.",

      "studio.profile.password.cancel":
        "Cancel",

      "studio.profile.password.update":
        "Update Password",

      "studio.profile.password.error.allFields":
        "Please complete all fields.",

      "studio.profile.password.error.tooShort":
        "The new password must be at least 8 characters.",

      "studio.profile.password.error.mismatch":
        "The new passwords do not match.",

      "studio.profile.password.error.currentInvalid":
        "The current password is incorrect.",

      "studio.profile.password.error.sameAsOld":
        "The new password cannot be the same as the current password.",

      "studio.profile.password.error.updateFailed":
        "The password could not be updated.",

      "studio.profile.password.toast.updated":
        "Password updated successfully.",

      /* =========================
         PROFILE / RIGHT PANEL
         ========================= */

      "studio.profile.panel.title":
        "Profile",

      "studio.profile.panel.subtitle":
        "Account summary",

      "studio.profile.panel.account":
        "Account",

      "studio.profile.panel.user":
        "User",

      "studio.profile.panel.email":
        "Email",

      "studio.profile.panel.credits":
        "Credits",

      "studio.profile.panel.total":
        "Total",

      "studio.profile.panel.spent":
        "Spent",

      "studio.profile.panel.shortcuts":
        "Shortcuts",

      "studio.profile.panel.buyCredits":
        "Buy Credits",

      "studio.profile.panel.library":
        "My Creations",

         "studio.profile.panel.hint":
        "Your profile summary and quick access options are shown in this panel.",

      /* =========================
         INVOICES / PAGE
         ========================= */

      "studio.invoices.title":
        "My Invoices",

      "studio.invoices.subtitle":
        "Invoices and payment documents for your past purchases are listed here.",

      "studio.invoices.filter.all":
        "All",

      "studio.invoices.filter.purchase":
        "Purchases",

      "studio.invoices.filter.refund":
        "Refunds",

      "studio.invoices.listLabel":
        "Invoice list",

      "studio.invoices.empty.default":
        "You do not have any invoice records yet. They will appear here after you purchase credits.",

      "studio.invoices.more":
        "Load More",

      /* =========================
         INVOICES / EMPTY & ERRORS
         ========================= */

      "studio.invoices.empty.filtered":
        "No invoices match this filter.",

      "studio.invoices.empty.sessionMissing":
        "Session information could not be found to display invoices.",

      "studio.invoices.empty.loadFailed":
        "Invoices could not be loaded right now.",

      /* =========================
         INVOICES / TYPE & STATUS
         ========================= */

      "studio.invoices.type.purchase":
        "Purchase",

      "studio.invoices.type.refund":
        "Refund",

      "studio.invoices.status.paid":
        "Paid",

      "studio.invoices.status.pending":
        "Pending",

      "studio.invoices.status.ready":
        "Ready",

      "studio.invoices.status.refunded":
        "Refunded",

      "studio.invoices.status.failed":
        "Failed",

      "studio.invoices.status.canceled":
        "Canceled",

      /* =========================
         INVOICES / CARD
         ========================= */

      "studio.invoices.recordTitle":
        "AIVO INVOICE RECORD",

      "studio.invoices.defaultPurchaseTitle":
        "Purchase",

      "studio.invoices.package.withCredits":
        "{count}-Credit Package",

      "studio.invoices.package.default":
        "Credit Package",

      "studio.invoices.package.creditDefinition":
        "A total of {count} credits",

      "studio.invoices.package.purchaseDetail":
        "Purchase details",

      "studio.invoices.field.date":
        "Date",

      "studio.invoices.field.status":
        "Status",

      "studio.invoices.field.paymentAmount":
        "Payment Amount",

      "studio.invoices.field.refundAmount":
        "Refund Amount",

      "studio.invoices.detail.purchase":
        "The package payment was completed successfully.",

      "studio.invoices.detail.refund":
        "The transaction was processed as a refund.",

      "studio.invoices.action.openInvoice":
        "View Invoice",

      "studio.invoices.action.openRefund":
        "Open Refund Document",

      "studio.invoices.action.documentUnavailable":
        "Document Not Ready",

      /* =========================
         INVOICES / RIGHT PANEL
         ========================= */

      "studio.invoices.panel.title":
        "My Invoices",

      "studio.invoices.panel.subtitle":
        "Billing summary and quick access",

      "studio.invoices.panel.meta":
        "Billing summary",

      "studio.invoices.panel.tips":
        "Tips",

      "studio.invoices.panel.tip.list":
        "Invoice details are listed in the main panel.",

      "studio.invoices.panel.tip.records":
        "Purchase and refund records are shown on the cards in the main area.",

         "studio.invoices.panel.tip.documents":
        "Documents can be opened and reviewed from the main panel.",

      /* =========================
         SETTINGS / PAGE
         ========================= */

      "studio.settings.title":
        "Settings",

      "studio.settings.subtitle":
        "Manage application preferences and account settings.",

      "studio.settings.save":
        "Save Settings",

      "studio.settings.categories.label":
        "Settings Categories",

      "studio.settings.categories.title":
        "Settings Categories",

      "studio.settings.categories.subtitle":
        "Choose a category and edit its settings.",

      "studio.settings.tab.notifications":
        "Notifications",

      "studio.settings.tab.music":
        "Music",

      "studio.settings.tab.privacy":
        "Privacy",

      "studio.settings.tab.security":
        "Account & Security",

      "studio.settings.tab.data":
        "Data Rights",

      /* =========================
         SETTINGS / NOTIFICATIONS
         ========================= */

      "studio.settings.notifications.title":
        "Notification Settings",

      "studio.settings.notifications.subtitle":
        "Choose which notifications you want to receive.",

      "studio.settings.notifications.email.title":
        "Email Notifications",

      "studio.settings.notifications.email.subtitle":
        "Receive emails about important events.",

      "studio.settings.notifications.done.title":
        "When music generation is complete",

      "studio.settings.notifications.done.subtitle":
        "Receive an email when your song is ready.",

      "studio.settings.notifications.lowCredit.title":
        "When credits are low",

      "studio.settings.notifications.lowCredit.subtitle":
        "Receive an alert when your credits fall below a certain level.",

      "studio.settings.notifications.weekly.title":
        "Weekly report",

      "studio.settings.notifications.weekly.subtitle":
        "Receive a weekly activity summary.",

      "studio.settings.notifications.promos.title":
        "Promotions and campaigns",

      "studio.settings.notifications.promos.subtitle":
        "Stay informed about special offers.",

      /* =========================
         SETTINGS / MUSIC
         ========================= */

      "studio.settings.music.title":
        "Music Settings",

      "studio.settings.music.subtitle":
        "Configure playback and generation preferences.",

      "studio.settings.music.quality.title":
        "Default Quality",

      "studio.settings.music.quality.subtitle":
        "The default audio quality used for generation and downloads.",

      "studio.settings.music.quality.low.title":
        "Low",

      "studio.settings.music.quality.low.subtitle":
        "128 kbps – Faster generation and less data usage",

      "studio.settings.music.quality.high.title":
        "High",

      "studio.settings.music.quality.high.subtitle":
        "256 kbps – Balanced quality (recommended)",

      "studio.settings.music.quality.studio.title":
        "Studio",

      "studio.settings.music.quality.studio.subtitle":
        "320 kbps – Highest quality",

      "studio.settings.music.autoplay.title":
        "Autoplay",

      "studio.settings.music.autoplay.subtitle":
        "Automatically play music when generation is complete.",

      "studio.settings.music.volume.title":
        "Default Volume",

      "studio.settings.music.volume.subtitle":
        "The initial volume level when the player opens.",

      "studio.settings.music.volume.silent":
        "Mute",

      "studio.settings.music.volume.maximum":
        "Maximum",

      /* =========================
         SETTINGS / PRIVACY
         ========================= */

      "studio.settings.privacy.title":
        "Privacy Settings",

      "studio.settings.privacy.subtitle":
        "Control how your data is used.",

      "studio.settings.privacy.visibility.title":
        "Profile Visibility",

      "studio.settings.privacy.visibility.subtitle":
        "Choose who can view your profile.",

      "studio.settings.privacy.visibility.public.title":
        "Public",

      "studio.settings.privacy.visibility.public.subtitle":
        "Your profile can be viewed by anyone.",

      "studio.settings.privacy.visibility.private.title":
        "Private",

      "studio.settings.privacy.visibility.private.subtitle":
        "Only you can view your profile.",

      "studio.settings.privacy.activity.title":
        "Activity sharing",

      "studio.settings.privacy.activity.subtitle":
        "Your generation activity, including titles and types, may appear on your profile.",

      "studio.settings.privacy.analytics.title":
        "Anonymous data collection",

      "studio.settings.privacy.analytics.subtitle":
        "Anonymous usage data used to improve the application.",

      /* =========================
         SETTINGS / SECURITY
         ========================= */

      "studio.settings.security.title":
        "Account & Security",

      "studio.settings.security.subtitle":
        "Manage session duration and security preferences.",

      "studio.settings.security.session.title":
        "Session Duration",

      "studio.settings.security.session.subtitle":
        "Automatically log out after a period of inactivity.",

      "studio.settings.security.timeout.title":
        "Automatic logout time",

      "studio.settings.security.timeout.subtitle":
        "MVP: only the preference is saved; backend support will be added later.",

      "studio.settings.security.timeout.off":
        "Off (Remember me on this device)",

      "studio.settings.security.timeout.15m":
        "15 minutes",

      "studio.settings.security.timeout.30m":
        "30 minutes",

      "studio.settings.security.timeout.1h":
        "1 hour",

      "studio.settings.security.timeout.6h":
        "6 hours",

      "studio.settings.security.timeout.24h":
        "24 hours",

      "studio.settings.security.devices.title":
        "Active Devices",

      "studio.settings.security.devices.subtitle":
        "Review the devices where your account is signed in.",

      "studio.settings.security.devices.list.title":
        "Device list",

      "studio.settings.security.devices.list.subtitle":
        "MVP: the list will be provided by the backend. This section is currently for information only.",

      "studio.settings.security.comingSoon":
        "Coming Soon",

      "studio.settings.security.twoFactor.title":
        "Two-Factor Authentication (2FA)",

      "studio.settings.security.twoFactor.subtitle":
        "MVP framework. The setup flow will be added later.",

      "studio.settings.security.twoFactor.enable.title":
        "Enable 2FA",

      "studio.settings.security.twoFactor.enable.subtitle":
        "Currently disabled (coming soon).",

      /* =========================
         SETTINGS / DATA RIGHTS
         ========================= */

      "studio.settings.data.title":
        "Data Rights",

      "studio.settings.data.subtitle":
        "Manage data download, correction and deletion requests.",

      "studio.settings.data.access.title":
        "Access My Data",

      "studio.settings.data.access.subtitle":
        "Download a copy of your personal data.",

      "studio.settings.data.format.title":
        "Format",

      "studio.settings.data.format.subtitle":
        "Only JSON is currently available; ZIP support will be added later.",

      "studio.settings.data.format.json":
        "JSON",

      "studio.settings.data.format.zipSoon":
        "ZIP (coming soon)",

      "studio.settings.data.export.note":
        "MVP: this feature will be activated when the API is connected.",

      "studio.settings.data.export.download":
        "Download My Data",

      "studio.settings.data.rectification.title":
        "Correction Request",

      "studio.settings.data.rectification.subtitle":
        "Create a request for incorrect or incomplete data.",

      "studio.settings.data.rectification.placeholder":
        "Briefly describe your correction request…",

      "studio.settings.data.rectification.note":
        "The request is currently recorded and an informational notification is displayed.",

      "studio.settings.data.rectification.submit":
        "Submit Correction Request",

      "studio.settings.data.delete.title":
        "Deletion Request (Right to Be Forgotten)",

      "studio.settings.data.delete.subtitle":
        "Request deletion of your account and content in the future.",

      "studio.settings.data.delete.warning":
        "Warning: This request may close your account and permanently delete your content.",

      "studio.settings.data.delete.ack":
        "“I understand” confirmation (MVP) — the deletion flow will be connected later.",

      "studio.settings.data.delete.submit":
        "Submit Deletion Request",

      /* =========================
         SETTINGS / DYNAMIC
         ========================= */

      "studio.settings.toast.saved":
        "Settings saved",

      "studio.settings.toast.rectificationReceived":
        "Correction request received",

      "studio.settings.toast.exportReady":
        "Export ready: aivo-export.json downloaded",

      "studio.settings.toast.exportFailed":
        "The export could not be created",

      "studio.settings.toast.downloadFailed":
        "The export could not be downloaded.",

      "studio.settings.export.metaNote":
        "Temporary MVP export: a snapshot of localStorage and application data. This will be replaced by the real export when the backend is integrated.",

      /* =========================
         SETTINGS / RIGHT PANEL
         ========================= */

      "studio.settings.panel.title":
        "Settings",

      "studio.settings.panel.subtitle":
        "Contextual help and quick information",

      "studio.settings.panel.activeCategory":
        "Active Category",

      "studio.settings.panel.quickNotes":
        "Quick Notes",

      "studio.settings.panel.helperNote":
        "Helpful Note",

      "studio.settings.panel.panelNote":
        "Panel Note",

      "studio.settings.panel.panelNoteText":
        "This area only shows a summary and helpful information for the active settings tab.",

      "studio.settings.panel.footer":
        "This right panel is a summary and guidance area. The form fields belong to the main panel.",

      "studio.settings.panel.notifications.title":
        "Notifications",

      "studio.settings.panel.notifications.subtitle":
        "Notification preferences and information flow",

      "studio.settings.panel.notifications.bullet1":
        "Email notifications control generation, credit and campaign updates.",

      "studio.settings.panel.notifications.bullet2":
        "Browser notifications may currently use MVP or placeholder behavior.",

      "studio.settings.panel.notifications.bullet3":
        "Settings are saved using the Save Settings action in the main panel.",

      "studio.settings.panel.notifications.hint":
        "Priority: keep only the notifications that are genuinely necessary.",

      "studio.settings.panel.music.title":
        "Music",

      "studio.settings.panel.music.subtitle":
        "Quality, autoplay and volume preferences",

      "studio.settings.panel.music.bullet1":
        "Default quality affects the generation and download experience.",

      "studio.settings.panel.music.bullet2":
        "Autoplay affects player behavior after the page opens.",

      "studio.settings.panel.music.bullet3":
        "The volume label must remain synchronized with the range input.",

      "studio.settings.panel.music.hint":
        "Priority: keep quality, autoplay and volume consistent with one another.",

      "studio.settings.panel.privacy.title":
        "Privacy",

      "studio.settings.panel.privacy.subtitle":
        "Profile visibility and data-sharing preferences",

      "studio.settings.panel.privacy.bullet1":
        "Profile visibility is stored as either public or private.",

      "studio.settings.panel.privacy.bullet2":
        "Activity sharing affects whether generation activity appears on the profile.",

      "studio.settings.panel.privacy.bullet3":
        "Anonymous data collection is a separate preference used to improve the application.",

      "studio.settings.panel.privacy.hint":
        "Priority: do not confuse profile visibility with anonymous data preferences.",

      "studio.settings.panel.security.title":
        "Account & Security",

      "studio.settings.panel.security.subtitle":
        "Session duration and security preferences",

      "studio.settings.panel.security.bullet1":
        "The selected session duration is currently stored in local state.",

      "studio.settings.panel.security.bullet2":
        "The 2FA area may currently be in a preparation or placeholder stage.",

      "studio.settings.panel.security.bullet3":
        "The security idle-timeout flow is one of the components to be moved from the previous owner structure.",

      "studio.settings.panel.security.hint":
        "Priority: clarify session-timeout behavior in the new owner structure.",

      "studio.settings.panel.data.title":
        "Data Rights",

      "studio.settings.panel.data.subtitle":
        "Data download, correction and deletion requests",

      "studio.settings.panel.data.bullet1":
        "The data download area works together with the selected export format.",

      "studio.settings.panel.data.bullet2":
        "The correction-request textarea content is stored in local state.",

      "studio.settings.panel.data.bullet3":
        "Deletion-request confirmation is handled as a separate security step.",

      "studio.settings.panel.data.hint":
        "Priority: preserve the pane boundaries for export, correction and deletion areas.",

      /* =========================
         SUPPORT
         ========================= */

      "studio.support":
        "Support Center"
    }
  };

  function normalizeLanguage(value) {
    var language = String(value || "")
      .trim()
      .toLowerCase();

    if (
      SUPPORTED_LANGS.indexOf(language) !== -1
    ) {
      return language;
    }

    if (language.indexOf("en") === 0) {
      return "en";
    }

    if (language.indexOf("tr") === 0) {
      return "tr";
    }

    return "";
  }

  function getLanguage() {
    return (
      normalizeLanguage(
        window.AIVO_LANG
      ) ||
      normalizeLanguage(
        document.documentElement.lang
      ) ||
      DEFAULT_LANG
    );
  }

  function formatText(
    value,
    parameters
  ) {
    var output =
      String(
        value == null
          ? ""
          : value
      );

    if (
      !parameters ||
      typeof parameters !== "object"
    ) {
      return output;
    }

    Object.keys(parameters)
      .forEach(function (key) {
        var pattern =
          new RegExp(
            "\\{" + key + "\\}",
            "g"
          );

        output =
          output.replace(
            pattern,
            String(parameters[key])
          );
      });

    return output;
  }

  function hasOwn(
    object,
    key
  ) {
    return Object.prototype
      .hasOwnProperty
      .call(object, key);
  }

  function translate(
    key,
    fallback,
    parameters
  ) {
    var language =
      getLanguage();

    var translated = "";

    try {
      if (
        typeof window.t === "function"
      ) {
        translated =
          window.t(
            key,
            parameters
          );

        if (
          translated &&
          translated !== key
        ) {
          return formatText(
            translated,
            parameters
          );
        }
      }
    } catch (_) {}

    var activePack =
      DICTIONARY[language] ||
      DICTIONARY[DEFAULT_LANG];

    var fallbackPack =
      DICTIONARY[DEFAULT_LANG] ||
      {};

    if (
      activePack &&
      hasOwn(activePack, key)
    ) {
      return formatText(
        activePack[key],
        parameters
      );
    }

    if (
      fallbackPack &&
      hasOwn(fallbackPack, key)
    ) {
      return formatText(
        fallbackPack[key],
        parameters
      );
    }

    return formatText(
      fallback || key,
      parameters
    );
  }

  function mergeDictionary() {
    if (
      !window.AIVO_I18N ||
      !window.AIVO_I18N.tr ||
      !window.AIVO_I18N.en
    ) {
      return false;
    }

    Object.assign(
      window.AIVO_I18N.tr,
      DICTIONARY.tr
    );

    Object.assign(
      window.AIVO_I18N.en,
      DICTIONARY.en
    );

    return true;
  }

  function apply(root) {
    mergeDictionary();

    if (
      typeof window.aivoApplyI18n !==
      "function"
    ) {
      return false;
    }

    try {
      window.aivoApplyI18n(
        root || document
      );

      return true;
    } catch (error) {
      console.error(
        "[AIVO Studio i18n] apply failed:",
        error
      );

      return false;
    }
  }

  function register(
    language,
    values
  ) {
    var normalized =
      normalizeLanguage(language);

    if (
      !normalized ||
      !values ||
      typeof values !== "object"
    ) {
      return false;
    }

    Object.assign(
      DICTIONARY[normalized],
      values
    );

    mergeDictionary();
    apply(document);

    return true;
  }

  function registerPack(pack) {
    if (
      !pack ||
      typeof pack !== "object"
    ) {
      return false;
    }

    if (pack.tr) {
      register(
        "tr",
        pack.tr
      );
    }

    if (pack.en) {
      register(
        "en",
        pack.en
      );
    }

    return true;
  }

  function containsI18nTarget(
    element
  ) {
    if (
      !element ||
      element.nodeType !== 1
    ) {
      return false;
    }

    if (
      element.matches(
        "[data-i18n]," +
        "[data-i18n-html]," +
        "[data-i18n-placeholder]," +
        "[data-i18n-label]," +
        "[data-i18n-title]," +
        "[data-i18n-alt]," +
        "[data-i18n-attr]"
      )
    ) {
      return true;
    }

    return !!element.querySelector(
      "[data-i18n]," +
      "[data-i18n-html]," +
      "[data-i18n-placeholder]," +
      "[data-i18n-label]," +
      "[data-i18n-title]," +
      "[data-i18n-alt]," +
      "[data-i18n-attr]"
    );
  }

  function queueRoot(root) {
    if (
      !root ||
      root.nodeType !== 1
    ) {
      return;
    }

    if (
      pendingRoots.indexOf(root) === -1
    ) {
      pendingRoots.push(root);
    }

    if (observerFrame) {
      return;
    }

    observerFrame =
      window.requestAnimationFrame(
        function () {
          observerFrame = 0;

          var roots =
            pendingRoots.slice();

          pendingRoots.length = 0;

          roots.forEach(
            function (item) {
              apply(item);
            }
          );
        }
      );
  }

  function startObserver() {
    if (
      observer ||
      !document.body ||
      typeof MutationObserver ===
        "undefined"
    ) {
      return;
    }

    observer =
      new MutationObserver(
        function (mutations) {
          mutations.forEach(
            function (mutation) {
              Array.prototype
                .forEach
                .call(
                  mutation.addedNodes,
                  function (node) {
                    if (
                      node.nodeType !== 1
                    ) {
                      return;
                    }

                    if (
                      !containsI18nTarget(
                        node
                      )
                    ) {
                      return;
                    }

                    queueRoot(node);
                  }
                );
            }
          );
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  function dispatchApplied(root) {
    try {
      document.dispatchEvent(
        new CustomEvent(
          "aivo:studio:i18n-applied",
          {
            detail: {
              lang:
                getLanguage(),

              root:
                root || document
            }
          }
        )
      );
    } catch (_) {}
  }

  function refresh(root) {
    var target =
      root || document;

    var applied =
      apply(target);

    if (applied) {
      dispatchApplied(target);
    }

    return applied;
  }

  function exposeApi() {
    window.AIVO_STUDIO_I18N = {
      dictionary:
        DICTIONARY,

      getLanguage:
        getLanguage,

      t:
        translate,

      apply:
        apply,

      refresh:
        refresh,

      register:
        register,

      registerPack:
        registerPack
    };

    window.studioT =
      translate;
  }

  function resolveEventRoot(event) {
    var detail =
      event &&
      event.detail;

    if (!detail) {
      return document;
    }

    if (
      detail.root &&
      detail.root.nodeType
    ) {
      return detail.root;
    }

    if (
      detail.element &&
      detail.element.nodeType
    ) {
      return detail.element;
    }

    if (
      detail.container &&
      detail.container.nodeType
    ) {
      return detail.container;
    }

    return document;
  }

  function bindEvents() {
    document.addEventListener(
      "aivo:language-change",
      function () {
        refresh(document);
      }
    );

    document.addEventListener(
      "aivo:topbar:ready",
      function (event) {
        refresh(
          resolveEventRoot(event)
        );
      }
    );

    document.addEventListener(
      "aivo:module:loaded",
      function (event) {
        refresh(
          resolveEventRoot(event)
        );
      }
    );

    document.addEventListener(
      "aivo:studio:module-loaded",
      function (event) {
        refresh(
          resolveEventRoot(event)
        );
      }
    );
  }

  function boot() {
    exposeApi();

    if (!mergeDictionary()) {
      installAttempts += 1;

      if (
        installAttempts <
        MAX_INSTALL_ATTEMPTS
      ) {
        window.setTimeout(
          boot,
          25
        );
      } else {
        console.error(
          "[AIVO Studio i18n] desktop.i18n.js could not be initialized."
        );
      }

      return;
    }

    refresh(document);
    startObserver();
  }

  bindEvents();

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {
        once: true
      }
    );
  } else {
    boot();
  }
})();
