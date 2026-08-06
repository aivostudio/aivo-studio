/* =========================================================
   AIVO INDEX — AD FILM + RADIO AD INFO
   Adds radio advertising information to the existing
   index ad film showcase without changing its base layout.
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_INDEX_ADFILM_RADIO_INFO__) return;
  window.__AIVO_INDEX_ADFILM_RADIO_INFO__ = true;

  var COPY = {
    tr: {
      sub: "Markan için sahneli reklam filmi veya profesyonel radyo reklamı oluştur.",
      barStrong: "Senaryodan reklama.",
      barText: "Ürününü, hizmetini veya markanı video ya da radyo reklamına dönüştür.",
      radioBadge: "📻 Radyo Reklamı",
      copyBox: "Markanı tanıtan sahneli reklam filmleri ve profesyonel radyo reklamları üret.",
      voiceBullet: "🎙️ Reklam filmi ve radyo reklamı için seslendirme ve anlatım oluştur",
      bottomStrong: "Senaryodan hazır reklama.",
      bottomText: " İlk video veya radyo reklamını kısa sürede oluştur."
    },
    en: {
      sub: "Create a multi-scene commercial or a professional radio ad for your brand.",
      barStrong: "From script to advertising.",
      barText: "Turn your product, service or brand into a video or radio advertisement.",
      radioBadge: "📻 Radio Advertising",
      copyBox: "Produce multi-scene commercials and professional radio ads that showcase your brand.",
      voiceBullet: "🎙️ Create voiceover and narration for commercials and radio advertising",
      bottomStrong: "From script to finished advertising.",
      bottomText: " Create your first video or radio ad in a short time."
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

  function ensureRadioBadge(section) {
    var badgesWrap = section.querySelector(".lipsync-badges");
    if (!badgesWrap) {
      var firstBadge = section.querySelector(".lipsync-badge");
      badgesWrap = firstBadge ? firstBadge.parentElement : null;
    }
    if (!badgesWrap) return null;

    var badge = section.querySelector('[data-adfilm-radio-badge="1"]');
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "lipsync-badge";
      badge.setAttribute("data-adfilm-radio-badge", "1");
      badgesWrap.appendChild(badge);
    }

    return badge;
  }

  function apply(section, lang) {
    if (!section) return;

    var pack = COPY[normalizeLanguage(lang)] || COPY.en;
    setText(section, ".lipsync-sub", pack.sub);
    setText(section, ".lipsync-bar strong", pack.barStrong);
    setText(section, ".lipsync-bar span", pack.barText);
    setText(section, ".lipsync-copybox", pack.copyBox);
    setText(section, ".lipsync-bottom strong", pack.bottomStrong);
    setText(section, ".lipsync-bottom span", pack.bottomText);

    var bullets = section.querySelectorAll(".lipsync-bullets li");
    if (bullets[1]) bullets[1].textContent = pack.voiceBullet;

    var radioBadge = ensureRadioBadge(section);
    if (radioBadge) radioBadge.textContent = pack.radioBadge;
  }

  function mount() {
    var section = document.getElementById("adfilm-video");
    if (!section) return false;
    apply(section, currentLanguage());
    return true;
  }

  document.addEventListener("aivo:index-adfilm-section-ready", mount);

  document.addEventListener("aivo:language-change", function (event) {
    var section = document.getElementById("adfilm-video");
    if (!section) return;
    var lang = event && event.detail ? event.detail.lang : currentLanguage();
    window.setTimeout(function () {
      apply(section, lang);
    }, 0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      var attempts = 0;
      var timer = window.setInterval(function () {
        attempts += 1;
        if (mount() || attempts >= 80) window.clearInterval(timer);
      }, 75);
    }, { once: true });
  } else {
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (mount() || attempts >= 80) window.clearInterval(timer);
    }, 75);
  }
})();
