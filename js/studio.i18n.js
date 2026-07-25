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
         SUPPORT
         ========================= */

      "studio.support":
        "Help Center"
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
