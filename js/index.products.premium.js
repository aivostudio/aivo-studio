/* =========================================================
   AIVO SHARED — PREMIUM PRODUCTS MENU
   Loaded by include.partials.js across desktop pages.
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_INDEX_PRODUCTS_PREMIUM__) return;
  window.__AIVO_INDEX_PRODUCTS_PREMIUM__ = true;

  var COPY = {
    tr: {
      newBadge: "YENİ",
      musicTitle: "AI Müzik Üret",
      coverTitle: "AI Kapak Üret",
      atmoTitle: "AI Atmosfer Video",
      cartoonTitle: "AI Çocuk Çizgifilm",
      photofxTitle: "AI Foto Efekt Video Clip",
      videoTitle: "AI Resimden Video Üret",
      lipsyncTitle: "AI Dudak Senkron Video",
      adfilmTitle: "AI Reklam Filmi Oluştur"
    },
    en: {
      newBadge: "NEW",
      musicTitle: "Create AI Music",
      coverTitle: "Create AI Cover Art",
      atmoTitle: "AI Atmosphere Video",
      cartoonTitle: "AI Kids Cartoon",
      photofxTitle: "AI Photo Effect Video Clip",
      videoTitle: "Create AI Image-to-Video",
      lipsyncTitle: "AI Lip Sync Video",
      adfilmTitle: "Create an AI Commercial"
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
    var badge = product.isNew
      ? '<span class="pc-badge" data-index-products-copy="newBadge"></span>'
      : "";

    return [
      '<a href="' + product.href + '" data-target="' + product.href + '" data-auth="required" class="product-card" data-product="' + product.key + '">',
        '<span class="pc-ico">' + ICONS[product.key] + '</span>',
        '<span class="pc-title" data-index-products-copy="' + product.key + 'Title"></span>',
        badge,
      '</a>'
    ].join("");
  }

  function menuMarkup() {
    return PRODUCTS.map(cardMarkup).join("");
  }

  function forceSingleRow(menu) {
    var dropdown = menu.closest(".dropdown--products");
    var cards = Array.from(menu.querySelectorAll(":scope > a.product-card"));

    if (dropdown) {
      dropdown.style.setProperty("width", "min(936px, calc(100vw - 24px))", "important");
      dropdown.style.setProperty("max-width", "936px", "important");
    }

    menu.style.setProperty("display", "flex", "important");
    menu.style.setProperty("flex-direction", "row", "important");
    menu.style.setProperty("flex-wrap", "nowrap", "important");
    menu.style.setProperty("align-items", "stretch", "important");
    menu.style.setProperty("justify-content", "flex-start", "important");
    menu.style.setProperty("gap", "8px", "important");
    menu.style.setProperty("padding", "8px", "important");
    menu.style.setProperty("height", "124px", "important");
    menu.style.setProperty("min-height", "124px", "important");
    menu.style.setProperty("max-height", "124px", "important");
    menu.style.setProperty("overflow-x", "auto", "important");
    menu.style.setProperty("overflow-y", "hidden", "important");

    cards.forEach(function (card) {
      card.style.setProperty("display", "flex", "important");
      card.style.setProperty("flex", "0 0 108px", "important");
      card.style.setProperty("width", "108px", "important");
      card.style.setProperty("min-width", "108px", "important");
      card.style.setProperty("max-width", "108px", "important");
      card.style.setProperty("height", "108px", "important");
      card.style.setProperty("min-height", "108px", "important");
      card.style.setProperty("max-height", "108px", "important");
      card.style.setProperty("aspect-ratio", "1 / 1", "important");
      card.style.setProperty("flex-direction", "column", "important");
      card.style.setProperty("justify-content", "space-between", "important");
      card.style.setProperty("padding", "10px", "important");
      card.style.setProperty("border-radius", "16px", "important");
      card.style.setProperty("background", "radial-gradient(120px 80px at 20% 0%, rgba(var(--pc-rgb), .30), transparent 65%), linear-gradient(145deg, rgba(29, 33, 58, .97), rgba(9, 13, 28, .98))", "important");
    });
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
    forceSingleRow(menu);

    requestAnimationFrame(function () {
      forceSingleRow(menu);
    });

    setTimeout(function () {
      forceSingleRow(menu);
    }, 250);

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
    forceSingleRow(menu);
  });

  document.addEventListener("aivo:topbar:ready", mount);
  window.addEventListener("resize", function () {
    var menu = document.querySelector("#navProducts .products-menu--premium");
    if (menu) forceSingleRow(menu);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWithRetry, { once: true });
  } else {
    bootWithRetry();
  }
})();
