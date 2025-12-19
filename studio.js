
// AIVO STUDIO – STUDIO.JS (FULL)
// Navigation + Music subviews + Pricing modal + Media modal + Right panel

document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
   HELPERS
   ========================================================= */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function pageExists(key) {
    return !!qs(`.page[data-page="${key}"]`);
  }

  function getActivePageKey() {
    return qs(".page.is-active")?.getAttribute("data-page") || null;
  }

  function setTopnavActive(target) {
    qsa(".topnav-link[data-page-link]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-page-link") === target);
    });
  }

  function setSidebarsActive(target) {
    // Tüm sayfalardaki sidebar linkleri temizle
    qsa(".sidebar [data-page-link]").forEach((b) => b.classList.remove("is-active"));

    const activePage = qs(".page.is-active");
    if (!activePage) return;

    // Sadece aktif sayfadaki sidebar’da aktif işaretle
    qsa(".sidebar [data-page-link]", activePage).forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-page-link") === target);
    });
  }

  /** Sayfayı gerçekten aktive eden küçük yardımcı (recursive çağrı yok) */
  function activateRealPage(target) {
    qsa(".page").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-page") === target);
    });

    setTopnavActive(target);
    setSidebarsActive(target);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================================================
     CHECKOUT: sessionStorage -> UI
     ========================================================= */
  const CHECKOUT_KEYS = { plan: "aivo_checkout_plan", price: "aivo_checkout_price" };

  function renderCheckoutFromStorage() {
    const planEl = qs("#checkoutPlan");
    const priceEl = qs("#checkoutPrice");
    if (!planEl || !priceEl) return;

    let plan = "";
    let price = "";
    try {
      plan = sessionStorage.getItem(CHECKOUT_KEYS.plan) || "";
      price = sessionStorage.getItem(CHECKOUT_KEYS.price) || "";
    } catch (e) {}

    planEl.textContent = plan || "—";
    priceEl.textContent = price || "—";
  }

  function switchPage(target) {
    if (!target) return;

    /* ------------------------------
       VIDEO: ayrı page değil -> MUSIC + ai-video subview
       (Recursive switchPage yok, tek akış)
       ------------------------------ */
    if (target === "video" || target === "ai-video") {
      // Music page’e geç
      if (pageExists("music")) activateRealPage("music");

      // Subview’i video yap
      if (typeof switchMusicView === "function") switchMusicView("ai-video");

      // Üst menü video seçili görünsün
      setTopnavActive("video");

      // ✅ Sidebar page aktifliği "music" olmalı (çünkü gerçek sayfa music)
      setSidebarsActive("music");

      // Sağ panel modu
      if (typeof setRightPanelMode === "function") setRightPanelMode("video");

      if (typeof refreshEmptyStates === "function") refreshEmptyStates();
      return;
    }

    /* ------------------------------
       NORMAL PAGE SWITCH
       ------------------------------ */
    if (!pageExists(target)) {
      console.warn("[AIVO] switchPage: hedef sayfa yok:", target);
      return;
    }

    activateRealPage(target);

    // MUSIC'e dönünce her zaman “geleneksel”e dön (video’da takılmasın)
    if (target === "music") {
      if (typeof switchMusicView === "function") switchMusicView("geleneksel");
      if (typeof setRightPanelMode === "function") setRightPanelMode("music");
      if (typeof refreshEmptyStates === "function") refreshEmptyStates();
    }

    // ✅ CHECKOUT açılınca seçilen paket/fiyatı doldur
    if (target === "checkout") {
      renderCheckoutFromStorage();
    }
  }

  // ✅ KRİTİK: Pricing içi BUY -> checkout geçişi window.switchPage ister
  window.switchPage = switchPage;

  /* =========================================================
   INVOICES (DEMO) — localStorage: aivo_invoices
   - add / save / load / render
   - No DOMContentLoaded
   - Safe: single global object
   ========================================================= */
(function () {
  if (window.aivoInvoices) return; // tek kopya güvenliği

  var STORAGE_KEY = "aivo_invoices";
  var MAX_ITEMS = 200; // şişmeyi engelle (demo için yeterli)

  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function formatDateTR(iso) {
    // ISO -> "20.12.2025 01:15"
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return (
        pad2(d.getDate()) + "." +
        pad2(d.getMonth() + 1) + "." +
        d.getFullYear() + " " +
        pad2(d.getHours()) + ":" +
        pad2(d.getMinutes())
      );
    } catch (e) {
      return "";
    }
  }

  function escHTML(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getList() {
    var raw = localStorage.getItem(STORAGE_KEY);
    var arr = safeJSONParse(raw, []);
    if (!Array.isArray(arr)) arr = [];
    return arr;
  }

  function setList(arr) {
    // En yeni en üstte
    if (!Array.isArray(arr)) arr = [];
    if (arr.length > MAX_ITEMS) arr = arr.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    return arr;
  }

  function makeId() {
    return "inv_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  function typeLabel(t) {
    if (t === "music") return "Müzik Üretimi";
    if (t === "video") return "Video Üretimi";
    if (t === "cover") return "Kapak Üretimi";
    return "Üretim";
  }

  function typeBadge(t) {
    // CSS sınıfları: badge-music / badge-video / badge-cover
    if (t === "music") return "music";
    if (t === "video") return "video";
    if (t === "cover") return "cover";
    return "default";
  }

  function renderOneCard(inv) {
    var id = escHTML(inv.id);
    var title = escHTML(inv.title || typeLabel(inv.type));
    var dt = escHTML(formatDateTR(inv.createdAt));
    var status = escHTML(inv.status || "Başarılı");
    var credits = Number(inv.creditsSpent || 0);
    var typ = escHTML(typeBadge(inv.type));

    // Eita-style: solda başlık + meta, sağda kredi ve durum
    return (
      '<article class="invoice-card" data-invoice-id="' + id + '">' +
        '<div class="invoice-left">' +
          '<div class="invoice-title-row">' +
            '<span class="invoice-badge badge-' + typ + '">' + escHTML(inv.type || "generate") + '</span>' +
            '<h3 class="invoice-title">' + title + '</h3>' +
          '</div>' +
          '<div class="invoice-meta">' +
            '<span class="invoice-date">' + dt + '</span>' +
            (inv.plan ? '<span class="invoice-dot">•</span><span class="invoice-plan">' + escHTML(inv.plan) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="invoice-right">' +
          '<div class="invoice-amount">-' + escHTML(String(credits)) + ' Kredi</div>' +
          '<div class="invoice-status">' + status + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  window.aivoInvoices = {
    key: STORAGE_KEY,

    load: function () {
      return getList();
    },

    save: function (list) {
      return setList(list);
    },

    add: function (entry) {
      // entry: {type,title,creditsSpent,createdAt,status, ...}
      var list = getList();

      var inv = {
        id: makeId(),
        type: entry && entry.type ? String(entry.type) : "generate",
        title: entry && entry.title ? String(entry.title) : "",
        creditsSpent: Number(entry && entry.creditsSpent ? entry.creditsSpent : 0),
        createdAt: entry && entry.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        status: entry && entry.status ? String(entry.status) : "Başarılı",
        // opsiyonel alanlar:
        plan: entry && entry.plan ? String(entry.plan) : "",
        meta: entry && entry.meta ? entry.meta : null
      };

      // En üste ekle
      list.unshift(inv);
      setList(list);
      return inv;
    },

    clear: function () {
      localStorage.removeItem(STORAGE_KEY);
      this.render();
    },

    render: function () {
      var listEl = qs("#invoicesList");
      var emptyEl = qs("#invoicesEmpty");

      // Invoices sayfasında değilken de çağrılabilir:
      // DOM yoksa sessiz çık
      if (!listEl && !emptyEl) return;

      var list = getList();

      if (!listEl) {
        // sadece empty state varsa onu yönet
        if (emptyEl) emptyEl.style.display = list.length ? "none" : "";
        return;
      }

      if (!list.length) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "";
        listEl.style.display = "none";
        return;
      }

      // dolu
      var html = "";
      for (var i = 0; i < list.length; i++) {
        html += renderOneCard(list[i]);
      }
      listEl.innerHTML = html;

      if (emptyEl) emptyEl.style.display = "none";
      listEl.style.display = "";
    }
  };
})();

  /* =========================================================
     GLOBAL CLICK HANDLER (NAV + MODALS)
     ========================================================= */
  document.addEventListener("click", (e) => {
    // 1) Pricing modal trigger (data-open-pricing)
    const pricingEl = e.target.closest("[data-open-pricing]");
    if (pricingEl) {
      e.preventDefault();
      if (typeof window.openPricing === "function") window.openPricing();
      return;
    }

    // 2) Page navigation
    const linkEl = e.target.closest("[data-page-link]");
    if (!linkEl) return;

    const target = linkEl.getAttribute("data-page-link");
    if (!target) return;

    // ✅ Kredi menüsü yanlışlıkla page-link olarak bağlandıysa modal aç
    const pricingKeys = new Set(["pricing", "credits", "kredi", "kredi-al", "credit", "buy-credits"]);
    if (pricingKeys.has(target)) {
      e.preventDefault();
      if (typeof window.openPricing === "function") window.openPricing();
      return;
    }

    // ✅ AI Video yanlışlıkla page-link ise: music + ai-video view + aktiflik senkronu
    if (target === "ai-video") {
      e.preventDefault();
      switchPage("music");
      if (typeof switchMusicView === "function") switchMusicView("ai-video");
      setTopnavActive("video");
      setSidebarsActive("music");
      return;
    }

    e.preventDefault();
    switchPage(target);
  });

  /* =========================================================
     MODE TOGGLE (BASİT / GELİŞMİŞ)
     ========================================================= */
  const body = document.body;
  const modeButtons = qsa("[data-mode-button]");
  const advancedSections = qsa("[data-visible-in='advanced']");
  const basicSections = qsa("[data-visible-in='basic']");

  function updateMode(mode) {
    body.setAttribute("data-mode", mode);

    modeButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-mode-button") === mode);
    });

    advancedSections.forEach((el) => {
      if (mode === "basic") el.classList.add("hidden");
      else el.classList.remove("hidden");
    });

    basicSections.forEach((el) => {
      if (mode === "basic") el.classList.remove("hidden");
      else el.classList.add("hidden");
    });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode-button");
      if (!mode) return;
      updateMode(mode);
    });
  });

  updateMode(body.getAttribute("data-mode") || "advanced");

  /* =========================================================
     PRICING MODAL + KVKK LOCK + BUY -> CHECKOUT (TEK BLOK / SAFE)
     ========================================================= */
  (function () {
    function onReady(fn) {
      if (document.readyState !== "loading") fn();
      else document.addEventListener("DOMContentLoaded", fn);
    }

    onReady(function () {
      // qs/qsa fallback
      var qs = (typeof window.qs === "function")
        ? window.qs
        : function (sel, root) { return (root || document).querySelector(sel); };

      var qsa = (typeof window.qsa === "function")
        ? window.qsa
        : function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

      var pricingModal = document.getElementById("pricingModal");
      if (!pricingModal) return;

      var closePricingBtn = document.getElementById("closePricing");
      var pricingBackdrop = pricingModal.querySelector(".pricing-backdrop");
      var kvkkCheckbox = pricingModal.querySelector("[data-kvkk-check]");
      var kvkkHint = pricingModal.querySelector("[data-kvkk-hint]");

      function getBuyButtons() {
        return qsa(".primary-btn[data-buy-plan][data-buy-price]", pricingModal);
      }

      function isKvkkOk() {
        return !!(kvkkCheckbox && kvkkCheckbox.checked);
      }

      function updateBuyLock() {
        var ok = isKvkkOk();
        var btns = getBuyButtons();

        for (var i = 0; i < btns.length; i++) {
          btns[i].disabled = !ok;
          btns[i].setAttribute("aria-disabled", String(!ok));
          if (btns[i].classList) btns[i].classList.toggle("is-ready", ok);
        }

        if (kvkkHint) kvkkHint.style.display = ok ? "none" : "block";
      }

      function openPricing() {
        pricingModal.classList.add("is-open");
        updateBuyLock();
      }

      function closePricing() {
        pricingModal.classList.remove("is-open");
      }

      // Global erişim
      window.openPricing = openPricing;
      window.closePricing = closePricing;

      function setCheckoutData(plan, price) {
        try {
          sessionStorage.setItem(CHECKOUT_KEYS.plan, String(plan || ""));
          sessionStorage.setItem(CHECKOUT_KEYS.price, String(price || ""));
        } catch (e) {
          console.warn("sessionStorage set error", e);
        }
      }

      function getCheckoutData() {
        try {
          return {
            plan: sessionStorage.getItem(CHECKOUT_KEYS.plan) || "",
            price: sessionStorage.getItem(CHECKOUT_KEYS.price) || ""
          };
        } catch (e) {
          return { plan: "", price: "" };
        }
      }

      function renderCheckout() {
        var planEl = document.getElementById("checkoutPlan");
        var priceEl = document.getElementById("checkoutPrice");
        if (!planEl || !priceEl) return;

        var data = getCheckoutData();
        planEl.textContent = data.plan || "—";
        priceEl.textContent = data.price || "—";
      }

      // KVKK change
      if (kvkkCheckbox && kvkkCheckbox.dataset.boundKvkkPricing !== "1") {
        kvkkCheckbox.dataset.boundKvkkPricing = "1";
        kvkkCheckbox.addEventListener("change", updateBuyLock);
      }
      updateBuyLock();

      // Close button
      if (closePricingBtn && closePricingBtn.dataset.boundClosePricing !== "1") {
        closePricingBtn.dataset.boundClosePricing = "1";
        closePricingBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          closePricing();
        });
      }

      // Backdrop click
      if (pricingBackdrop && pricingBackdrop.dataset.boundBackdropPricing !== "1") {
        pricingBackdrop.dataset.boundBackdropPricing = "1";
        pricingBackdrop.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          closePricing();
        });
      }

      // Open triggers
      var creditsButton = document.getElementById("creditsButton");
      if (creditsButton && creditsButton.dataset.boundCreditsOpen !== "1") {
        creditsButton.dataset.boundCreditsOpen = "1";
        creditsButton.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openPricing();
        });
      }

      var openEls = qsa("[data-open-pricing]");
      for (var j = 0; j < openEls.length; j++) {
        if (openEls[j].dataset.boundOpenPricing === "1") continue;
        openEls[j].dataset.boundOpenPricing = "1";
        openEls[j].addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openPricing();
        });
      }

      // BUY -> CHECKOUT (event delegation)
      if (pricingModal.dataset.boundBuyDelegate !== "1") {
        pricingModal.dataset.boundBuyDelegate = "1";

        pricingModal.addEventListener("click", function (e) {
          var t = e.target;
          var buyBtn = null;

          // closest fallback
          if (t && t.closest) {
            buyBtn = t.closest(".primary-btn[data-buy-plan][data-buy-price]");
          } else {
            while (t && t !== pricingModal) {
              if (t.matches && t.matches(".primary-btn[data-buy-plan][data-buy-price]")) {
                buyBtn = t;
                break;
              }
              t = t.parentElement;
            }
          }

          if (!buyBtn) return;

          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

          if (!isKvkkOk()) { updateBuyLock(); return; }

          var plan = buyBtn.getAttribute("data-buy-plan") || "";
          var price = buyBtn.getAttribute("data-buy-price") || "";

          setCheckoutData(plan, price);

          // Checkout sayfana geçiş
          if (typeof window.switchPage === "function") {
            window.switchPage("checkout");
          } else {
            console.log("CHECKOUT:", { plan: plan, price: price });
          }

          // Checkout alanları varsa doldur
          renderCheckout();

          closePricing();
        });
      }

      // ESC kapatma
      if (document.body.dataset.boundEscPricing !== "1") {
        document.body.dataset.boundEscPricing = "1";
        document.addEventListener("keydown", function (e) {
          if (e.key !== "Escape") return;
          if (pricingModal.classList.contains("is-open")) closePricing();
        });
      }
    });
  })();

  /* =========================================================
     MEDIA MODAL (Video + Kapak preview)
     ========================================================= */
  const mediaModal = qs("#mediaModal");
  const mediaStage = qs("#mediaStage");

  function openMediaModal(node) {
    if (!mediaModal || !mediaStage) return;
    mediaStage.innerHTML = "";
    mediaStage.appendChild(node);
    mediaModal.classList.add("is-open");
    mediaModal.setAttribute("aria-hidden", "false");
  }

  function closeMediaModal() {
    if (!mediaModal || !mediaStage) return;
    mediaModal.classList.remove("is-open");
    mediaModal.setAttribute("aria-hidden", "true");
    mediaStage.innerHTML = "";
  }

  if (mediaModal) {
    qsa("[data-media-close]", mediaModal).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeMediaModal();
      });
    });
  }

  /* =========================================================
     RIGHT PANEL LISTS (Müzik / Video / Kayıt)
     ========================================================= */
  const rightTitle = qs("#rightPanelTitle");
  const rightSubtitle = qs("#rightPanelSubtitle");

  const musicList = qs("#musicList");
  const videoList = qs("#videoList");
  const recordList = qs("#recordList");

  const musicEmpty = qs("#musicEmpty");
  const videoEmpty = qs("#videoEmpty");
  const recordEmpty = qs("#recordEmpty");

  function setRightPanelMode(mode) {
    const isMusic = mode === "music";
    const isVideo = mode === "video";
    const isRecord = mode === "record";

    if (rightTitle) rightTitle.textContent = isMusic ? "Müziklerim" : isVideo ? "Videolarım" : "Kayıtlarım";
    if (rightSubtitle) rightSubtitle.textContent = isMusic ? "Son üretilen müzikler" : isVideo ? "Son üretilen videolar" : "Son kayıtlar";

    if (musicList) musicList.classList.toggle("hidden", !isMusic);
    if (videoList) videoList.classList.toggle("hidden", !isVideo);
    if (recordList) recordList.classList.toggle("hidden", !isRecord);
  }

  function refreshEmptyStates() {
    if (musicEmpty && musicList) musicEmpty.style.display = musicList.querySelector(".media-item") ? "none" : "flex";
    if (videoEmpty && videoList) videoEmpty.style.display = videoList.querySelector(".media-item") ? "none" : "flex";
    if (recordEmpty && recordList) recordEmpty.style.display = recordList.querySelector(".media-item") ? "none" : "flex";
  }

  function createIconButton(symbol, aria, extraClass = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `media-ico ${extraClass}`.trim();
    btn.textContent = symbol;
    btn.setAttribute("aria-label", aria);
    return btn;
  }

  function createMusicItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    item.className = "media-item music-item";
    item.dataset.kind = "music";
    item.dataset.status = placeholder ? "pending" : "ready";

    const playBtn = createIconButton("▶", "Oynat/Duraklat");
    const downloadBtn = createIconButton("⬇", "İndir");
    const delBtn = createIconButton("✖", "Sil", "danger");

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.gap = "10px";
    left.style.alignItems = "center";

    playBtn.style.width = "46px";
    playBtn.style.height = "46px";
    playBtn.style.borderRadius = "999px";

    const right = document.createElement("div");
    right.className = "icon-row";
    right.appendChild(downloadBtn);
    right.appendChild(delBtn);

    left.appendChild(playBtn);
    item.appendChild(left);
    item.appendChild(right);

    if (placeholder) {
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      let isPlaying = false;
      playBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? "❚❚" : "▶";
      });
      downloadBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Music download (placeholder)");
      });
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  function createVideoItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    item.className = "media-item video-item";
    item.dataset.kind = "video";
    item.dataset.status = placeholder ? "pending" : "ready";

    const overlay = document.createElement("div");
    overlay.className = "media-overlay";

    const play = document.createElement("button");
    play.type = "button";
    play.className = "play-overlay";
    play.textContent = "▶";
    play.setAttribute("aria-label", "Oynat");

    const row = document.createElement("div");
    row.className = "icon-row";

    const downloadBtn = createIconButton("⬇", "İndir");
    const expandBtn = createIconButton("🔍", "Büyüt");
    const delBtn = createIconButton("✖", "Sil", "danger");

    row.appendChild(downloadBtn);
    row.appendChild(expandBtn);
    row.appendChild(delBtn);

    overlay.appendChild(play);
    overlay.appendChild(row);
    item.appendChild(overlay);

    if (placeholder) {
      play.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      expandBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      const openPreview = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const v = document.createElement("video");
        v.controls = true;
        v.autoplay = true;
        v.muted = true;
        openMediaModal(v);
      };

      play.addEventListener("click", openPreview);
      expandBtn.addEventListener("click", openPreview);
      downloadBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Video download (placeholder)");
      });
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  function createRecordItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    item.className = "media-item record-item";
    item.dataset.kind = "record";
    item.dataset.status = placeholder ? "pending" : "ready";

    const playBtn = createIconButton("▶", "Oynat");
    const row = document.createElement("div");
    row.className = "icon-row";

    const downloadBtn = createIconButton("⬇", "İndir");
    const toMusicBtn = createIconButton("🎵", "Müzikte referans");
    const delBtn = createIconButton("✖", "Sil", "danger");

    row.appendChild(downloadBtn);
    row.appendChild(toMusicBtn);
    row.appendChild(delBtn);

    item.appendChild(playBtn);
    item.appendChild(row);

    if (placeholder) {
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      toMusicBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      playBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Record play (placeholder)");
      });
      downloadBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Record download (placeholder)");
      });
      toMusicBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        switchPage("music");
        switchMusicView("geleneksel");
        setRightPanelMode("music");
      });
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  function addPlaceholderAndActivate(listEl, itemFactory, activateDelay = 1400) {
    if (!listEl) return;
    const placeholder = itemFactory({ placeholder: true });
    listEl.prepend(placeholder);
    refreshEmptyStates();

    setTimeout(() => {
      const ready = itemFactory({ placeholder: false });
      placeholder.replaceWith(ready);
      refreshEmptyStates();
    }, activateDelay);
  }

  /* =========================================================
   MUSIC SUBVIEWS (Geleneksel / Ses Kaydı / AI Video)
   ========================================================= */
  const musicViews = qsa(".music-view");
  const musicTabButtons = qsa(".sidebar-sublink[data-music-tab]");

  let recordController = null;

  function switchMusicView(targetKey) {
    if (!targetKey) return;

    /* ---- MUSIC VIEW GÖSTER / GİZLE ---- */
    musicViews.forEach((view) => {
      const key = view.getAttribute("data-music-view");
      view.classList.toggle("is-active", key === targetKey);
    });

    /* ✅ SIDEBAR SUBTAB AKTİFLİĞİ (TOPBAR'dan gelince de seçsin) */
    if (musicTabButtons && musicTabButtons.length) {
      musicTabButtons.forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-music-tab") === targetKey);
      });
    }

    /* ---- RIGHT PANEL MODE ---- */
    if (targetKey === "geleneksel") setRightPanelMode("music");
    if (targetKey === "ses-kaydi") setRightPanelMode("record");
    if (targetKey === "ai-video") setRightPanelMode("video");

    /* ---- AI VIDEO DEFAULT TAB ---- */
    if (targetKey === "ai-video") {
      ensureVideoDefaultTab();
    }

    /* ---- RECORD TEMİZLE ---- */
    if (recordController && targetKey !== "ses-kaydi") {
      recordController.forceStopAndReset();
    }

    refreshEmptyStates();

    /* =====================================================
       ✅ ÜST MENÜ IŞIĞI (KIRILMAYAN / GÜVENLİ)
       ===================================================== */
    try {
      const topMusic = qs('.topnav-link[data-page-link="music"]');
      const topVideo = qs('.topnav-link[data-page-link="video"]');

      if (topMusic && topVideo) {
        const isVideo = targetKey === "ai-video";
        topVideo.classList.toggle("is-active", isVideo);
        topMusic.classList.toggle("is-active", !isVideo);
      }
    } catch (e) {
      // sessiz geç – UI kırılmasın
    }
  }

  /* ---- SIDEBAR TAB CLICK ---- */
  if (musicViews.length && musicTabButtons.length) {
    musicTabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.getAttribute("data-music-tab");
        if (!target) return;

        musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));

        switchMusicView(target);
      });
    });

    /* ---- DEFAULT: GELENEKSEL ---- */
    if (!qs(".music-view.is-active")) {
      switchMusicView("geleneksel");
      const first = qs('.sidebar-sublink[data-music-tab="geleneksel"]');
      if (first) {
        musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === first));
      }
    } else {
      const current = qs(".music-view.is-active")?.getAttribute("data-music-view");
      if (current) {
        switchMusicView(current);
        const btn = qs(`.sidebar-sublink[data-music-tab="${current}"]`);
        if (btn) {
          musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        }
      }
    }
  }

 /* =========================================================
   MUSIC GENERATE
   ========================================================= */
const musicGenerateBtn = qs("#musicGenerateBtn");
if (musicGenerateBtn) {
  musicGenerateBtn.addEventListener("click", (e) => {
    e.preventDefault();
    setRightPanelMode("music");
    if (musicGenerateBtn.classList.contains("is-loading")) return;

    const originalText = musicGenerateBtn.textContent;
    musicGenerateBtn.classList.add("is-loading");
    musicGenerateBtn.textContent = "Üretiliyor...";

    addPlaceholderAndActivate(musicList, createMusicItem, 1200);

    setTimeout(() => {
      // ✅ UI reset
      musicGenerateBtn.classList.remove("is-loading");
      musicGenerateBtn.textContent = originalText;

      console.log("Müzik üretim isteği burada API'ye gidecek.");

      // ✅ FATURA EKLE — MUSIC (DOĞRU YER)
      if (window.aivoInvoices) {
        window.aivoInvoices.add({
          type: "music",
          title: "AI Müzik Üretimi",
          creditsSpent: 10, // müzik için harcanan kredi (gerekirse değiştir)
          status: "Başarılı",
          createdAt: new Date().toISOString()
        });

        window.aivoInvoices.render();
      }

    }, 1200);
  });
}


  /* =========================================================
     RECORDING VIEW (UI-only)
     ========================================================= */
  const sesView = qs('.music-view[data-music-view="ses-kaydi"]');
  if (sesView) {
    const mainCard = qs(".record-main-card", sesView);
    const circle = qs(".record-circle", sesView);
    const button = qs(".record-btn", sesView);
    const title = qs(".record-main-title", sesView);
    const timerEl = qs(".record-timer", sesView);

    const resultCard = qs("#recordResult", sesView);
    const resultTimeEl = qs("#recordResultTime", sesView);

    const playBtn = qs('[data-record-action="play"]', sesView);
    const downloadBtn = qs('[data-record-action="download"]', sesView);
    const toMusicBtn = qs('[data-record-action="to-music"]', sesView);
    const deleteBtn = qs('[data-record-action="delete"]', sesView);

    let isRecording = false;
    let timerInterval = null;
    let startTime = 0;
    let lastDurationMs = 0;

    function formatTime(ms) {
      const totalSec = Math.floor(ms / 1000);
      const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
      const sec = String(totalSec % 60).padStart(2, "0");
      return `${min}:${sec}`;
    }

    function setResultVisible(visible) {
      if (!resultCard) return;
      resultCard.style.display = visible ? "flex" : "none";
    }

    function startTimer() {
      if (!timerEl) return;
      startTime = Date.now();
      timerEl.textContent = "00:00";
      if (timerInterval) clearInterval(timerInterval);

      timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        timerEl.textContent = formatTime(diff);
      }, 200);
    }

    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      lastDurationMs = startTime ? Date.now() - startTime : 0;
      startTime = 0;
    }

    function applyUIRecordingState(active) {
      isRecording = active;

      if (circle) circle.classList.toggle("is-recording", isRecording);
      if (mainCard) mainCard.classList.toggle("is-recording", isRecording);

      if (title) title.textContent = isRecording ? "Kayıt Devam Ediyor" : "Ses Kaydetmeye Başlayın";
      if (button) button.textContent = isRecording ? "⏹ Kaydı Durdur" : "⏺ Kaydı Başlat";

      document.body.classList.toggle("is-recording", isRecording);

      if (isRecording) {
        setResultVisible(false);
        startTimer();
      } else {
        stopTimer();

        if (lastDurationMs >= 500 && resultTimeEl) {
          resultTimeEl.textContent = formatTime(lastDurationMs);
          setResultVisible(true);

          setRightPanelMode("record");
          if (recordList) {
            recordList.prepend(createRecordItem({ placeholder: false }));
            refreshEmptyStates();
          }
        } else {
          setResultVisible(false);
        }
      }
    }

    function toggleRecording() {
      applyUIRecordingState(!isRecording);
    }

    setResultVisible(false);

    if (circle) {
      circle.style.cursor = "pointer";
      circle.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRecording();
      });
    }

    if (button) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRecording();
      });
    }

    if (playBtn) playBtn.addEventListener("click", () => console.log("Play (placeholder)"));
    if (downloadBtn) downloadBtn.addEventListener("click", () => console.log("Download (placeholder)"));
    if (toMusicBtn)
      toMusicBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchPage("music");
        switchMusicView("geleneksel");
        setRightPanelMode("music");
        console.log("Kayıt, müzik referansına taşınacak (backend ile).");
      });
    if (deleteBtn)
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setResultVisible(false);
      });

    recordController = {
      forceStopAndReset() {
        if (isRecording) applyUIRecordingState(false);

        document.body.classList.remove("is-recording");
        if (circle) circle.classList.remove("is-recording");
        if (mainCard) mainCard.classList.remove("is-recording");
        if (title) title.textContent = "Ses Kaydetmeye Başlayın";
        if (button) button.textContent = "⏺ Kaydı Başlat";
        if (timerEl) timerEl.textContent = "00:00";
        setResultVisible(false);

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        startTime = 0;
        lastDurationMs = 0;
        isRecording = false;
      },
    };
  }

  /* =========================================================
     AI VIDEO TABS + COUNTERS + GENERATE
     ========================================================= */
  const videoTabs = qsa(".video-tab[data-video-tab]");
  const videoViews = qsa(".video-view[data-video-view]");

  function switchVideoTab(target) {
    videoTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.videoTab === target));
    videoViews.forEach((view) => view.classList.toggle("is-active", view.dataset.videoView === target));
  }
  function ensureVideoDefaultTab() {
    const hasActive = document.querySelector(".video-view.is-active");
    if (hasActive) return;

    const firstTab = videoTabs[0]?.dataset.videoTab;
    if (firstTab) switchVideoTab(firstTab);
  }

  videoTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      ensureVideoDefaultTab();

      const target = tab.dataset.videoTab;
      if (!target) return;
      switchVideoTab(target);
    });
  });

  function bindCounter(textareaId, counterId, max) {
    const textarea = qs(`#${textareaId}`);
    const counter = qs(`#${counterId}`);
    if (!textarea || !counter) return;

    const update = () => {
      counter.textContent = `${textarea.value.length} / ${max}`;
    };
    textarea.addEventListener("input", update);
    update();
  }

  bindCounter("videoPrompt", "videoPromptCounter", 1000);
  bindCounter("videoImagePrompt", "videoImagePromptCounter", 500);

  function attachVideoGenerate(btnId, loadingText, delay = 1400) {
    const btn = qs(`#${btnId}`);
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setRightPanelMode("video");
      if (btn.classList.contains("is-loading")) return;

      const original = btn.textContent;
      btn.classList.add("is-loading");
      btn.textContent = loadingText;

      addPlaceholderAndActivate(videoList, createVideoItem, delay);

      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.textContent = original;
        console.log("AI Video isteği burada API'ye gidecek.");
      }, delay);
    });
  }

  attachVideoGenerate("videoGenerateTextBtn", "🎬 Video Oluşturuluyor...", 1400);
  attachVideoGenerate("videoGenerateImageBtn", "🎞 Video Oluşturuluyor...", 1600);

  const imageInput = qs("#videoImageInput");
  if (imageInput) {
    imageInput.addEventListener("change", () => {
      if (!imageInput.files || !imageInput.files[0]) return;
      console.log("Seçilen görsel:", imageInput.files[0].name);
    });
  }

  /* =========================================================
     COVER GENERATE + GALLERY ITEMS
     ========================================================= */
  const coverGenerateBtn = qs("#coverGenerateBtn");
  const coverGallery = qs("#coverGallery");

  function createCoverGalleryItem({ placeholder = false } = {}) {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.dataset.status = placeholder ? "pending" : "ready";

    const thumb = document.createElement("div");
    thumb.className = "gallery-thumb";
    thumb.style.background = placeholder
      ? "rgba(108,92,231,0.18)"
      : "linear-gradient(135deg, rgba(108,92,231,0.85), rgba(0,206,201,0.75))";

    const overlay = document.createElement("div");
    overlay.className = "media-overlay";

    const expandBtn = document.createElement("button");
    expandBtn.className = "media-ico";
    expandBtn.type = "button";
    expandBtn.textContent = "🔍";
    expandBtn.setAttribute("aria-label", "Büyüt");

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "media-ico";
    downloadBtn.type = "button";
    downloadBtn.textContent = "⬇";
    downloadBtn.setAttribute("aria-label", "İndir");

    const delBtn = document.createElement("button");
    delBtn.className = "media-ico danger";
    delBtn.type = "button";
    delBtn.textContent = "✖";
    delBtn.setAttribute("aria-label", "Sil");

    overlay.appendChild(expandBtn);
    overlay.appendChild(downloadBtn);
    overlay.appendChild(delBtn);

    card.appendChild(thumb);
    card.appendChild(overlay);

    if (placeholder) {
      expandBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      expandBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const img = document.createElement("img");
        openMediaModal(img);
      });

      downloadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Cover download (placeholder)");
      });

      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.remove();
      });
    }

    return card;
  }

  if (coverGenerateBtn) {
    coverGenerateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (coverGenerateBtn.classList.contains("is-loading")) return;

      const originalText = coverGenerateBtn.textContent;
      coverGenerateBtn.classList.add("is-loading");
      coverGenerateBtn.textContent = "Üretiliyor...";

      if (coverGallery) {
        const placeholder = createCoverGalleryItem({ placeholder: true });
        coverGallery.prepend(placeholder);

        setTimeout(() => {
          const ready = createCoverGalleryItem({ placeholder: false });
          placeholder.replaceWith(ready);
          coverGenerateBtn.classList.remove("is-loading");
          coverGenerateBtn.textContent = originalText;
          console.log("Kapak üretim isteği burada görsel AI API'ye gidecek.");
        }, 1400);
      } else {
        setTimeout(() => {
          coverGenerateBtn.classList.remove("is-loading");
          coverGenerateBtn.textContent = originalText;
        }, 1000);
      }
    });
  }

  /* =========================================================
     INITIAL SYNC (active page)
     ========================================================= */
  const initialActive = getActivePageKey();

  if (!initialActive) {
    // ✅ HTML'de is-active yoksa: ilk açılış music
    switchPage("music");
  } else {
    setTopnavActive(initialActive);
    setSidebarsActive(initialActive);

    if (initialActive === "music") {
      const currentView = qs(".music-view.is-active")?.getAttribute("data-music-view") || "geleneksel";
      switchMusicView(currentView);
    }

    if (initialActive === "checkout") {
      renderCheckoutFromStorage();
    }
  }

  refreshEmptyStates();

  /* =========================================================
     CHECKOUT ACTIONS (Geri / Ödemeye Geç)
     ========================================================= */
  document.addEventListener("click", (e) => {
    const back = e.target.closest("[data-checkout-back]");
    if (back) {
      e.preventDefault();
      // Studio varsa studio'ya dön, yoksa music'e
      if (pageExists("studio")) switchPage("studio");
      else switchPage("music");
      return;
    }

    const pay = e.target.closest("[data-checkout-pay]");
    if (pay) {
      e.preventDefault();

      // ✅ POPUP / ALERT YOK — sadece kontrol sende
      console.log("Ödeme başlatılacak (Stripe / iyzico – sonraki adım)");

      // İstersen checkout sayfasındaki notu güncelle (UI feedback)
      const note = qs('.page[data-page="checkout"] .checkout-note');
      if (note) {
        note.textContent = "Ödeme entegrasyonu (Stripe/iyzico) bir sonraki adımda bağlanacak.";
      }

      return;
    }
  });

  /* =========================================================
     SIDEBAR TEXT PATCH (accordion / subview uyumlu)
     ========================================================= */
  (function patchSidebarTexts() {
    const mapExact = new Map([
      ["Geleneksel", "AI Müzik (Geleneksel)"],
      ["Ses Kaydı", "AI Ses Kaydı"],
      ["Kapak Üret", "AI Kapak Üret"],
      ["AI Video Üret", "AI Video Üret"],
      ["AI Kapak Üret", "AI Kapak Üret"],
    ]);

    function normalize(s) {
      return (s || "").replace(/\s+/g, " ").trim();
    }

    function applyOnce(root) {
      if (!root) return;

      const nodes = root.querySelectorAll("button, a, span, div");
      nodes.forEach((node) => {
        const raw = normalize(node.textContent);
        if (!raw) return;

        if (mapExact.has(raw)) {
          const span = node.querySelector && node.querySelector("span");
          if (span && normalize(span.textContent) === raw) {
            span.textContent = mapExact.get(raw);
          } else if (node.childElementCount === 0) {
            node.textContent = mapExact.get(raw);
          }
          return;
        }

        if (raw.includes("Müzik Üret")) {
          const span2 = node.querySelector && node.querySelector("span");
          if (span2 && normalize(span2.textContent).includes("Müzik Üret")) {
            span2.textContent = "AI Üret";
          } else if (node.childElementCount === 0) {
            node.textContent = "AI Üret";
          }
        }
      });
    }

    function run() {
      const sidebar =
        document.querySelector(".page.is-active .sidebar") || document.querySelector(".sidebar");
      if (!sidebar) return;
      applyOnce(sidebar);
    }

    run();

    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      const obs = new MutationObserver(() => run());
      obs.observe(sidebar, { childList: true, subtree: true, characterData: true });
    }

    setTimeout(run, 50);
    setTimeout(run, 250);
    setTimeout(run, 600);
  })();

  /* =========================================================
   GLOBAL PLAYER (Music + Record only)
   ========================================================= */
  const gp = {
    root: qs("#globalPlayer"),
    audio: qs("#gpAudio"),
    title: qs("#gpTitle"),
    sub: qs("#gpSub"),
    play: qs("#gpPlay"),
    prev: qs("#gpPrev"),
    next: qs("#gpNext"),
    close: qs("#gpClose"),
    seek: qs("#gpSeek"),
    cur: qs("#gpCur"),
    dur: qs("#gpDur"),
    vol: qs("#gpVol"),
    queue: [],
    idx: -1,
  };

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function gpShow() {
    if (!gp.root) return;
    gp.root.classList.remove("is-hidden");
    gp.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-global-player");
  }

  function gpHide() {
    if (!gp.root) return;
    gp.root.classList.add("is-hidden");
    gp.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-global-player");
  }

  function gpSetTrack(track) {
    if (!track) return;
    if (gp.title) gp.title.textContent = track.title || "Parça";
    if (gp.sub) gp.sub.textContent = track.sub || "AI Müzik / Ses Kaydı";

    if (gp.audio && track.src) {
      gp.audio.src = track.src;
    }
  }

  function gpPlayPause(forcePlay = null) {
    if (!gp.audio) return;

    const shouldPlay = forcePlay === null ? gp.audio.paused : forcePlay;

    if (shouldPlay) {
      gp.audio.play().catch(() => {});
      if (gp.play) gp.play.textContent = "❚❚";
    } else {
      gp.audio.pause();
      if (gp.play) gp.play.textContent = "▶";
    }
  }

  function gpOpenWithQueue(queue, startIndex = 0) {
    gp.queue = Array.isArray(queue) ? queue : [];
    gp.idx = Math.max(0, Math.min(startIndex, gp.queue.length - 1));

    const t = gp.queue[gp.idx];
    gpSetTrack(t);
    gpShow();
    gpPlayPause(true);
  }

  if (gp.play) gp.play.addEventListener("click", () => gpPlayPause(null));
  if (gp.close) gp.close.addEventListener("click", () => { gpPlayPause(false); gpHide(); });

  if (gp.prev) gp.prev.addEventListener("click", () => {
    if (!gp.queue.length) return;
    gp.idx = (gp.idx - 1 + gp.queue.length) % gp.queue.length;
    gpSetTrack(gp.queue[gp.idx]);
    gpPlayPause(true);
  });

  if (gp.next) gp.next.addEventListener("click", () => {
    if (!gp.queue.length) return;
    gp.idx = (gp.idx + 1) % gp.queue.length;
    gpSetTrack(gp.queue[gp.idx]);
    gpPlayPause(true);
  });

  if (gp.vol && gp.audio) {
    gp.audio.volume = Number(gp.vol.value || 0.9);
    gp.vol.addEventListener("input", () => {
      gp.audio.volume = Number(gp.vol.value || 0.9);
    });
  }

  if (gp.audio) {
    gp.audio.addEventListener("loadedmetadata", () => {
      if (gp.dur) gp.dur.textContent = fmtTime(gp.audio.duration);
    });

    gp.audio.addEventListener("timeupdate", () => {
      if (gp.cur) gp.cur.textContent = fmtTime(gp.audio.currentTime);
      if (gp.seek && isFinite(gp.audio.duration) && gp.audio.duration > 0) {
        gp.seek.value = String((gp.audio.currentTime / gp.audio.duration) * 100);
      }
    });

    gp.audio.addEventListener("ended", () => {
      if (!gp.queue.length) { gpPlayPause(false); return; }
      gp.idx = (gp.idx + 1) % gp.queue.length;
      gpSetTrack(gp.queue[gp.idx]);
      gpPlayPause(true);
    });
  }

  if (gp.seek && gp.audio) {
    gp.seek.addEventListener("input", () => {
      if (!isFinite(gp.audio.duration) || gp.audio.duration <= 0) return;
      const pct = Number(gp.seek.value || 0);
      gp.audio.currentTime = (pct / 100) * gp.audio.duration;
    });
  }

  function shouldPlayerBeAllowed() {
    const activeView = qs(".music-view.is-active")?.getAttribute("data-music-view");
    return activeView === "geleneksel" || activeView === "ses-kaydi";
  }

  const _origSwitchMusicView = typeof switchMusicView === "function" ? switchMusicView : null;
  if (_origSwitchMusicView) {
    window.switchMusicView = function patchedSwitchMusicView(key) {
      _origSwitchMusicView(key);

      const allow = shouldPlayerBeAllowed();

      if (allow) {
        gpShow();
        if (gp.play) gp.play.textContent = gp.audio && !gp.audio.paused ? "❚❚" : "▶";
      } else {
        gpPlayPause(false);
        gpHide();
      }
    };
  }

  function bindGlobalPlayerToLists() {
    if (musicList) {
      musicList.addEventListener("click", (e) => {
        const btn = e.target.closest(".media-ico");
        const item = e.target.closest(".media-item.music-item");
        if (!btn || !item) return;

        if (!shouldPlayerBeAllowed()) return;

        const src = item.dataset.src || "";
        gpOpenWithQueue([{ title: "Üretilen Müzik", sub: "AI Müzik (Geleneksel)", src }], 0);
      });
    }

    if (recordList) {
  recordList.addEventListener("click", (e) => {
    const btn = e.target.closest(".media-ico, button");
    const item = e.target.closest(".media-item.record-item");
    if (!btn || !item) return;

    if (!shouldPlayerBeAllowed()) return;

    const src = item.dataset.src || "";
    gpOpenWithQueue([{ title: "Ses Kaydı", sub: "AI Ses Kaydı", src }], 0);
  });
}
}

bindGlobalPlayerToLists();



/* =========================================================
   CHECKOUT — UI + PAY BUTTON (POLISHED / NO POPUP)
   - URL: ?plan=...&price=...
   - Plan/Price render
   - Pay click: loading + disable
   - Backend yoksa: kontrollü mesaj + butonu geri aç
   ========================================================= */
(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }

  function getParam(name) {
    try {
      var url = new URL(window.location.href);
      return (url.searchParams.get(name) || "").trim();
    } catch (e) {
      // very old fallback
      var m = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    }
  }

  function setText(id, value) {
    var el = qs(id);
    if (!el) return;
    el.textContent = value;
  }

  function openMsg(text) {
    var box = qs("#checkoutMsg");
    if (!box) return;
    box.textContent = text;
    box.classList.add("is-open");
  }

  function closeMsg() {
    var box = qs("#checkoutMsg");
    if (!box) return;
    box.classList.remove("is-open");
    box.textContent = "";
  }

  function setPayState(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.dataset.originalText = btn.dataset.originalText || (btn.textContent || "Ödemeye Geç");
      btn.textContent = "İşleniyor…";
    } else {
      btn.disabled = false;
      btn.setAttribute("aria-busy", "false");
      btn.textContent = btn.dataset.originalText || "Ödemeye Geç";
    }
  }

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  onReady(function () {
    // 1) Render plan/price
    var plan = getParam("plan") || "—";
    var price = getParam("price") || "—";

    setText("#checkoutPlan", plan);
    setText("#checkoutPrice", price);

    // 2) Bind buttons
    var backBtn = qs("[data-checkout-back]");
    var payBtn = qs("[data-checkout-pay]");

    if (backBtn) {
      backBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.history.back();
      });
    }

    if (!payBtn) return;

    // Çift tıklama / çift handler koruması
    if (payBtn.dataset.boundCheckoutPay === "1") return;
    payBtn.dataset.boundCheckoutPay = "1";

    payBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      closeMsg();

      // Plan/price yeniden oku (DOM’dan)
      var planEl = qs("#checkoutPlan");
      var priceEl = qs("#checkoutPrice");
      var p = (planEl && planEl.textContent ? planEl.textContent : "").trim();
      var pr = (priceEl && priceEl.textContent ? priceEl.textContent : "").trim();

      if (!p || !pr || p === "—" || pr === "—") {
        openMsg("Paket bilgisi alınamadı. Lütfen geri dönüp tekrar deneyin.");
        return;
      }

      setPayState(payBtn, true);

      try {
        /* =========================================================
           STRIPE (sonraki adım):
           - Backend hazır olunca burası aktif olacak.
           - Örnek endpoint: /api/stripe/checkout-session
           - Response: { url: "https://checkout.stripe.com/..." }
           ========================================================= */

        // ŞİMDİLİK: Backend yoksa “korkutucu hata” yerine nazik mesaj.
        // Aşağıdaki fetch’i backend hazır olunca açacağız:
        /*
        var res = await fetch("/api/stripe/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: p, price: pr })
        });
        if (!res.ok) throw new Error("API error " + res.status);
        var data = await res.json();
        if (!data || !data.url) throw new Error("No checkout url");
        window.location.href = data.url;
        return;
        */

        // Backend yok: kontrollü “hazırlanıyor” mesajı (loading görünsün diye 900ms sonra)
        setTimeout(function () {
          openMsg("Ödeme entegrasyonu hazırlanıyor. Çok yakında Stripe ile canlıya alınacak.");
          setPayState(payBtn, false);
        }, 900);

      } catch (err) {
        console.error("[checkout] pay error:", err);
        openMsg("Şu an ödeme başlatılamadı. Lütfen birkaç dakika sonra tekrar deneyin.");
        setPayState(payBtn, false);
      }
    });
  });
})();
/* =========================================================
   CHECKOUT – MOCK PAYMENT (DROP-IN / NO EXTRA CLOSING)
   - Yeni DOMContentLoaded yok
   - Yeni kapanış yok
   - Checkout sayfasında [data-checkout-pay] varsa çalışır
   ========================================================= */
(function bindMockPaymentOnce() {
  if (window.__aivoMockPaymentBound) return;
  window.__aivoMockPaymentBound = true;

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function getParam(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; }
    catch (e) { return ""; }
  }

  function setPayState(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.prevText = btn.textContent || "Ödemeye Geç";
      btn.textContent = "İşleniyor…";
      btn.disabled = true;
      btn.classList.add("is-loading");
    } else {
      btn.textContent = btn.dataset.prevText || "Ödemeye Geç";
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  }

  function addDemoCredits(amount) {
    var key = "aivo_credits";
    var cur = 0;
    try { cur = parseInt(localStorage.getItem(key) || "0", 10) || 0; } catch (e) {}
    localStorage.setItem(key, String(cur + (amount || 0)));
  }

  function saveDemoInvoice(invoice) {
    var key = "aivo_invoices";
    var list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
    list.unshift(invoice);
    localStorage.setItem(key, JSON.stringify(list));
  }

  // checkout sayfasında pay butonu yoksa hiç dokunma
  var payBtn = qs("[data-checkout-pay]");
  if (!payBtn) return;

  // plan / fiyat alanları (varsa)
  var planEl = qs("#checkoutPlan");
  var priceEl = qs("#checkoutPrice");

  // double-bind koruması
  if (payBtn.dataset.boundMockPay === "1") return;
  payBtn.dataset.boundMockPay = "1";

  payBtn.addEventListener("click", function () {
    if (payBtn.dataset.locked === "1") return;
    payBtn.dataset.locked = "1";

    var plan = (planEl && planEl.textContent) ? planEl.textContent : getParam("plan");
    var price = (priceEl && priceEl.textContent) ? priceEl.textContent : getParam("price");

    plan = String(plan || "").trim();
    price = String(price || "").trim();

    if (!plan || !price) {
      alert("Plan / fiyat okunamadı. Pricing ekranından tekrar deneyin.");
      payBtn.dataset.locked = "0";
      return;
    }

    setPayState(payBtn, true);

    fetch("/api/mock-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan, price: price })
    })
      .then(function (r) {
        return r.json().catch(function () { return null; })
          .then(function (data) { return { ok: r.ok, data: data }; });
      })
      .then(function (res) {
        var data = res.data;

        if (!res.ok || !data || data.ok !== true) {
          alert((data && data.message) || "Mock ödeme başarısız. Tekrar deneyin.");
          payBtn.dataset.locked = "0";
          setPayState(payBtn, false);
          return;
        }

        // ✅ demo kredi ekle
        addDemoCredits(data.creditsAdded || 0);

        // ✅ demo fatura kaydı
        saveDemoInvoice({
          invoiceId: data.invoiceId,
          paymentId: data.paymentId,
          plan: data.plan,
          price: data.price,
          creditsAdded: data.creditsAdded,
          createdAt: new Date().toISOString()
        });

        // ✅ yönlendirme
        window.location.href = "/?page=invoices&v=" + Date.now();
      })
      .catch(function () {
        alert("Ağ hatası (demo).");
        payBtn.dataset.locked = "0";
        setPayState(payBtn, false);
      });
  });
})();

/* =========================================================
   CHECKOUT – MOCK PAYMENT (FRONTEND / SAFE)
   ========================================================= */

(function initCheckoutMockFlow() {
  if (window.__aivoCheckoutMockInit) return;
  window.__aivoCheckoutMockInit = true;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch (_) {
      return "";
    }
  }

  const payBtn = qs("[data-checkout-pay]");
  if (!payBtn) return; // checkout sayfası değilse çık

  if (payBtn.dataset.bound === "1") return;
  payBtn.dataset.bound = "1";

  const planEl = qs("#checkoutPlan");
  const priceEl = qs("#checkoutPrice");

  function setPayState(loading) {
    if (loading) {
      payBtn.dataset.prevText = payBtn.textContent || "Ödemeye Geç";
      payBtn.textContent = "İşleniyor…";
      payBtn.disabled = true;
    } else {
      payBtn.textContent = payBtn.dataset.prevText || "Ödemeye Geç";
      payBtn.disabled = false;
    }
  }

  function addDemoCredits(amount) {
    try {
      const cur = parseInt(localStorage.getItem("aivo_credits") || "0", 10) || 0;
      localStorage.setItem("aivo_credits", String(cur + (amount || 0)));
    } catch (_) {}
  }

  function saveDemoInvoice(data) {
    try {
      const list = JSON.parse(localStorage.getItem("aivo_invoices") || "[]");
      list.unshift({
        invoiceId: data.invoiceId,
        paymentId: data.paymentId,
        plan: data.plan,
        price: data.price,
        creditsAdded: data.creditsAdded,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem("aivo_invoices", JSON.stringify(list));
    } catch (_) {}
  }

  payBtn.addEventListener("click", function () {
    if (payBtn.dataset.locked === "1") return;
    payBtn.dataset.locked = "1";

    let plan =
      (planEl && planEl.textContent) ||
      getParam("plan");

    let price =
      (priceEl && priceEl.textContent) ||
      getParam("price");

    plan = String(plan || "").trim();
    price = String(price || "").trim();

    if (!plan || !price) {
      alert("Plan / fiyat alınamadı.");
      payBtn.dataset.locked = "0";
      return;
    }

    setPayState(true);

    fetch("/api/mock-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, price })
    })
      .then(res =>
        res.json().catch(() => null).then(data => ({ ok: res.ok, data }))
      )
      .then(r => {
        if (!r.ok || !r.data || r.data.ok !== true) {
          alert((r.data && r.data.message) || "Mock ödeme başarısız.");
          payBtn.dataset.locked = "0";
          setPayState(false);
          return;
        }

        addDemoCredits(r.data.creditsAdded || 0);
        saveDemoInvoice(r.data);

        window.location.href = "/?page=invoices&v=" + Date.now();
      })
      .catch(() => {
        alert("Ağ hatası oluştu.");
        payBtn.dataset.locked = "0";
        setPayState(false);
      });
  });
})();
/* =========================================================
   INVOICES – RENDER (localStorage aivo_invoices)
   - Yeni DOMContentLoaded yok
   - Yeni kapanış yok
   ========================================================= */
(function initInvoicesUI() {
  if (window.__aivoInvoicesUIInit) return;
  window.__aivoInvoicesUIInit = true;

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function readInvoices() {
    try {
      var list = JSON.parse(localStorage.getItem("aivo_invoices") || "[]");
      if (!Array.isArray(list)) return [];
      return list;
    } catch (e) {
      return [];
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("tr-TR");
    } catch (e) { return ""; }
  }

  function renderInvoices() {
    var host = qs("#invoicesList");
    if (!host) return; // sayfa değilse çık

    var list = readInvoices();

    if (!list.length) {
      host.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-title">Henüz fatura yok</div>' +
          '<div class="empty-desc">Demo ödeme yaptığında faturalar burada listelenecek.</div>' +
        "</div>";
      return;
    }

    var html = "";
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      html +=
        '<div class="invoice-card">' +
          '<div class="inv-row">' +
            '<div class="inv-main">' +
              '<div class="inv-plan">' + esc(it.plan || "Paket") + '</div>' +
              '<div class="inv-meta">Tutar: <b>' + esc(it.price || "-") + "</b></div>" +
            "</div>" +
            '<div class="inv-side">' +
              '<div class="inv-date">' + esc(fmtDate(it.createdAt)) + "</div>" +
              '<div class="inv-ids">#' + esc(it.invoiceId || "-") + "</div>" +
            "</div>" +
          "</div>" +
          '<div class="inv-foot">' +
            '<span class="inv-credits">Kredi: +' + esc(it.creditsAdded || 0) + "</span>" +
            '<button class="btn btn-mini" type="button" data-copy-inv="' + esc(it.invoiceId || "") + '">Kopyala</button>' +
          "</div>" +
        "</div>";
    }

    host.innerHTML = html;
  }

  // Sayfaya her girişte render (switchPage çağrılarında da güncellenir)
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest('[data-page-link="invoices"]') : null;
    if (link) setTimeout(renderInvoices, 0);
  });

  // Kopyala butonu
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-copy-inv]") : null;
    if (!btn) return;
    var id = btn.getAttribute("data-copy-inv") || "";
    if (!id) return;
    try {
      navigator.clipboard.writeText(id);
      btn.textContent = "Kopyalandı";
      setTimeout(function () { btn.textContent = "Kopyala"; }, 800);
    } catch (err) {
      alert("Kopyalama desteklenmiyor.");
    }
  });

  // Temizle
  var clearBtn = qs("#invoicesClear");
  if (clearBtn && clearBtn.dataset.bound !== "1") {
    clearBtn.dataset.bound = "1";
    clearBtn.addEventListener("click", function () {
      try { localStorage.removeItem("aivo_invoices"); } catch (e) {}
      renderInvoices();
    });
  }

  // İlk yüklemede de dene
  renderInvoices();
})();

  /* =========================================================
   INVOICES – RENDER (localStorage aivo_invoices)
   - Yeni DOMContentLoaded yok
   - Yeni kapanış yok
   ========================================================= */
(function initInvoicesUI() {
  if (window.__aivoInvoicesUIInit) return;
  window.__aivoInvoicesUIInit = true;

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function readInvoices() {
    try {
      var list = JSON.parse(localStorage.getItem("aivo_invoices") || "[]");
      if (!Array.isArray(list)) return [];
      return list;
    } catch (e) {
      return [];
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("tr-TR");
    } catch (e) { return ""; }
  }

  function renderInvoices() {
    var host = qs("#invoicesList");
    if (!host) return; // sayfa değilse çık

    var list = readInvoices();

    if (!list.length) {
      host.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-title">Henüz fatura yok</div>' +
          '<div class="empty-desc">Demo ödeme yaptığında faturalar burada listelenecek.</div>' +
        "</div>";
      return;
    }

    var html = "";
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      html +=
        '<div class="invoice-card">' +
          '<div class="inv-row">' +
            '<div class="inv-main">' +
              '<div class="inv-plan">' + esc(it.plan || "Paket") + '</div>' +
              '<div class="inv-meta">Tutar: <b>' + esc(it.price || "-") + "</b></div>" +
            "</div>" +
            '<div class="inv-side">' +
              '<div class="inv-date">' + esc(fmtDate(it.createdAt)) + "</div>" +
              '<div class="inv-ids">#' + esc(it.invoiceId || "-") + "</div>" +
            "</div>" +
          "</div>" +
          '<div class="inv-foot">' +
            '<span class="inv-credits">Kredi: +' + esc(it.creditsAdded || 0) + "</span>" +
            '<button class="btn btn-mini" type="button" data-copy-inv="' + esc(it.invoiceId || "") + '">Kopyala</button>' +
          "</div>" +
        "</div>";
    }

    host.innerHTML = html;
  }

  // Sayfaya her girişte render (switchPage çağrılarında da güncellenir)
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest('[data-page-link="invoices"]') : null;
    if (link) setTimeout(renderInvoices, 0);
  });

  // Kopyala butonu
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-copy-inv]") : null;
    if (!btn) return;
    var id = btn.getAttribute("data-copy-inv") || "";
    if (!id) return;
    try {
      navigator.clipboard.writeText(id);
      btn.textContent = "Kopyalandı";
      setTimeout(function () { btn.textContent = "Kopyala"; }, 800);
    } catch (err) {
      alert("Kopyalama desteklenmiyor.");
    }
  });

  // Temizle
  var clearBtn = qs("#invoicesClear");
  if (clearBtn && clearBtn.dataset.bound !== "1") {
    clearBtn.dataset.bound = "1";
    clearBtn.addEventListener("click", function () {
      try { localStorage.removeItem("aivo_invoices"); } catch (e) {}
      renderInvoices();
    });
  }

  // İlk yüklemede de dene
  renderInvoices();
})();

  /* =========================================================
   TOPBAR CREDITS – LIVE BIND (localStorage aivo_credits)
   - No extra DOMContentLoaded
   - No extra closing
   ========================================================= */
(function initCreditsPill() {
  if (window.__aivoCreditsBind) return;
  window.__aivoCreditsBind = true;

  function qs(sel, root) { return (root || document).querySelector(sel); }

  // Kredi pill'ini esnek yakala:
  // 1) id varsa (#creditsPill / #creditsCount) tercih edilir
  // 2) yoksa "Kredi" yazan buton/spandaki text’i günceller
  function findCreditsNode() {
    return (
      qs("#creditsCount") ||
      qs("#creditsPill") ||
      qs("[data-credits-pill]") ||
      qs(".topbar-credits") ||
      null
    );
  }

  function render() {
  var nodes = document.querySelectorAll("[data-credits-pill]");
  if (!nodes || !nodes.length) return;

  var credits = 0;
  try {
    credits = parseInt(localStorage.getItem("aivo_credits") || "0", 10) || 0;

  } catch (e) {
    credits = 0;
  }

  nodes.forEach(function (el) {
    var text = (el.textContent || "").trim();

    if (/Kredi/i.test(text)) {
      el.textContent = text.replace(/Kredi\s*\d+/i, "Kredi " + credits);

    } else {
      el.textContent = "Kredi " + credits;
    }
  });
}


  // İlk render
  render();

  // Sayfa geçişlerinde tekrar render (switchPage varsa)
  var _sp = window.switchPage;
  if (typeof _sp === "function" && !_sp.__creditsWrapped) {
    function wrappedSwitchPage(p) {
      _sp(p);
      setTimeout(render, 0);
    }
    wrappedSwitchPage.__creditsWrapped = true;
    window.switchPage = wrappedSwitchPage;
  }

  // Storage değişince (bazı tarayıcılarda aynı tab tetiklemez, yine de ekleyelim)
  window.addEventListener("storage", function (e) {
    if (e.key === "aivo_credits") render();
  });

  // Her 1.5s kısa polling (demo için güvenli)
  setInterval(render, 1500);
})();



  /* =========================================================
     GLOBAL PLAYER – INITIAL VISIBILITY (SAFE)
     ========================================================= */
  if (
    typeof shouldPlayerBeAllowed === "function" &&
    typeof gpShow === "function" &&
    typeof gpHide === "function"
  ) {
    if (shouldPlayerBeAllowed()) gpShow();
    else gpHide();
  }
/* =========================================================
   SPEND (KREDİ HARCATMA) — delegated click (SAFE)
   - Yeni DOMContentLoaded yok
   - Tek handler, tek kez bağlanır
   - Kredi yeterliyse düşer + render()
   - Kredi yetmezse engeller + pricing açmayı dener
   ========================================================= */
(function bindSpendOnce() {
  if (window.__aivoSpendBound) return;
  window.__aivoSpendBound = true;

  // ---- credits helpers (projende varsa onları kullanır)
  function readCreditsSafe() {
    try {
      // projende readCredits() varsa onu kullan
      if (typeof window.readCredits === "function") return Number(window.readCredits()) || 0;
      var v = localStorage.getItem("aivo_credits");
      var n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    } catch (e) { return 0; }
  }

  function writeCreditsSafe(val) {
    try {
      var n = Math.max(0, parseInt(String(val), 10) || 0);
      // projende writeCredits() varsa onu kullan
      if (typeof window.writeCredits === "function") { window.writeCredits(n); return; }
      localStorage.setItem("aivo_credits", String(n));
    } catch (e) {}
  }

  function callRenderSafe() {
    try {
      if (typeof window.render === "function") window.render();
      // bazı projelerde credits pill ayrı güncelleniyor olabilir
      if (typeof window.renderCredits === "function") window.renderCredits();
    } catch (e) {}
  }

  // ---- UI message (popup yok): küçük toast
  function showToast(msg, type) {
    var id = "aivoSpendToast";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.setAttribute("role", "status");
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "20px";
      el.style.transform = "translateX(-50%)";
      el.style.zIndex = "99999";
      el.style.maxWidth = "90vw";
      el.style.padding = "10px 12px";
      el.style.borderRadius = "12px";
      el.style.fontSize = "14px";
      el.style.backdropFilter = "blur(10px)";
      el.style.boxShadow = "0 20px 60px rgba(0,0,0,.55)";
      el.style.opacity = "0";
      el.style.transition = "opacity .15s ease";
      document.body.appendChild(el);
    }

    // renk vermeden da “type”e göre hafif fark (inline style minimum)
    var bg = (type === "error")
      ? "rgba(90, 20, 30, .85)"
      : (type === "ok")
        ? "rgba(20, 70, 40, .85)"
        : "rgba(15, 20, 40, .85)";

    el.style.background = bg;
    el.style.border = "1px solid rgba(255,255,255,.10)";
    el.style.color = "rgba(255,255,255,.92)";
    el.textContent = msg;

    // göster / gizle
    el.style.opacity = "1";
    clearTimeout(el.__t);
    el.__t = setTimeout(function () {
      el.style.opacity = "0";
    }, 2200);
  }

  // ---- pricing açmayı dene
  function openPricingIfPossible() {
    // 1) data-open-pricing butonu varsa tıkla
    var btn = document.querySelector("[data-open-pricing]");
    if (btn) { btn.click(); return true; }

    // 2) creditsButton id varsa tıkla
    var cb = document.getElementById("creditsButton");
    if (cb) { cb.click(); return true; }

    // 3) modal fonksiyonu varsa dene
    if (typeof window.openPricingModal === "function") { window.openPricingModal(); return true; }

    return false;
  }

  // ---- müzikte "Ses Üretimi" kapalıysa %33 daha az kredi (yaklaşık)
  function getEffectiveCost(action, baseCost) {
    var cost = Math.max(0, parseInt(String(baseCost), 10) || 0);

    if (action === "music") {
      var audioToggle = document.getElementById("audioEnabled");
      // kapalıysa %33 daha az harcar => 0.67 ile çarp, yukarı yuvarla (en az 1 kredi gibi)
      if (audioToggle && audioToggle.checked === false) {
        var discounted = Math.ceil(cost * 0.67);
        cost = Math.max(0, discounted);
      }
    }

    return cost;
  }

  // ---- delegated click handler
  document.addEventListener("click", function (e) {
    var t = e.target;

    // closest fallback (Safari safe)
    var btn = null;
    if (t && typeof t.closest === "function") {
      btn = t.closest("[data-generate][data-credit-cost]");
    } else {
      // çok eski fallback (gerekirse)
      var node = t;
      while (node && node !== document) {
        if (node.getAttribute && node.getAttribute("data-generate") && node.getAttribute("data-credit-cost")) {
          btn = node; break;
        }
        node = node.parentNode;
      }
    }

    if (!btn) return;

    // buton default davranışını engelle (form submit vs)
    e.preventDefault();

    var action = (btn.getAttribute("data-generate") || "").trim();     // music / video / cover
    var baseCost = btn.getAttribute("data-credit-cost");
    var cost = getEffectiveCost(action, baseCost);

    // maliyet 0 ise (test) izin ver
    var credits = readCreditsSafe();

    if (credits < cost) {
      showToast("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
      openPricingIfPossible();
      return;
    }

    // düş
    var next = credits - cost;
    writeCreditsSafe(next);
    callRenderSafe();

    showToast("İşlem başlatıldı. " + cost + " kredi harcandı.", "ok");

    // NOT: Üretim çağrısı/flow senin mevcut generate kodlarında devam ediyorsa,
    // burada ekstra bir şey yapmıyoruz. Sadece kredi düşümü + UI güncellemesi.
  }, true);
})();
/* =========================================================
   INVOICES (LOCAL DEMO) — Eita-style Cards
   - Satın alma sonrası invoice ekler
   - Faturalarım sayfasında listeler
   ========================================================= */
(function () {
  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }
  function pad2(n){ return (n < 10 ? "0" : "") + n; }
  function nowText() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function makeInvoiceId() {
    // Basit demo id
    return "INV-" + Date.now();
  }

  function readInvoices() {
    var raw = localStorage.getItem("aivo_invoices");
    var arr = safeJSONParse(raw, []);
    if (!Array.isArray(arr)) arr = [];
    return arr;
  }

  function writeInvoices(list) {
    localStorage.setItem("aivo_invoices", JSON.stringify(list || []));
  }

  // Dışarıdan çağırmak için global expose (debug kolaylığı)
  window.aivoInvoices = window.aivoInvoices || {};
  window.aivoInvoices.read = readInvoices;
  window.aivoInvoices.write = writeInvoices;

  function addInvoice(entry) {
    var list = readInvoices();
    list.unshift(entry); // en üste
    writeInvoices(list);
  }

  function esc(s){
    return String(s || "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function renderInvoicesIntoDOM() {
    var listEl = document.getElementById("invoicesList");
    var emptyEl = document.getElementById("invoicesEmpty");
    if (!listEl || !emptyEl) return;

    var list = readInvoices();

    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }

    emptyEl.style.display = "none";

    var html = "";
    for (var i=0; i<list.length; i++) {
      var inv = list[i] || {};
      var statusClass = (inv.status === "Ödendi" || inv.status === "Paid" || inv.status === "OK") ? "ok" : "";
      html +=
        '<div class="invoice-card">' +
          '<div class="invoice-top">' +
            '<div class="invoice-badge">🧾 <span>' + esc(inv.plan || "Paket") + '</span></div>' +
            '<div class="invoice-status ' + statusClass + '">' + esc(inv.status || "Ödendi") + '</div>' +
          '</div>' +

          '<div class="invoice-mid">' +
            '<div class="invoice-plan">' + esc(inv.plan || "Paket") + '</div>' +
            '<div class="invoice-meta">' +
              '<div class="meta-box">' +
                '<div class="meta-label">Kredi</div>' +
                '<div class="meta-value">' + esc(inv.credits || 0) + '</div>' +
              '</div>' +
              '<div class="meta-box">' +
                '<div class="meta-label">Tutar</div>' +
                '<div class="meta-value">' + esc(inv.price || "—") + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="invoice-bottom">' +
            '<div class="invoice-id">' + esc(inv.id || "—") + '</div>' +
            '<div class="invoice-date">' + esc(inv.date || "—") + '</div>' +
          '</div>' +
        '</div>';
    }
    listEl.innerHTML = html;
  }

  // Sayfa geçişlerinde render: switchPage varsa yakalarız (bozmadan)
  (function hookInvoicesRender() {
    if (window.__aivoInvoicesHooked) return;
    window.__aivoInvoicesHooked = true;

    // 1) Eğer switchPage varsa wrap et
    if (typeof window.switchPage === "function") {
      var _switch = window.switchPage;
      window.switchPage = function (page) {
        var r = _switch.apply(this, arguments);
        try {
          if (page === "invoices") renderInvoicesIntoDOM();
        } catch (e) {}
        return r;
      };
    }

    // 2) Direkt “Faturalarım” linkine tıklanınca da render dene (delegated)
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-page-link="invoices"]') : null;
      if (!btn) return;
      setTimeout(renderInvoicesIntoDOM, 0);
    }, true);

    // 3) Sayfa zaten invoices açık gelirse (edge)
    setTimeout(renderInvoicesIntoDOM, 0);
  })();

  // Demo temizleme
  (function bindInvoicesClear() {
    if (window.__aivoInvoicesClearBound) return;
    window.__aivoInvoicesClearBound = true;

    document.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("#invoicesClearBtn") : null;
      if (!b) return;
      localStorage.removeItem("aivo_invoices");
      renderInvoicesIntoDOM();
      try { window.showToast && window.showToast("Demo faturalar temizlendi.", "ok"); } catch (e2) {}
    }, true);
  })();

  // ✅ ÖNEMLİ: Mock ödeme başarıyla tamamlandığında burada fatura ekleyeceğiz.
  // Senin mock success noktanı yakalamak için 2 güvenli yöntem veriyorum:

// Yöntem A (önerilen): Checkout success event’i yayınla (aşağıda anlatacağım)
  document.addEventListener("aivo:payment_success", function (ev) {
    var d = (ev && ev.detail) ? ev.detail : {};
    addInvoice({
      id: d.invoiceId || makeInvoiceId(),
      date: nowText(),
      plan: d.plan || "Paket",
      credits: Number(d.creditsAdded || 0),
      price: d.price || "—",
      status: "Ödendi"
    });
  });

  // Render fonksiyonunu debug için dışa aç
  window.aivoInvoices.render = renderInvoicesIntoDOM;
})();

}); // ✅ SADECE 1 TANE KAPANIŞ — DOMContentLoaded
