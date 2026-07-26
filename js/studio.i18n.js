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
