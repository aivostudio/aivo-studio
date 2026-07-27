/* =========================================================
   AIVO — AI REKLAM FILMI SKELETON
   - Desktop nav injection
   - TR / EN copy
   - Right panel placeholder
   - No API, no credit, no generation
   ========================================================= */

(function AIVO_AD_FILM_SKELETON(){
  "use strict";

  if (window.__AIVO_AD_FILM_SKELETON__) return;
  window.__AIVO_AD_FILM_SKELETON__ = true;

  var COPY = {
    tr: {
      nav: "AI Reklam Filmi Oluştur",
      newBadge: "YENİ",
      kicker: "AIVO Creative Engine",
      comingSoon: "YAKINDA",
      title: "AI Reklam Filmi Oluştur",
      subtitle: "Ürün görsellerini, seslendirmeyi, müziği ve sahneleri tek akışta birleştirerek kısa reklam filmleri oluştur.",
      modeBasic: "Basit Mod",
      modeVoice: "Sesli Reklam",
      modeAvatar: "Avatarlı Reklam",
      modeAdvanced: "Gelişmiş Mod",
      productInfo: "Ürün Bilgileri",
      productInfoSub: "Marka ve kampanya briefini tanımla.",
      mediaUpload: "Medya Yükle",
      mediaUploadSub: "Ürün, logo ve referanslarını ekle.",
      voiceNarration: "Ses & Anlatım",
      voiceNarrationSub: "Dil, ses ve dublaj ayarları.",
      presenter: "Karakter / Sunucu",
      presenterSub: "Sunucusuz, avatar veya özel karakter.",
      videoSettings: "Video Ayarları",
      videoSettingsSub: "Süre, oran, kalite ve altyazı.",
      storyboard: "Sahne Akışı",
      storyboardSub: "Reklamın sahne planını ön izle.",
      developmentLabel: "EXCLUSIVE MODULE / IN DEVELOPMENT",
      developmentTitle: "Bu bölüm yapım aşamasındadır",
      developmentText: "AIVO’nun yeni reklam filmi motorunu hazırlıyoruz. Ürün görselleri, profesyonel seslendirme, müzik, sahneler ve isteğe bağlı konuşan karakter tek bir üretim akışında buluşacak.",
      featureProduct: "Ürün odaklı sahneler",
      featureVoice: "Doğal ses & dublaj",
      featureAvatar: "Konuşan karakter",
      feature2k: "1080p / 2K çıktı",
      soonButton: "Yakında Kullanıma Açılacak",
      panelTitle: "Reklam Videolarım",
      panelMeta: "Yapım aşamasında",
      panelSearch: "Reklam videolarında ara...",
      panelEmptyTitle: "İlk reklam filmin burada görünecek",
      panelEmptyText: "Modül kullanıma açıldığında oluşturduğun reklam filmlerini bu alandan izleyip indirebileceksin."
    },
    en: {
      nav: "Create AI Ad Film",
      newBadge: "NEW",
      kicker: "AIVO Creative Engine",
      comingSoon: "COMING SOON",
      title: "Create AI Ad Film",
      subtitle: "Combine product images, narration, music and scenes in one flow to create short advertising films.",
      modeBasic: "Basic Mode",
      modeVoice: "Voice-over Ad",
      modeAvatar: "Avatar Ad",
      modeAdvanced: "Advanced Mode",
      productInfo: "Product Information",
      productInfoSub: "Define the brand and campaign brief.",
      mediaUpload: "Upload Media",
      mediaUploadSub: "Add product images, logo and references.",
      voiceNarration: "Voice & Narration",
      voiceNarrationSub: "Language, voice and dubbing settings.",
      presenter: "Character / Presenter",
      presenterSub: "No presenter, ready avatar or custom character.",
      videoSettings: "Video Settings",
      videoSettingsSub: "Duration, ratio, quality and subtitles.",
      storyboard: "Scene Flow",
      storyboardSub: "Preview the advertising storyboard.",
      developmentLabel: "EXCLUSIVE MODULE / IN DEVELOPMENT",
      developmentTitle: "This feature is under development",
      developmentText: "We are building AIVO’s new advertising film engine. Product visuals, professional narration, music, scenes and an optional talking character will meet in one production flow.",
      featureProduct: "Product-focused scenes",
      featureVoice: "Natural voice & dubbing",
      featureAvatar: "Talking character",
      feature2k: "1080p / 2K export",
      soonButton: "Coming Soon",
      panelTitle: "My Ad Films",
      panelMeta: "In development",
      panelSearch: "Search ad films...",
      panelEmptyTitle: "Your first ad film will appear here",
      panelEmptyText: "When the module launches, you will be able to watch and download your advertising films from this area."
    }
  };

  function currentLang(){
    var htmlLang = String(document.documentElement.lang || "").toLowerCase();
    var saved = "";
    try {
      saved = String(localStorage.getItem("aivo_language") || localStorage.getItem("aivo_lang") || "").toLowerCase();
    } catch (_) {}
    if (saved === "en" || htmlLang.indexOf("en") === 0) return "en";
    return "tr";
  }

  function t(key){
    var lang = currentLang();
    return (COPY[lang] && COPY[lang][key]) || COPY.tr[key] || key;
  }

  function navIcon(){
    return '<span class="adfilm-nav-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none">' +
        '<path d="M4 8.5h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Z" stroke="currentColor" stroke-width="1.7"/>' +
        '<path d="m4 8.5 2-5 14 4-2 1H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
        '<path d="m10 11.5 5 3-5 3v-6Z" fill="currentColor"/>' +
      '</svg></span>';
  }

  function injectNav(){
    var card = document.querySelector("#leftMenu .navCard");
    if (!card || card.querySelector('[data-route="adfilm"]')) return;

    var anchor = card.querySelector('[data-route="lipsync"]');
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "navBtn";
    btn.setAttribute("data-route", "adfilm");
    btn.setAttribute("aria-label", t("nav"));
    btn.innerHTML = navIcon() + '<span data-adfilm-nav-label>' + t("nav") + '</span>' + '<span class="adfilm-nav-badge" data-adfilm-nav-badge>' + t("newBadge") + '</span>';

    if (anchor && anchor.parentNode) anchor.insertAdjacentElement("afterend", btn);
    else card.appendChild(btn);
  }

  function translateRoot(root){
    var scope = root || document;
    scope.querySelectorAll("[data-adfilm-i18n]").forEach(function(el){
      var key = el.getAttribute("data-adfilm-i18n");
      if (key) el.textContent = t(key);
    });

    var label = document.querySelector("[data-adfilm-nav-label]");
    if (label) label.textContent = t("nav");
    var badge = document.querySelector("[data-adfilm-nav-badge]");
    if (badge) badge.textContent = t("newBadge");
  }

  function renderPanel(wrapEl){
    if (!wrapEl) return;
    wrapEl.innerHTML = '<div class="adfilm-panel-empty">' +
      '<div class="adfilm-panel-empty__icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 2-4 14 4H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m10 10.5 5 3-5 3v-6Z" fill="currentColor"/></svg>' +
      '</div>' +
      '<h3 data-adfilm-panel-title>' + t("panelEmptyTitle") + '</h3>' +
      '<p data-adfilm-panel-text>' + t("panelEmptyText") + '</p>' +
    '</div>';
  }

  function registerPanel(){
    if (!window.RightPanel || window.RightPanel._has("adfilm")) return;

    window.RightPanel.register("adfilm", {
      getHeader: function(){
        return {
          title: t("panelTitle"),
          meta: t("panelMeta"),
          searchEnabled: false,
          searchPlaceholder: t("panelSearch"),
          resetSearch: true
        };
      },
      mount: function(wrapEl){
        renderPanel(wrapEl);
      },
      onShow: function(payload, api){
        if (api && api.setHeader) {
          api.setHeader({
            title: t("panelTitle"),
            meta: t("panelMeta"),
            searchEnabled: false,
            searchPlaceholder: t("panelSearch")
          });
        }
        var wrap = document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
        if (wrap) renderPanel(wrap);
      }
    });
  }

  function refreshLanguage(){
    translateRoot(document);
    registerPanel();
    if (window.RightPanel && window.RightPanel.getCurrentKey && window.RightPanel.getCurrentKey() === "adfilm") {
      window.RightPanel.force("adfilm", {});
    }
  }

  document.addEventListener("aivo:module-mounted", function(event){
    if (event && event.detail && event.detail.key === "adfilm") {
      translateRoot(event.detail.root || document);
    }
  });

  document.addEventListener("click", function(event){
    var langBtn = event.target && event.target.closest ? event.target.closest("[data-aivo-language]") : null;
    if (!langBtn) return;
    setTimeout(refreshLanguage, 0);
  }, true);

  window.addEventListener("storage", function(event){
    if (event && (event.key === "aivo_language" || event.key === "aivo_lang")) refreshLanguage();
  });

  function boot(){
    injectNav();
    registerPanel();
    translateRoot(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();

  var attempts = 0;
  var timer = setInterval(function(){
    attempts += 1;
    injectNav();
    registerPanel();
    if ((document.querySelector('[data-route="adfilm"]') && window.RightPanel && window.RightPanel._has("adfilm")) || attempts > 80) {
      clearInterval(timer);
    }
  }, 100);
})();
