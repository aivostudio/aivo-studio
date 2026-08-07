/* =========================================================
   AIVO INDEX — AI REKLAM FILMI SECTION
   Clones the approved Lipsync showcase structure and mounts
   the advertising showcase directly above Atmosphere.
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_INDEX_ADFILM_SECTION__) return;
  window.__AIVO_INDEX_ADFILM_SECTION__ = true;

  var ADFILM_PREVIEW_URL = "https://media.aivo.tr/outputs/home/adfilm/adfilm-preview-1786102393483.mp4";

  var COPY = {
    tr: {
      sectionLabel: "AI Reklam Filmi",
      title: "AI Reklam Filmi",
      sub: "Markan için sahneli, sesli ve profesyonel reklam filmi oluştur.",
      barStrong: "Senaryodan reklama.",
      barText: "Ürününü, hizmetini veya markanı kısa reklam filmine dönüştür.",
      badges: [
        "🎬 Sahneli Reklam",
        "🎙️ Ses & Anlatım",
        "📱 Sosyal Medya"
      ],
      cta: "Reklam Filmi Oluştur →",
      copyTitle: "AI Reklam Filmi Oluştur",
      copyBox: "Markanı tanıtan sahneli, sesli ve profesyonel reklam filmleri üret.",
      bullets: [
        "🎬 Senaryodan çok sahneli reklam filmi oluştur",
        "🎙️ Seslendirme ve anlatımla mesajını güçlendir",
        "📱 Reels, Shorts ve kampanya paylaşımına hazır çıktı al",
        "✨ Marka, ürün ve hizmet tanıtımı için premium görünüm",
        "⚡ Süre ve kalite seçenekleriyle kontrollü üretim"
      ],
      bottomStrong: "Senaryodan hazır reklama.",
      bottomText: " İlk reklam filmini kısa sürede oluştur.",
      soundOff: "🔇 Sesi Aç",
      soundOn: "🔊 Ses Açık"
    },
    en: {
      sectionLabel: "AI Commercial",
      title: "AI Commercial",
      sub: "Create a multi-scene, voiced and professional commercial for your brand.",
      barStrong: "From script to commercial.",
      barText: "Turn your product, service or brand into a short commercial.",
      badges: [
        "🎬 Multi-Scene Ad",
        "🎙️ Voice & Narration",
        "📱 Social Media"
      ],
      cta: "Create Commercial →",
      copyTitle: "Create an AI Commercial",
      copyBox: "Produce multi-scene, voiced and professional commercials that showcase your brand.",
      bullets: [
        "🎬 Turn a script into a multi-scene commercial",
        "🎙️ Strengthen your message with voiceover and narration",
        "📱 Export ready for Reels, Shorts and campaign posts",
        "✨ Give your brand, product or service a premium look",
        "⚡ Control production with duration and quality options"
      ],
      bottomStrong: "From script to a finished commercial.",
      bottomText: " Create your first commercial in a short time.",
      soundOff: "🔇 Turn Sound On",
      soundOn: "🔊 Sound On"
    }
  };

  function normalizeLanguage(value) {
    return String(value || "").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
  }

  function currentLanguage() {
    return normalizeLanguage(window.AIVO_LANG || document.documentElement.lang || "en");
  }

  function setText(root, selector, value) {
    var node = root.querySelector(selector);
    if (node) node.textContent = value;
  }

  function removeI18nBindings(root) {
    root.querySelectorAll(
      "[data-i18n], [data-i18n-html], [data-i18n-label], [data-i18n-placeholder], [data-i18n-title]"
    ).forEach(function (node) {
      node.removeAttribute("data-i18n");
      node.removeAttribute("data-i18n-html");
      node.removeAttribute("data-i18n-label");
      node.removeAttribute("data-i18n-placeholder");
      node.removeAttribute("data-i18n-title");
    });
  }

  function renameScopedStyles(section) {
    var style = section.querySelector("style");
    if (!style) return;

    style.textContent = style.textContent
      .replaceAll("#lipsync-video", "#adfilm-video")
      .replaceAll("lipsyncSubFlow", "adfilmSubFlow")
      .replaceAll("lipsyncMouth", "adfilmMouth")
      .replaceAll("lipsyncWave", "adfilmWave");
  }

  function applyAdFilmTheme(section) {
    var style = document.createElement("style");
    style.setAttribute("data-adfilm-theme", "1");
    style.textContent = [
      "#adfilm-video{",
      "  --adfilm-rose:#d85c86;",
      "  --adfilm-copper:#c77a55;",
      "  --adfilm-champagne:#f2c9a5;",
      "}",
      "#adfilm-video .lipsync-card{",
      "  background:",
      "    radial-gradient(760px 420px at 4% 0%, rgba(195,72,105,.34), transparent 62%),",
      "    radial-gradient(520px 360px at 96% 12%, rgba(205,124,83,.24), transparent 66%),",
      "    linear-gradient(145deg, rgba(64,27,48,.97), rgba(38,27,48,.98) 52%, rgba(67,38,41,.98)) !important;",
      "  border-color:rgba(241,175,139,.30) !important;",
      "  box-shadow:0 24px 70px rgba(73,25,44,.32), inset 0 1px 0 rgba(255,230,216,.10) !important;",
      "}",
      "#adfilm-video .lipsync-copybox{",
      "  background:linear-gradient(135deg, rgba(190,82,112,.18), rgba(197,126,81,.13)) !important;",
      "  border-color:rgba(240,181,147,.24) !important;",
      "}",
      "#adfilm-video .lipsync-badge{",
      "  background:rgba(74,38,50,.72) !important;",
      "  border-color:rgba(236,167,132,.24) !important;",
      "}",
      "#adfilm-video .lipsync-cta{",
      "  background:linear-gradient(90deg, #b95486 0%, #d46a78 48%, #d99568 100%) !important;",
      "  box-shadow:0 14px 34px rgba(183,74,116,.28) !important;",
      "}",
      "#adfilm-video .lipsync-media{position:relative !important;}",
      "#adfilm-video #adfilmSoundToggle{",
      "  top:18px !important;",
      "  right:18px !important;",
      "  bottom:auto !important;",
      "  left:auto !important;",
      "  background:linear-gradient(135deg, rgba(177,72,111,.96), rgba(211,118,88,.96)) !important;",
      "  border:1px solid rgba(255,221,202,.34) !important;",
      "  color:#fffaf7 !important;",
      "  box-shadow:0 12px 30px rgba(71,25,43,.36), inset 0 1px 0 rgba(255,255,255,.18) !important;",
      "  backdrop-filter:blur(12px) saturate(130%) !important;",
      "  -webkit-backdrop-filter:blur(12px) saturate(130%) !important;",
      "  z-index:7 !important;",
      "}",
      "#adfilm-video #adfilmSoundToggle:hover{",
      "  transform:translateY(-1px) !important;",
      "  filter:brightness(1.06) !important;",
      "}",
      "#adfilm-video .lipsync-video-wrap{",
      "  border-color:rgba(240,177,142,.24) !important;",
      "  box-shadow:inset 0 0 0 1px rgba(255,229,214,.05) !important;",
      "}"
    ].join("\n");

    section.appendChild(style);
  }

  function updateSoundButton(section, lang) {
    var video = section.querySelector("#adfilmPreviewVideo");
    var button = section.querySelector("#adfilmSoundToggle");
    if (!video || !button) return;

    var pack = COPY[normalizeLanguage(lang)] || COPY.en;
    button.textContent = video.muted ? pack.soundOff : pack.soundOn;
  }

  function applyCopy(section, lang) {
    var pack = COPY[normalizeLanguage(lang)] || COPY.en;

    section.setAttribute("aria-label", pack.sectionLabel);
    setText(section, ".lipsync-title", pack.title);
    setText(section, ".lipsync-sub", pack.sub);
    setText(section, ".lipsync-bar strong", pack.barStrong);
    setText(section, ".lipsync-bar span", pack.barText);
    setText(section, ".lipsync-cta", pack.cta);
    setText(section, ".lipsync-copy h3", pack.copyTitle);
    setText(section, ".lipsync-copybox", pack.copyBox);
    setText(section, ".lipsync-bottom strong", pack.bottomStrong);
    setText(section, ".lipsync-bottom span", pack.bottomText);

    section.querySelectorAll(".lipsync-badge").forEach(function (node, index) {
      if (pack.badges[index]) node.textContent = pack.badges[index];
    });

    section.querySelectorAll(".lipsync-bullets li").forEach(function (node, index) {
      if (pack.bullets[index]) node.textContent = pack.bullets[index];
    });

    updateSoundButton(section, lang);
  }

  function connectSoundButton(section) {
    var video = section.querySelector("#adfilmPreviewVideo");
    var button = section.querySelector("#adfilmSoundToggle");
    if (!video || !button) return;

    updateSoundButton(section, currentLanguage());

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      video.muted = !video.muted;
      updateSoundButton(section, currentLanguage());

      if (!video.muted) {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {});
        }
      }
    });
  }

  function buildSection(source) {
    var section = source.cloneNode(true);

    section.id = "adfilm-video";
    section.setAttribute("data-adfilm-section-shell", "1");

    renameScopedStyles(section);
    removeI18nBindings(section);

    var video = section.querySelector("#lipsyncPreviewVideo");
    if (video) {
      video.id = "adfilmPreviewVideo";
      video.src = ADFILM_PREVIEW_URL;
      video.setAttribute("src", ADFILM_PREVIEW_URL);
      video.removeAttribute("data-adfilm-video-placeholder");
      video.load();
    }

    var soundButton = section.querySelector("#lipsyncSoundToggle");
    if (soundButton) soundButton.id = "adfilmSoundToggle";

    var card = section.querySelector("a.lipsync-card");
    if (card) {
      card.href = "/studio.v2.html#adfilm";
      card.setAttribute("data-target", "/studio.v2.html#adfilm");
      card.setAttribute("data-mod", "adfilm");
    }

    applyAdFilmTheme(section);
    applyCopy(section, currentLanguage());
    connectSoundButton(section);
    return section;
  }

  function mount() {
    if (document.getElementById("adfilm-video")) return true;

    var source = document.getElementById("lipsync-video");
    var atmosphere = document.getElementById("atmosphere-video");
    if (!source || !atmosphere || !atmosphere.parentNode) return false;

    var section = buildSection(source);
    atmosphere.parentNode.insertBefore(section, atmosphere);

    try {
      document.dispatchEvent(
        new CustomEvent("aivo:index-adfilm-section-ready", {
          detail: { position: "before-atmosphere" }
        })
      );
    } catch (_) {}

    return true;
  }

  function boot() {
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (mount() || attempts >= 80) window.clearInterval(timer);
    }, 75);
  }

  document.addEventListener("aivo:language-change", function (event) {
    var section = document.getElementById("adfilm-video");
    if (!section) return;

    var lang = event && event.detail ? event.detail.lang : currentLanguage();
    applyCopy(section, lang);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
