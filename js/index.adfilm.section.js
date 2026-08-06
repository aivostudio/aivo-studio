/* =========================================================
   AIVO INDEX — AI REKLAM FILMI SECTION
   Clones the approved Lipsync showcase structure and mounts
   the advertising showcase directly above Atmosphere.
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_INDEX_ADFILM_SECTION__) return;
  window.__AIVO_INDEX_ADFILM_SECTION__ = true;

  var ADFILM_PREVIEW_URL = "/aivo-adfilm-preview.mp4";

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

  function connectSoundButton(section) {
    var video = section.querySelector("#adfilmPreviewVideo");
    var button = section.querySelector("#adfilmSoundToggle");
    if (!video || !button) return;

    button.textContent = "🔇 Sesi Aç";

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      video.muted = !video.muted;
      button.textContent = video.muted ? "🔇 Sesi Aç" : "🔊 Ses Açık";

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
    section.setAttribute("aria-label", "AI Reklam Filmi");
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

    setText(section, ".lipsync-title", "AI Reklam Filmi");
    setText(
      section,
      ".lipsync-sub",
      "Markan için sahneli, sesli ve profesyonel reklam filmi oluştur."
    );
    setText(section, ".lipsync-bar strong", "Senaryodan reklama.");
    setText(
      section,
      ".lipsync-bar span",
      "Ürününü, hizmetini veya markanı kısa reklam filmine dönüştür."
    );

    var badges = section.querySelectorAll(".lipsync-badge");
    if (badges[0]) badges[0].textContent = "🎬 Sahneli Reklam";
    if (badges[1]) badges[1].textContent = "🎙️ Ses & Anlatım";
    if (badges[2]) badges[2].textContent = "📱 Sosyal Medya";

    setText(section, ".lipsync-cta", "Reklam Filmi Oluştur →");
    setText(section, ".lipsync-copy h3", "AI Reklam Filmi Oluştur");
    setText(
      section,
      ".lipsync-copybox",
      "Markanı tanıtan sahneli, sesli ve profesyonel reklam filmleri üret."
    );

    var bullets = section.querySelectorAll(".lipsync-bullets li");
    var bulletCopy = [
      "🎬 Senaryodan çok sahneli reklam filmi oluştur",
      "🎙️ Seslendirme ve anlatımla mesajını güçlendir",
      "📱 Reels, Shorts ve kampanya paylaşımına hazır çıktı al",
      "✨ Marka, ürün ve hizmet tanıtımı için premium görünüm",
      "⚡ Süre ve kalite seçenekleriyle kontrollü üretim"
    ];

    bullets.forEach(function (item, index) {
      if (bulletCopy[index]) item.textContent = bulletCopy[index];
    });

    setText(section, ".lipsync-bottom strong", "Senaryodan hazır reklama.");
    setText(
      section,
      ".lipsync-bottom span",
      " İlk reklam filmini kısa sürede oluştur."
    );

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
