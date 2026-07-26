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
