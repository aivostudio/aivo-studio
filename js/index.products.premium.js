/* =========================================================
   AIVO INDEX — PREMIUM PRODUCTS MENU
   Runs only when loaded by include.partials.js on index.
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_INDEX_PRODUCTS_PREMIUM__) return;
  window.__AIVO_INDEX_PRODUCTS_PREMIUM__ = true;

  var COPY = {
    tr: {
      eyebrow: "AIVO CREATIVE SUITE",
      headline: "Üretmek istediğin alanı seç",
      count: "8 AI aracı",
      newBadge: "YENİ",
      musicTitle: "AI Müzik Üret",
      musicSub: "Fikrini yaz, stüdyo kalitesinde müzik üret.",
      coverTitle: "AI Kapak Üret",
      coverSub: "Kapak, afiş ve profesyonel görsel içerik oluştur.",
      atmoTitle: "AI Atmosfer Video",
      atmoSub: "Loop sahneler ve sinematik atmosferler tasarla.",
      cartoonTitle: "AI Çocuk Çizgifilm",
      cartoonSub: "Karakterlerini sahnelere ve hikâyelere dönüştür.",
      photofxTitle: "AI Foto Efekt Video Clip",
      photofxSub: "Tek fotoğraftan hareketli efekt klibi üret.",
      videoTitle: "AI Resimden Video Üret",
      videoSub: "Görselini sosyal medyaya hazır videoya dönüştür.",
      lipsyncTitle: "AI Dudak Senkron Video",
      lipsyncSub: "Görüntü ve sesi doğal dudak hareketleriyle eşleştir.",
      adfilmTitle: "AI Reklam Filmi Oluştur",
      adfilmSub: "Markan için sahneli, sesli ve profesyonel reklam üret."
    },
    en: {
      eyebrow: "AIVO CREATIVE SUITE",
      headline: "Choose what you want to create",
      count: "8 AI tools",
      newBadge: "NEW",
      musicTitle: "Create AI Music",
      musicSub: "Turn an idea into studio-quality music.",
      coverTitle: "Create AI Cover Art",
      coverSub: "Design covers, posters and professional visuals.",
      atmoTitle: "AI Atmosphere Video",
      atmoSub: "Build loop scenes and cinematic atmospheres.",
      cartoonTitle: "AI Kids Cartoon",
      cartoonSub: "Turn characters into scenes and complete stories.",
      photofxTitle: "AI Photo Effect Video Clip",
      photofxSub: "Create an animated effects clip from one photo.",
      videoTitle: "Create AI Image-to-Video",
      videoSub: "Turn an image into a social-ready video.",
      lipsyncTitle: "AI Lip Sync Video",
      lipsyncSub: "Match video and audio with natural lip movement.",
      adfilmTitle: "Create an AI Commercial",
      adfilmSub: "Produce a voiced, multi-scene commercial for your brand."
    }
  };

  var ICONS = {
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    cover: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m5.5 18 4.5-4 3 2.5 2.5-2 3 3.5"/></svg>',
    atmo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 16a4 4 0 0 1 .7-7.94A6 6 0 0 1 19 10a3 3 0 0 1 0 6H7Z"/><path d="M8 20h8M10 17.5h4"/></svg>',
    cartoon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8.5 10h.01M15.5 10h.01M8 14c1.1 1.4 2.4 2 4 2s2.9-.6 4-2"/></svg>',
    photofx: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.1 3.2L16 7.5l-2.9 1.3L12 12l-1.1-3.2L8 7.5l2.9-1.3L12 3Z"/><path d="m6 13 .8 2.2L9 16l-2.2.8L6 19l-.8-2.2L3 16l2.2-.8L6 13ZM18 12l.7 1.8 1.8.7-1.8.7L18 17l-.7-1.8-1.8-.7 1.8-.7L18 12Z"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    lipsync: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>',
    adfilm: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M7 6l2-3M13 6l2-3M9.5 14.5l5 2.5-5 2.5v-5Z"/></svg>'
  };

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  var PRODUCTS = [
    { key: "music", href: "/studio.v2.html#music" },
    { key: "cover", href: "/studio.v2.html#cover" },
    { key: "atmo", href: "/studio.v2.html#atmo" },
    { key: "cartoon", href: "/studio.v2.html#cartoon" },
    { key: "photofx", href: "/studio.v2.html#photofx" },
    { key: "video", href: "/studio.v2.html#video" },
    { key: "lipsync", href: "/studio.v2.html#lipsync" },
    { key: "adfilm", href: "/studio.v2.html#adfilm", isNew: true }
  ];

  function normalizeLanguage(value) {
    return String(value || "").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
  }

  function currentLanguage() {
    return normalizeLanguage(window.AIVO_LANG || document.documentElement.lang || "en");
  }

  function cardMarkup(product) {
    var tools = product.isNew
      ? '<span class="pc-badge" data-index-products-copy="newBadge"></span><span class="pc-arrow">' + ARROW + '</span>'
      : '<span class="pc-arrow">' + ARROW + '</span>';

    return [
      '<a href="' + product.href + '" data-auth="required" class="product-card" data-product="' + product.key + '">',
        '<span class="pc-top">',
          '<span class="pc-ico">' + ICONS[product.key] + '</span>',
          '<span class="pc-card-tools">' + tools + '</span>',
        '</span>',
        '<span class="pc-txt">',
          '<span class="pc-title" data-index-products-copy="' + product.key + 'Title"></span>',
          '<span class="pc-sub" data-index-products-copy="' + product.key + 'Sub"></span>',
        '</span>',
      '</a>'
    ].join("");
  }

  function menuMarkup() {
    return [
      '<div class="products-menu-head">',
        '<div class="products-menu-heading">',
          '<span class="products-menu-eyebrow" data-index-products-copy="eyebrow"></span>',
          '<strong class="products-menu-title" data-index-products-copy="headline"></strong>',
        '</div>',
        '<span class="products-menu-count">',
          '<span class="products-menu-count-dot" aria-hidden="true"></span>',
          '<span data-index-products-copy="count"></span>',
        '</span>',
      '</div>',
      PRODUCTS.map(cardMarkup).join("")
    ].join("");
  }

  function applyCopy(root, lang) {
    var pack = COPY[normalizeLanguage(lang)] || COPY.en;

    root.querySelectorAll("[data-index-products-copy]").forEach(function (node) {
      var key = node.getAttribute("data-index-products-copy");
      if (Object.prototype.hasOwnProperty.call(pack, key)) {
        node.textContent = pack[key];
      }
    });

    var dropdown = root.closest(".dropdown--products");
    if (dropdown) {
      dropdown.setAttribute("aria-label", normalizeLanguage(lang) === "tr" ? "Ürünler menüsü" : "Products menu");
    }
  }

  function mount() {
    var menu = document.querySelector("#navProducts .products-menu");
    if (!menu) return false;

    if (!menu.classList.contains("products-menu--premium")) {
      menu.classList.add("products-menu--premium");
      menu.innerHTML = menuMarkup();
    }

    applyCopy(menu, currentLanguage());

    try {
      document.dispatchEvent(new CustomEvent("aivo:index-products-ready", {
        detail: { count: PRODUCTS.length }
      }));
    } catch (_) {}

    return true;
  }

  function bootWithRetry() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (mount() || attempts >= 40) {
        clearInterval(timer);
      }
    }, 75);
  }

  document.addEventListener("aivo:language-change", function (event) {
    var menu = document.querySelector("#navProducts .products-menu--premium");
    if (!menu) return;
    applyCopy(menu, event && event.detail ? event.detail.lang : currentLanguage());
  });

  document.addEventListener("aivo:topbar:ready", mount);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWithRetry, { once: true });
  } else {
    bootWithRetry();
  }
})();
