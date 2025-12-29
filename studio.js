// AIVO STUDIO – STUDIO.JS (FULL)
// Navigation + Music subviews + Pricing modal + Media modal + Right panel
/* =========================================================
   AIVO STORE v1 — SINGLE SOURCE OF TRUTH (credits + invoices)
   Key: localStorage["aivo_store_v1"]
   ========================================================= */
// =========================================================
// DEBUG: Mock alert kill-switch (temporary)
// =========================================================
(function () {
  const _alert = window.alert;
  window.alert = function (msg) {
    try {
      const s = String(msg || "");
      if (s.toLowerCase().includes("mock ödeme")) {
        console.warn("[ALERT BLOCKED]", s);
        return;
      }
    } catch (_) {}
    return _alert.apply(window, arguments);
  };
})();

(function () {
  "use strict";

  // global erişim: window.AIVO_STORE_V1
  if (window.AIVO_STORE_V1) return;

  var STORE_KEY = "aivo_store_v1";

  function nowISO() {
    try { return new Date().toISOString(); } catch (e) { return ""; }
  }

  function safeJSONParse(str, fallback) {
    try {
      if (!str) return fallback;
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  function clampInt(n, min) {
    n = Number(n);
    if (!Number.isFinite(n)) n = 0;
    n = Math.floor(n);
    if (typeof min === "number" && n < min) n = min;
    return n;
  }

  function defaultStore() {
    return {
      v: 1,
      credits: 0,
      invoices: [],
      meta: {
        createdAt: nowISO(),
        updatedAt: nowISO()
      }
    };
  }

  function readRaw() {
    return safeJSONParse(localStorage.getItem(STORE_KEY), null);
  }

  function writeRaw(obj) {
    obj = obj || defaultStore();
    if (!obj.meta) obj.meta = {};
    obj.meta.updatedAt = nowISO();
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    return obj;
  }

  function normalize(store) {
    if (!store || typeof store !== "object") store = defaultStore();
    if (store.v !== 1) store.v = 1;

    store.credits = clampInt(store.credits, 0);

    if (!Array.isArray(store.invoices)) store.invoices = [];

    // normalize invoices minimal schema
    store.invoices = store.invoices
      .filter(function (x) { return x && typeof x === "object"; })
      .map(function (inv) {
        return {
          id: String(inv.id || ("inv_" + Math.random().toString(16).slice(2))),
          createdAt: String(inv.createdAt || nowISO()),
          title: String(inv.title || "Kredi Satın Alımı"),
          amountTRY: clampInt(inv.amountTRY || inv.amount || 0, 0),
          credits: clampInt(inv.credits || 0, 0),
          provider: String(inv.provider || "stripe"),
          status: String(inv.status || "paid"),
          ref: inv.ref ? String(inv.ref) : "" // session_id / payment_intent / etc.
        };
      });

    if (!store.meta) store.meta = { createdAt: nowISO(), updatedAt: nowISO() };
    if (!store.meta.createdAt) store.meta.createdAt = nowISO();
    if (!store.meta.updatedAt) store.meta.updatedAt = nowISO();

    return store;
  }

  function read() {
    var s = normalize(readRaw());
    // eğer store yoksa yaz (ilk kurulum)
    if (!localStorage.getItem(STORE_KEY)) writeRaw(s);
    return s;
  }

  function set(next) {
    return writeRaw(normalize(next));
  }

  function update(mutator) {
    var s = read();
    var out = mutator ? mutator(s) : s;
    return set(out || s);
  }

  // -------------------------
  // One-time MIGRATION
  // From legacy keys:
  //  - aivo_credits
  //  - aivo_invoices
  // -------------------------
  function migrateOnce() {
    var marker = "aivo_store_v1_migrated";
    if (localStorage.getItem(marker) === "1") return;

    var legacyCredits = localStorage.getItem("aivo_credits");
    var legacyInvoices = localStorage.getItem("aivo_invoices");

    if (legacyCredits == null && legacyInvoices == null) {
      localStorage.setItem(marker, "1");
      return;
    }

    update(function (s) {
      if (legacyCredits != null) {
        var c = clampInt(legacyCredits, 0);
        if (c > 0 && s.credits === 0) s.credits = c; // çakışma olmasın diye
      }

      if (legacyInvoices != null) {
        var arr = safeJSONParse(legacyInvoices, []);
        if (Array.isArray(arr) && arr.length && (!s.invoices || !s.invoices.length)) {
          s.invoices = arr; // normalize() zaten düzeltecek
        }
      }
      return s;
    });

    // legacy anahtarlar istersen silinebilir; şimdilik güvenli yaklaşım: silme
    // localStorage.removeItem("aivo_credits");
    // localStorage.removeItem("aivo_invoices");

    localStorage.setItem(marker, "1");
  }

  // -------------------------
  // Public API
  // -------------------------
  function getCredits() {
    return read().credits;
  }

  function setCredits(val) {
    return update(function (s) {
      s.credits = clampInt(val, 0);
      return s;
    });
  }

  function addCredits(delta) {
    delta = clampInt(delta, 0);
    return update(function (s) {
      s.credits = clampInt(s.credits + delta, 0);
      return s;
    });
  }

  function consumeCredits(cost) {
    cost = clampInt(cost, 0);
    return update(function (s) {
      if (s.credits < cost) return s;
      s.credits = clampInt(s.credits - cost, 0);
      return s;
    });
  }

  function listInvoices() {
    return read().invoices.slice(); // copy
  }

  function addInvoice(invoice) {
    return update(function (s) {
      s.invoices.unshift(invoice || {});
      return s;
    });
  }

  function resetAll() {
    return writeRaw(defaultStore());
  }

  // init
  migrateOnce();

  window.AIVO_STORE_V1 = {
    key: STORE_KEY,
    read: read,
    set: set,
    update: update,
    getCredits: getCredits,
    setCredits: setCredits,
    addCredits: addCredits,
    consumeCredits: consumeCredits,
    listInvoices: listInvoices,
    addInvoice: addInvoice,
    resetAll: resetAll
  };
})();

document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     HELPERS
     ========================================================= */
const AIVO_PLANS = {
  AIVO_STARTER: { price: 99, credits: 100 },
  AIVO_PRO: { price: 199, credits: 300 },
  AIVO_STUDIO: { price: 399, credits: 800 },
};

   async function aivoStartPurchase(payload) {
  const r = await fetch("/api/payments/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) {
    throw new Error(data.error || "Purchase init failed");
  }
  return data; // { ok:true, mode:"mock", orderId, ... }
}
async function onBuyPlan(planCode) {
  const plan = AIVO_PLANS[planCode];
  if (!plan) {
    alert("Plan bulunamadı");
    return;
  }
try {
  const data = await aivoStartPurchase({
    planCode,
    amountTRY: plan.price,
    email: "test@aivo.tr",
    userName: "Test User",
    userAddress: "Istanbul",
    userPhone: "5000000000",
  });

  aivoGrantCreditsAndInvoice({
    orderId: data.orderId,
    planCode,
    amountTRY: plan.price,
    creditsAdded: plan.credits,
  });

  alert("Satın alma başarılı (mock)");
} catch (e) {
  alert(e.message);
}

  try {
    const data = await aivoStartPurchase({
      planCode,
      amountTRY: plan.price,
      email: "test@aivo.tr",
      userName: "Test User",
      userAddress: "Istanbul",
      userPhone: "5000000000",
    });

    aivoGrantCreditsAndInvoice({
      orderId: data.orderId,
      planCode,
      amountTRY: plan.price,
      creditsAdded: plan.credits,
    });

    alert("Satın alma başarılı (mock)");
  } catch (e) {
    alert(e.message);
  }
}

function aivoGrantCreditsAndInvoice({ orderId, planCode, amountTRY, creditsAdded }) {
  // kredi
  const currentCredits = Number(localStorage.getItem("aivo_credits") || 0);
  localStorage.setItem("aivo_credits", String(currentCredits + creditsAdded));

  // fatura
  const invoices = JSON.parse(localStorage.getItem("aivo_invoices") || "[]");
  invoices.unshift({
    id: orderId,
    provider: "mock",
    planCode,
    amountTRY,
    creditsAdded,
    createdAt: new Date().toISOString(),
    status: "PAID",
  });
  localStorage.setItem("aivo_invoices", JSON.stringify(invoices));
}

// Örn: butona bağlayacağımız tek fonksiyon
async function onBuyClick(planCode, amountTRY) {
  try {
    // Müşteri bilgileri şimdilik sabit/placeholder olabilir (sonra profile’dan gelir)
    const payload = {
      planCode,
      amountTRY,
      email: "test@aivo.tr",
      userName: "Test User",
      userAddress: "Istanbul",
      userPhone: "5000000000",
    };

    const init = await aivoStartPurchase(payload);

    // Mock başarı: plan->kredi eşlemesi (senin paket mantığına göre güncelleriz)
    const creditsAdded = planCode === "AIVO_PRO" ? 100 : 50;

    aivoGrantCreditsAndInvoice({
      orderId: init.orderId,
      planCode: init.planCode,
      amountTRY: init.amountTRY,
      creditsAdded,
    });

    // UI: faturalar sayfasına götür (senin router/switchPage fonksiyonun neyse onu çağır)
    if (typeof switchPage === "function") {
      switchPage("invoices");
    } else {
      // fallback: sayfada invoices varsa aktive et
      const el = document.querySelector('.page[data-page="invoices"]');
      if (el) {
        document.querySelectorAll(".page").forEach(p => p.classList.remove("is-active"));
        el.classList.add("is-active");
      }
    }
  } catch (err) {
    alert(err.message || "Satın alma başlatılamadı");
  }
}

  // === KREDİ UI SYNC (HTML'deki Kredi <span id="creditCount"> için) ===
  (function syncCreditsUI() {
    try {
      var el = document.getElementById("creditCount");
      if (!el) return;

      // Şimdilik legacy kaynaktan oku (store'a sonra bağlayacağız)
      var credits = Number(localStorage.getItem("aivo_credits") || 0);
      el.textContent = String(credits);
    } catch (e) {
      // bilinçli olarak sessiz
    }
  })();

  // ↓↓↓ BURADAN SONRA SENİN MEVCUT HELPERS FONKSİYONLARIN DEVAM EDECEK ↓↓↓

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
        musicGenerateBtn.classList.remove("is-loading");
        musicGenerateBtn.textContent = originalText;
        console.log("Müzik üretim isteği burada API'ye gidecek.");
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
// =========================================================
// STRIPE CHECKOUT START (REAL) — AIVO
// =========================================================
async function startStripeCheckout(plan) {
  try {
    const successUrl = "https://www.aivo.tr/studio.html";
    const cancelUrl  = "https://www.aivo.tr/studio.html";

    const r = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: plan,
        successUrl: successUrl,
        cancelUrl: cancelUrl
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data || !data.url) {
      console.error("[StripeCheckout] failed:", r.status, data);
      alert("Checkout başarısız: " + (data.error || data.message || ("HTTP " + r.status)));
      return;
    }

    // 👉 GERÇEK STRIPE CHECKOUT
    window.location.href = data.url;
  } catch (e) {
    console.error("[StripeCheckout] error:", e);
    alert("Checkout başlatılamadı. Console'u kontrol et.");
  }
}
// =========================================================
// STRIPE CHECKOUT START (helper) — AIVO
// =========================================================
async function startStripeCheckout(plan) {
  try {
    const successUrl = "https://www.aivo.tr/studio.html";
    const cancelUrl  = "https://www.aivo.tr/studio.html?page=checkout";

    const r = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, successUrl, cancelUrl }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data || !data.url) {
      console.error("[StripeCheckout] failed:", r.status, data);
      alert("Checkout başarısız: " + (data.error || data.message || ("HTTP " + r.status)));
      return;
    }

    // Stripe'a git
    window.location.href = data.url;
  } catch (e) {
    console.error("[StripeCheckout] error:", e);
    alert("Checkout başlatılamadı. Console'u kontrol et.");
  }
}
// =========================================================
// STRIPE CHECKOUT START (GLOBAL) – AIVO
// =========================================================
window.startStripeCheckout = async function (plan) {
  try {
    console.log("[Stripe] startStripeCheckout called with plan:", plan);

    const successUrl = "https://www.aivo.tr/studio.html";
    const cancelUrl  = "https://www.aivo.tr/studio.html?page=checkout";

    const r = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: plan,
        successUrl: successUrl,
        cancelUrl: cancelUrl
      })
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data || !data.url) {
      console.error("[Stripe] Checkout failed:", r.status, data);
      alert("Ödeme başlatılamadı.");
      return;
    }

    // Stripe'a yönlendir
    window.location.href = data.url;

  } catch (err) {
    console.error("[Stripe] Fatal error:", err);
    alert("Ödeme başlatılamadı.");
  }
};

/* =========================================================
   CHECKOUT – STRIPE PAYMENT (REAL)
   Not: Bu blok, checkout sayfasındaki [data-checkout-pay] butonunu
        gerçek Stripe Checkout'a bağlar.
   ========================================================= */

(function initCheckoutStripeFlow() {
  if (window.__aivoCheckoutStripeInit) return;
  window.__aivoCheckoutStripeInit = true;

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

 let payBtn = qs("[data-checkout-pay]");
   if (payBtn) {
  // Daha önce bağlanmış tüm click handler'ları temizle (mock dahil)
  const fresh = payBtn.cloneNode(true);
  payBtn.parentNode.replaceChild(fresh, payBtn);
  payBtn = fresh;
}


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

  // Basit plan map: UI’da "Pro" / "Standart Paket" yazsa bile "pro" gönderiyoruz.
  // Sonra istersen bunu genişletiriz (starter/pro/studio gibi).
  function resolvePlan() {
    let plan =
      (planEl && planEl.textContent) ||
      getParam("plan");

    plan = String(plan || "").trim().toLowerCase();

    // UI metinleri farklıysa normalize et
    if (plan.includes("pro")) return "pro";
    if (plan.includes("standart")) return "pro"; // şimdilik pro'ya bağla
    if (!plan) return "pro";

    return plan; // fallback
  }

  payBtn.addEventListener("click", function () {
    if (payBtn.dataset.locked === "1") return;
    payBtn.dataset.locked = "1";

    // UI’dan plan/price okunuyor (price sadece görüntü; backend fiyatı priceId ile bilir)
    const plan = resolvePlan();

    let price =
      (priceEl && priceEl.textContent) ||
      getParam("price");

    price = String(price || "").trim();

    // Plan hiç yoksa bile pro'ya gideriz (çünkü backend PRICE_MAP şimdilik sadece pro)
    if (!plan) {
      alert("Plan alınamadı.");
      payBtn.dataset.locked = "0";
      return;
    }

    setPayState(true);

    // 👉 GERÇEK STRIPE CHECKOUT
    // startStripeCheckout fonksiyonu daha önce (mock bloğunun üstüne) eklenmiş olmalı.
    Promise.resolve()
      .then(function () {
        return startStripeCheckout("pro"); // şimdilik tek plan
      })
      .catch(function (err) {
        console.error("[CheckoutStripe] startStripeCheckout failed:", err);
        alert("Checkout başlatılamadı. Console'u kontrol et.");
        payBtn.dataset.locked = "0";
        setPayState(false);
      });
  });
})();



/* =========================================================
   TOPBAR CREDITS – LIVE BIND (localStorage aivo_credits) — REVISED
   - Tek instance (guard)
   - data-credits-pill öncelikli, yoksa fallback node
   - switchPage wrap güvenli
   ========================================================= */
(function initCreditsPill() {
  if (window.__aivoCreditsBind) return;
  window.__aivoCreditsBind = true;

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Kredi pill'ini esnek yakala:
  // 1) data-credits-pill (çoklu olabilir)
  // 2) id/class fallback (tekil)
  function findCreditsNodes() {
    var nodes = qsa("[data-credits-pill]");
    if (nodes.length) return nodes;

    var single =
      qs("#creditsCount") ||
      qs("#creditsPill") ||
      qs(".topbar-credits") ||
      null;

    return single ? [single] : [];
  }

  function readCredits() {
    try {
      return parseInt(localStorage.getItem("aivo_credits") || "0", 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function render() {
    var nodes = findCreditsNodes();
    if (!nodes.length) return;

    var credits = readCredits();

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var text = (el.textContent || "").trim();

      // İçerik “Kredi 12” gibi ise sayı kısmını değiştir
      if (/Kredi/i.test(text)) {
        el.textContent = text.replace(/Kredi\s*\d+/i, "Kredi " + credits);
      } else {
        el.textContent = "Kredi " + credits;
      }
    }
  }

  // İlk render
  render();

  // switchPage varsa, her sayfa geçişinde tekrar render
  if (typeof window.switchPage === "function" && !window.__aivoCreditsSwitchWrapped) {
    window.__aivoCreditsSwitchWrapped = true;
    var _sp = window.switchPage;

    window.switchPage = function (p) {
      _sp(p);
      setTimeout(render, 0);
    };
  }

  // Storage değişince (diğer tab / pencere)
  window.addEventListener("storage", function (e) {
    if (e && e.key === "aivo_credits") render();
  });

  // Demo için hafif polling (istersen sonra kaldırırız)
  setInterval(render, 1500);
})();




/* =========================================================
   GLOBAL PLAYER – INITIAL VISIBILITY (SAFE)
   ========================================================= */
(function () {
  try {
    if (
      typeof shouldPlayerBeAllowed === "function" &&
      typeof gpShow === "function" &&
      typeof gpHide === "function"
    ) {
      if (shouldPlayerBeAllowed()) gpShow();
      else gpHide();
    }
  } catch (e) {
    // sessiz geç: player görünürlüğü hatası sayfayı kırmasın
  }
})();

/* =========================================================
   SPEND (KREDİ HARCATMA) — delegated click (SAFE) — REVISED
   - Tek handler, tek kez bağlanır
   - Kredi yeterliyse düşer + UI günceller
   - Kredi yetmezse engeller + pricing açmayı dener
   ========================================================= */
(function bindSpendOnce() {
  if (window.__aivoSpendBound) return;
  window.__aivoSpendBound = true;

  function toInt(v) {
    var n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
  }

  function readCreditsSafe() {
    try {
      if (typeof window.readCredits === "function") return toInt(window.readCredits());
      return toInt(localStorage.getItem("aivo_credits") || "0");
    } catch (e) { return 0; }
  }

  function writeCreditsSafe(val) {
    try {
      var n = Math.max(0, toInt(val));
      if (typeof window.writeCredits === "function") { window.writeCredits(n); return; }
      localStorage.setItem("aivo_credits", String(n));
    } catch (e) {}
  }

  function callCreditsUIRefresh() {
    try {
      // Senin credits pill modülün zaten interval ile render ediyor,
      // ama anında güncellemek için varsa bu fonksiyonları çağır.
      if (typeof window.renderCredits === "function") window.renderCredits();
      if (typeof window.updateCreditsPill === "function") window.updateCreditsPill();
    } catch (e) {}
  }

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

    var bg = (type === "error")
      ? "rgba(90, 20, 30, .85)"
      : (type === "ok")
        ? "rgba(20, 70, 40, .85)"
        : "rgba(15, 20, 40, .85)";

    el.style.background = bg;
    el.style.border = "1px solid rgba(255,255,255,.10)";
    el.style.color = "rgba(255,255,255,.92)";
    el.textContent = msg;

    el.style.opacity = "1";
    clearTimeout(el.__t);
    el.__t = setTimeout(function () { el.style.opacity = "0"; }, 2200);
  }

  function openPricingIfPossible() {
    var btn = document.querySelector("[data-open-pricing]");
    if (btn) { btn.click(); return true; }

    var cb = document.getElementById("creditsButton");
    if (cb) { cb.click(); return true; }

    if (typeof window.openPricingModal === "function") { window.openPricingModal(); return true; }

    return false;
  }

  function getEffectiveCost(action, baseCost) {
    var cost = Math.max(0, toInt(baseCost));

    if (action === "music") {
      var audioToggle = document.getElementById("audioEnabled");
      if (audioToggle && audioToggle.checked === false) {
        cost = Math.max(0, Math.ceil(cost * 0.67));
      }
    }
    return cost;
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var btn = (t && t.closest) ? t.closest("[data-generate][data-credit-cost]") : null;

    if (!btn) return;

    // form submit vb. engelle
    e.preventDefault();

    var action = (btn.getAttribute("data-generate") || "").trim();
    var baseCost = btn.getAttribute("data-credit-cost");
    var cost = getEffectiveCost(action, baseCost);

    var credits = readCreditsSafe();

    if (credits < cost) {
      showToast("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
      openPricingIfPossible();
      return;
    }

    writeCreditsSafe(credits - cost);
    callCreditsUIRefresh();

    showToast("İşlem başlatıldı. " + cost + " kredi harcandı.", "ok");
  }, false);
})();





/* =========================================================
   INVOICES (localStorage) — STORE + RENDER + GLOBAL API — REVISED
   ========================================================= */
(function () {
  var LS_KEY = "aivo_invoices";

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  function loadInvoices() {
    var raw = localStorage.getItem(LS_KEY);
    var list = safeJsonParse(raw, []);
    return Array.isArray(list) ? list : [];
  }

  function saveInvoices(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list || []));
  }

  function formatTRY(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return String(amount || "");
    try {
      return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
    } catch (_) {
      return (Math.round(n * 100) / 100).toFixed(2) + " TL";
    }
  }

  function getInvoicesNodes() {
    return {
      empty: document.querySelector("[data-invoices-empty]"),
      cards: document.querySelector("[data-invoices-cards]")
    };
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toTime(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;

    var n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;

    var d = new Date(v);
    var t = d.getTime();
    return isNaN(t) ? 0 : t;
  }

  function invoiceCardHtml(inv) {
    var created = inv.createdAt ? new Date(inv.createdAt) : null;
    var createdText = created && !isNaN(created.getTime())
      ? created.toLocaleString("tr-TR")
      : (inv.createdAt ? String(inv.createdAt) : "");

    var plan = escapeHtml(inv.plan || "Satın Alma");
    var provider = escapeHtml(inv.provider || "Demo");
    var status = escapeHtml(inv.status || "paid");
    var priceText = (inv.price != null) ? escapeHtml(formatTRY(inv.price)) : "";
    var creditsText = (inv.creditsAdded != null) ? escapeHtml(String(inv.creditsAdded)) : "";

    return (
      '<article class="invoice-card">' +
        '<div class="invoice-top">' +
          '<div class="invoice-title">' + plan + "</div>" +
          '<div class="invoice-status">' + status + "</div>" +
        "</div>" +
        '<div class="invoice-meta">' +
          (createdText ? '<div class="invoice-row"><span>Tarih</span><b>' + escapeHtml(createdText) + "</b></div>" : "") +
          (priceText ? '<div class="invoice-row"><span>Tutar</span><b>' + priceText + "</b></div>" : "") +
          (creditsText ? '<div class="invoice-row"><span>Kredi</span><b>+' + creditsText + "</b></div>" : "") +
          '<div class="invoice-row"><span>Sağlayıcı</span><b>' + provider + "</b></div>" +
          (inv.id ? '<div class="invoice-row"><span>ID</span><b>' + escapeHtml(inv.id) + "</b></div>" : "") +
        "</div>" +
      "</article>"
    );
  }

  function renderInvoices(list) {
    var nodes = getInvoicesNodes();
    if (!nodes.cards || !nodes.empty) return;

    var arr = Array.isArray(list) ? list : [];

    if (arr.length === 0) {
      nodes.empty.style.display = "";
      nodes.cards.innerHTML = "";
      return;
    }

    nodes.empty.style.display = "none";

    var sorted = arr.slice().sort(function (a, b) {
      return toTime(b.createdAt) - toTime(a.createdAt);
    });

    nodes.cards.innerHTML = sorted.map(invoiceCardHtml).join("");
  }

  function addInvoice(payload) {
    var list = loadInvoices();
    var inv = (payload && typeof payload === "object") ? payload : {};

    if (!inv.id) inv.id = "inv_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    if (!inv.createdAt) inv.createdAt = Date.now();
    if (!inv.status) inv.status = "paid";
    if (!inv.provider) inv.provider = "Demo";

    list.push(inv);
    saveInvoices(list);

    // invoices DOM varsa anında bas
    renderInvoices(list);

    return inv;
  }

  function renderInvoicesFromStore() {
    renderInvoices(loadInvoices());
  }

  // GLOBALS (DevTools + checkout dönüşü için)
  window.renderInvoices = renderInvoices;
  window.addInvoice = addInvoice;
  window.__loadInvoices = loadInvoices;
  window.__saveInvoices = saveInvoices;

  function hookSwitchPage() {
    if (typeof window.switchPage !== "function") return;
    if (window.__aivoInvoicesSwitchHooked) return;
    window.__aivoInvoicesSwitchHooked = true;

    var original = window.switchPage;
    window.switchPage = function (pageName) {
      var r = original.apply(this, arguments);
      if (String(pageName || "") === "invoices") {
        setTimeout(renderInvoicesFromStore, 0);
      }
      return r;
    };
  }

  function routeFromQuery() {
    try {
      var sp = new URLSearchParams(window.location.search || "");
      var page = sp.get("page");
      if (page && typeof window.switchPage === "function") {
        window.switchPage(page);
      }
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    // switchPage'i mümkün olan en erken anda hook'la
    hookSwitchPage();

    // query router
    routeFromQuery();

    // İlk yükleme render
    renderInvoicesFromStore();

    // Router DOM'u yerleştirdiyse tekrar dene
    setTimeout(renderInvoicesFromStore, 0);
  });
})();

/* =========================================================
   CHECKOUT — DEMO SUCCESS: credits + invoice + redirect (NO NEW DOMContentLoaded)
   ========================================================= */
(function () {
  if (window.__aivoCheckoutDemoSuccessBound) return;
  window.__aivoCheckoutDemoSuccessBound = true;

  var CREDITS_KEY = "aivo_credits";
  var INVOICES_KEY = "aivo_invoices";

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  function toNumber(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function readCredits() {
    return toNumber(localStorage.getItem(CREDITS_KEY) || "0");
  }

  function writeCredits(n) {
    var x = Math.max(0, toNumber(n));
    localStorage.setItem(CREDITS_KEY, String(x));
  }

  function addCredits(delta) {
    var cur = readCredits();
    var next = cur + toNumber(delta);
    writeCredits(next);
    return next;
  }

  function loadInvoices() {
    var raw = localStorage.getItem(INVOICES_KEY);
    var list = safeJsonParse(raw, []);
    return Array.isArray(list) ? list : [];
  }

  function saveInvoices(list) {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(list || []));
  }

  function pushInvoice(inv) {
    var list = loadInvoices();
    list.push(inv);
    saveInvoices(list);
    return inv;
  }

  function getCheckoutValues() {
    var planEl = document.querySelector("#checkoutPlan");
    var priceEl = document.querySelector("#checkoutPrice");

    var plan = (planEl && planEl.textContent ? planEl.textContent : "").trim() || "Kredi Satın Alma";
    var priceText = (priceEl && priceEl.textContent ? priceEl.textContent : "").trim();

    var num = (priceText || "").replace(/[^\d,\.]/g, "").replace(",", ".");
    var price = Number(num);
    if (!isFinite(price)) price = null;

    return { plan: plan, priceText: priceText, price: price };
  }

  function inferCreditsAdded(plan) {
    var m = String(plan || "").match(/(\d+)\s*kredi/i);
    if (m) return toNumber(m[1]) || 0;
    return 100;
  }

  function onDemoSuccess() {
    var v = getCheckoutValues();
    var creditsAdded = inferCreditsAdded(v.plan);

    addCredits(creditsAdded);

    pushInvoice({
      id: "inv_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
      createdAt: Date.now(),
      plan: v.plan,
      price: v.price,          // number or null
      creditsAdded: creditsAdded,
      provider: "Demo",
      status: "paid"
    });

    window.location.href = "/studio.html?page=invoices&v=" + Date.now();
  }

  function closestSafe(t, sel) {
    if (!t || !sel) return null;
    if (t.closest) return t.closest(sel);
    // mini fallback
    var node = t;
    while (node && node !== document) {
      if (node.getAttribute && node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }

  document.addEventListener("click", function (e) {
    var t = e.target;

    var btn = closestSafe(t, "[data-checkout-success]");
    if (btn) {
      e.preventDefault();
      onDemoSuccess();
      return;
    }

    var pay = closestSafe(t, "[data-checkout-pay]");
    if (pay && pay.hasAttribute("data-demo-success")) {
      e.preventDefault();
      onDemoSuccess();
      return;
    }
  }, false);
})();
/* =========================================================
   STRIPE RETURN (paid=1) — VERIFY via backend, then credits+invoice (ONE TIME)
   Güvenlik: Kredi sadece verify-session "paid+complete" dönerse eklenir.
   ========================================================= */
(function () {
  if (window.__aivoStripePaidReturnBound) return;
  window.__aivoStripePaidReturnBound = true;

  try {
    var url = new URL(window.location.href);

    var paid = url.searchParams.get("paid");
    var sessionId = url.searchParams.get("session_id");

    // Bu blok sadece Stripe dönüşünde çalışsın
    if (paid !== "1" || !sessionId) return;

    // Aynı session için bir daha kredi eklenmesin (kalıcı kilit)
    var idempotencyKey = "aivo_paid_session_" + sessionId;
    if (localStorage.getItem(idempotencyKey) === "1") {
      // URL temizle ve çık
      url.searchParams.delete("paid");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      return;
    }

    // UI: varsa işlem mesajı göster (opsiyonel)
    var paidBox = document.getElementById("paidBox");
    var paidText = document.getElementById("paidText");
    if (paidBox && paidText) {
      paidBox.style.display = "block";
      paidText.textContent = "Ödeme doğrulanıyor…";
    }

    // Backend doğrulama
    fetch("/api/stripe/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.ok !== true) {
          throw new Error((data && data.error) ? data.error : "verify-session failed");
        }

        var isPaid = data.paid === true;
        var isComplete = data.complete === true;

        if (!isPaid || !isComplete) {
          // Ödeme tamamlanmamışsa kredi ekleme
          if (paidBox && paidText) {
            paidBox.style.display = "block";
            paidText.textContent = "Ödeme tamamlanmadı. Kredi eklenmedi.";
          }
          return;
        }

        // Krediyi backend’den gelen metadata’dan al
        var creditsAdded = Number(data.credits || 0) || 0;
        if (creditsAdded <= 0) {
          // Güvenli fallback: kredi yoksa ekleme
          if (paidBox && paidText) {
            paidBox.style.display = "block";
            paidText.textContent = "Ödeme doğrulandı ama kredi paketi bulunamadı.";
          }
          return;
        }

        // ---- KREDİ EKLE ----
        var curCredits = Number(localStorage.getItem("aivo_credits") || 0);
        localStorage.setItem("aivo_credits", String(curCredits + creditsAdded));

        // ---- FATURA EKLE ----
        var invoicesKey = "aivo_invoices";
        var invoices = [];
        try {
          invoices = JSON.parse(localStorage.getItem(invoicesKey) || "[]");
          if (!Array.isArray(invoices)) invoices = [];
        } catch (e) {
          invoices = [];
        }

        invoices.unshift({
          id: "inv_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
          createdAt: Date.now(),
          plan: (data.plan ? String(data.plan) : "AIVO (Stripe)"),
          price: (typeof data.amount_total === "number" ? data.amount_total : 0), // kuruş olabilir
          currency: data.currency || "try",
          creditsAdded: creditsAdded,
          provider: "stripe",
          status: "paid",
          session_id: sessionId,
          customer_email: data.customer_email || null
        });

        localStorage.setItem(invoicesKey, JSON.stringify(invoices));

        // ---- TEK SEFER KİLİT ----
        localStorage.setItem(idempotencyKey, "1");

        // ---- UI ----
        if (paidBox && paidText) {
          paidBox.style.display = "block";
          paidText.textContent = creditsAdded + " kredi eklendi. Fatura kaydın oluşturuldu.";
        }
      })
      .catch(function (err) {
        console.error("[StripeReturnPaid] verify failed:", err);
        if (paidBox && paidText) {
          paidBox.style.display = "block";
          paidText.textContent = "Ödeme doğrulanamadı. Lütfen destek ile iletişime geç.";
        }
      })
      .finally(function () {
        // URL temizle (her durumda)
        try {
          url.searchParams.delete("paid");
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        } catch (e) {}
      });
  } catch (err) {
    console.error("[StripeReturnPaid] Block failed:", err);
  }
})();

/* =========================================================
   PAYTR (TR) — FRONTEND SKELETON (DISABLED BY DEFAULT)
   - Şimdilik sadece altyapı: init çağrısı + iframe modal iskeleti
   - Secret/key yokken çalıştırmıyoruz (flag kapalı)
   - PAYTR_ENABLED=false iken Stripe (mevcut sistem) bozulmaz
   ========================================================= */
(function initPayTRFrontendSkeleton() {
  if (window.__aivoPayTRFrontSkeleton) return;
  window.__aivoPayTRFrontSkeleton = true;

  // =========================================================
  // PAYTR ENABLE FLAG (query + localStorage)
  // =========================================================
  var PAYTR_ENABLED = false;

  (function resolvePayTREnabledFlag() {
    try {
      var url = new URL(window.location.href);

      // Query override (?paytr=1 | ?paytr=0)
      if (url.searchParams.has("paytr")) {
        var q = url.searchParams.get("paytr");
        if (q === "1") localStorage.setItem("AIVO_PAYTR_ENABLED", "1");
        if (q === "0") localStorage.setItem("AIVO_PAYTR_ENABLED", "0");

        url.searchParams.delete("paytr");
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "")
        );
      }

      PAYTR_ENABLED = localStorage.getItem("AIVO_PAYTR_ENABLED") === "1";
      console.log("[PayTR][FLAG]", PAYTR_ENABLED ? "ENABLED" : "DISABLED");
    } catch (e) {
      console.error("[PayTR][FLAG] resolve error", e);
      PAYTR_ENABLED = false;
    }
  })();

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function ensurePayTRModal() {
    var wrap = qs("#paytrModal");
    if (wrap) return wrap;


    wrap = document.createElement("div");
    wrap.id = "paytrModal";
    wrap.style.cssText = [
      "position:fixed",
      "inset:0",
      "background:rgba(0,0,0,.65)",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "z-index:999999",
      "padding:24px"
    ].join(";");

    var box = document.createElement("div");
    box.style.cssText = [
      "width:min(980px,100%)",
      "height:min(760px,92vh)",
      "background:#0b1020",
      "border-radius:16px",
      "overflow:hidden",
      "position:relative",
      "box-shadow:0 20px 90px rgba(0,0,0,.55)"
    ].join(";");

    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.style.cssText = [
      "position:absolute",
      "top:10px",
      "right:12px",
      "z-index:2",
      "width:40px",
      "height:40px",
      "border-radius:999px",
      "border:0",
      "background:rgba(255,255,255,.10)",
      "color:#fff",
      "font-size:26px",
      "cursor:pointer"
    ].join(";");
    close.onclick = function () {
      wrap.style.display = "none";
      var fr = box.querySelector("iframe");
      if (fr) fr.src = "about:blank";
    };

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "PayTR Ödeme");
    iframe.style.cssText = [
      "width:100%",
      "height:100%",
      "border:0",
      "display:block"
    ].join(";");

    box.appendChild(close);
    box.appendChild(iframe);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    return wrap;
  }

  async function paytrInit(planCode) {
    // Not: API hazır; secret yokken bu çağrıyı yapmayacağız (flag kapalı)
    var r = await fetch("/api/paytr/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: planCode || "pro" // şimdilik varsayılan
      })
    });

    var data = await r.json().catch(function(){ return null; });

    if (!r.ok || !data || !data.ok) {
      throw new Error((data && data.error) ? data.error : ("PAYTR_INIT_FAIL HTTP " + r.status));
    }
    return data; // beklenen: { ok:true, iframeUrl|url|frameUrl, oid, ... }
  }

  async function openPayTR(planCode) {
    var modal = ensurePayTRModal();
    var iframe = modal.querySelector("iframe");

    modal.style.display = "flex";
    if (iframe) iframe.src = "about:blank";

    var init = await paytrInit(planCode);

    // Backend hangi alanı dönüyorsa ona göre:
    var url = init.iframeUrl || init.url || init.frameUrl || "";
    if (!url) throw new Error("PAYTR_IFRAME_URL_MISSING");

    if (iframe) iframe.src = url;
  }

  // Checkout butonunu yakala (senin projede bazen #payBtn veya [data-checkout-pay] var)
  function bindCheckoutButton() {
    var btn = qs("[data-checkout-pay]") || qs("#payBtn");
    if (!btn) return;

    // Aynı butona tekrar tekrar bağlanmayı engelle
    if (btn.getAttribute("data-paytr-bound") === "1") return;
    btn.setAttribute("data-paytr-bound", "1");

    btn.addEventListener("click", function (e) {
      // PAYTR KAPALIYSA: hiçbir şeyi engelleme → Stripe/mevcut akış çalışsın
      if (!PAYTR_ENABLED) {
        console.log("[PayTR] Frontend skeleton hazır ama kapalı (PAYTR_ENABLED=false).");
        return;
      }

      // PAYTR AÇIKSA: Stripe'ı blokla ve PayTR'yi aç
      e.preventDefault();
      e.stopPropagation();

      var planCode = btn.getAttribute("data-plan") || "pro";

      openPayTR(planCode).catch(function (err) {
        console.error("[PayTR] open failed:", err);
        alert("PayTR başlatılamadı. Console’u kontrol et.");
      });
    }, { passive: false });
  }

  // DOM hazır olunca bağla
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCheckoutButton);
  } else {
    bindCheckoutButton();
  }
})();

/* =========================================================
   PAYTR RETURN → VERIFY → AIVO_STORE_V1 credits + invoice
   - Altyapı modu: KV/order yoksa sessizce çıkar
   - paytr=ok|fail ve oid parametrelerini yakalar
   ========================================================= */

(function paytrReturnVerifyAndApply() {
  if (window.__aivoPayTRReturnVerifyBound) return;
  window.__aivoPayTRReturnVerifyBound = true;

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function readStore() {
    try { return JSON.parse(localStorage.getItem("aivo_store_v1") || "{}"); }
    catch (_) { return {}; }
  }

  function writeStore(next) {
    localStorage.setItem("aivo_store_v1", JSON.stringify(next || {}));
  }

  function addCredits(store, n) {
    store.credits = Number(store.credits || 0) + Number(n || 0);
  }

  function addInvoice(store, inv) {
    var invoices = Array.isArray(store.invoices) ? store.invoices : [];
    invoices.unshift(inv);
    store.invoices = invoices;
  }

  async function verify(oid) {
    var r = await fetch("/api/paytr/verify?oid=" + encodeURIComponent(oid));
    var data = await r.json().catch(function(){ return null; });
    if (!data || !data.ok) return { ok: false, error: data?.error || "VERIFY_FAIL" };
    return data;
  }

  function cleanParams(url) {
    url.searchParams.delete("paytr");
    url.searchParams.delete("oid");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  }

  (async function run() {
    try {
      var url = new URL(window.location.href);
      var paytr = url.searchParams.get("paytr"); // ok | fail
      var oid = url.searchParams.get("oid");

      if (!paytr || !oid) return;

      // fail: sadece temizle
      if (paytr === "fail") {
        cleanParams(url);
        return;
      }

      // ok: verify
      var data = await verify(oid);

      // KV/order yoksa sessiz geç (altyapı modu)
      if (!data.ok) {
        cleanParams(url);
        return;
      }

      // Success değilse sessiz geç
      if (String(data.status) !== "success") {
        cleanParams(url);
        return;
      }

      var store = readStore();

      // aynı sipariş iki kez yazılmasın
      store.paytrApplied = store.paytrApplied || {};
      if (store.paytrApplied[oid]) {
        cleanParams(url);
        return;
      }
      store.paytrApplied[oid] = Date.now();

      // kredi + fatura
      addCredits(store, data.credits || 0);

      addInvoice(store, {
        id: "paytr_" + oid,
        provider: "paytr",
        oid: oid,
        plan: data.plan || null,
        credits: Number(data.credits || 0),
        amountTRY: data.amountTRY || null,
        total_amount: data.total_amount || null,
        status: "paid",
        createdAt: Date.now()
      });

      writeStore(store);

      // kredi UI varsa güncelle
      try {
        var c = Number(store.credits || 0);
        var el1 = qs("#creditsCount");
        if (el1) el1.textContent = String(c);
        var el2 = qs("[data-credits]");
        if (el2) el2.textContent = String(c);
      } catch (_) {}

      // opsiyonel bilgilendirme kutusu varsa göster
      var paidBox = qs("#paidBox");
      var paidText = qs("#paidText");
      if (paidBox && paidText) {
        paidBox.style.display = "block";
        paidText.textContent = "Ödeme doğrulandı. Kredi ve fatura işlendi.";
      }

      // URL temizle
      cleanParams(url);
    } catch (_) {
      // sessiz geç
    }
  })();
})();
/* =========================================================
   PAYTR RETURN (ALTYAPI) — ok/fail → verify (sadece kontrol)
   - Bu aşamada kredi/fatura yazmıyoruz
   - Sadece /api/paytr/verify?oid=... çağırıp sonucu logluyoruz
   ========================================================= */
(function paytrReturnVerifySkeleton() {
  if (window.__aivoPayTRReturnVerifyBound) return;
  window.__aivoPayTRReturnVerifyBound = true;

  try {
    var url = new URL(window.location.href);
    var paytr = url.searchParams.get("paytr"); // ok | fail
    var oid = url.searchParams.get("oid");

    // Bu sayfada PayTR dönüşü yoksa çık
    if (!paytr || !oid) return;

    // Aynı sayfada iki kez çalışmasın
    var key = "aivo_paytr_return_handled_" + paytr + "_" + oid;
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");

   // UI'yı bozma; sadece altyapı kontrolü
fetch("/api/paytr/verify?oid=" + encodeURIComponent(oid), { method: "GET" })
  .then(function (r) {
    return r.json().catch(function () { return null; });
  })
  .then(function (data) {
    if (!data || !data.ok) {
      console.warn("[PayTR][VERIFY][DEV]", {
        status: "FAIL",
        paytr: paytr,
        oid: oid,
        data: data || null
      });
      return;
    }

    // =====================================================
    // DEV HOOK (UI YOK)
    // Buraya ileride kredi + fatura + toast bağlanacak
    // =====================================================
    console.log("[PayTR][VERIFY][DEV]", {
      status: "OK",
      oid: oid,
      plan: data.plan || null,
      credits: data.credits || 0,
      amountTRY: data.amountTRY || null,
      total: data.total_amount || null
    });

    // ŞİMDİLİK:
    // - kredi ekleme yok
    // - fatura yok
    // - toast yok
    // - yönlendirme yok
  })
  .catch(function (err) {
    console.error("[PayTR][VERIFY][DEV] ERROR", err);
  });

// URL'yi temizle (görsel olarak daha düzgün)
url.searchParams.delete("paytr");
url.searchParams.delete("oid");
window.history.replaceState(
  {},
  "",
  url.pathname + (url.searchParams.toString() ? ("?" + url.searchParams.toString()) : "")
);

} catch (e) {
  console.error("[PayTR][RETURN] handler error", e);
}
})();

/* =========================================================
   PAYTR RETURN → VERIFY → STORE HOOK (DEV MODE)
   - UI yok (toast/alert/yönlendirme yok)
   - Sadece dev log + ileride doldurulacak hook
   - Aynı oid iki kez işlenmez (idempotent guard)
   ========================================================= */
(function paytrReturnVerifyHook() {
  if (window.__aivoPayTRVerifyHookBound) return;
  window.__aivoPayTRVerifyHookBound = true;

  try {
    var url = new URL(window.location.href);
    var paytr = url.searchParams.get("paytr"); // ok | fail
    var oid = url.searchParams.get("oid");

    if (!paytr || !oid) return;

    // -----------------------------------------------------
    // Idempotent guard (aynı oid tekrar çalışmasın)
    // -----------------------------------------------------
    var handledKey = "AIVO_PAYTR_VERIFY_HANDLED_" + oid;
    if (sessionStorage.getItem(handledKey) === "1") {
      console.warn("[PayTR][RETURN] already handled", oid);
      return;
    }
    sessionStorage.setItem(handledKey, "1");

    // -----------------------------------------------------
    // Verify çağrısı (UI bozma, sessiz)
    // -----------------------------------------------------
    fetch("/api/paytr/verify?oid=" + encodeURIComponent(oid), {
      method: "GET"
    })
      .then(function (r) {
        return r.json().catch(function () {
          return null;
        });
      })
      .then(function (data) {
        if (!data || !data.ok) {
          console.warn("[PayTR][VERIFY][DEV] FAIL", {
            paytr: paytr,
            oid: oid,
            data: data || null
          });
          return;
        }

        // =================================================
        // DEV HOOK (UI YOK)
        // Buraya ileride:
        // - kredi ekleme
        // - fatura oluşturma
        // - toast
        // - yönlendirme
        // bağlanacak
        // =================================================
        console.log("[PayTR][VERIFY][DEV] OK", {
          oid: oid,
          status: data.status || "unknown",
          plan: data.plan || null,
          credits: data.credits || 0,
          amountTRY: data.amountTRY || null,
          total: data.total_amount || null
        });

        // ŞİMDİLİK:
        // - kredi ekleme yok
        // - fatura yok
        // - toast yok
        // - yönlendirme yok
      })
      .catch(function (err) {
        console.error("[PayTR][VERIFY][DEV] ERROR", err);
      });

    // -----------------------------------------------------
    // URL temizle (görsel olarak düzgün kalsın)
    // -----------------------------------------------------
    url.searchParams.delete("paytr");
    url.searchParams.delete("oid");
    window.history.replaceState(
      {},
      "",
      url.pathname +
        (url.searchParams.toString()
          ? "?" + url.searchParams.toString()
          : "")
    );
  } catch (e) {
    console.error("[PayTR][RETURN] handler error", e);
  }
})();
document.addEventListener("DOMContentLoaded", function () {

  // HERO TYPE SWAP
  const el = document.querySelector(".aivo-title .type");
  if (el) {
    const words = el.dataset.words.split(",");
    let i = 0;

    setInterval(() => {
      i = (i + 1) % words.length;
      el.style.opacity = 0;

      setTimeout(() => {
        el.textContent = words[i];
        el.style.opacity = 1;
      }, 200);

    }, 2600);
  }

});
// TOPBAR dropdowns (Studio) — SAFE FINAL (Products + Corp)
   console.log("[Studio] dropdown bind loaded");

(function () {
  const bind = (id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const btn = el.querySelector(".nav-link, button.nav-link, a.nav-link");
    if (!btn) return;

    // Dropdown panel: içe tıklayınca dış click kapatmasın
    const panel = el.querySelector(".dropdown");
    if (panel) panel.addEventListener("click", (e) => e.stopPropagation());

    btn.addEventListener("click", (e) => {
      // Eğer btn bir <a> ise ve "gerçek link" ise ENGELLEME.
      // Sadece href="#" (veya boş) ise dropdown toggle gibi davran.
      const isLink = btn.tagName === "A";
      const href = isLink ? (btn.getAttribute("href") || "").trim() : "";

      const isDummyHref =
        !href || href === "#" || href.toLowerCase().startsWith("javascript:");

      if (isDummyHref) {
        e.preventDefault(); // sadece sahte linklerde
      }

      e.stopPropagation();

      // diğer dropdownları kapat
      document.querySelectorAll(".nav-item.has-dropdown.is-open").forEach((x) => {
        if (x !== el) x.classList.remove("is-open");
      });

      el.classList.toggle("is-open");

      btn.setAttribute(
        "aria-expanded",
        el.classList.contains("is-open") ? "true" : "false"
      );
    });
  };

  bind("navProducts");
  bind("navCorp");

  // Dışarı tıklanınca kapat
  document.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item.has-dropdown.is-open")
      .forEach((x) => x.classList.remove("is-open"));
  });
})();
/* =========================================================
   STUDIO TOPBAR — AUTH UI (ONLY LOGOUT)
   - Studio'da Guest (Giriş/Kayıt) ASLA görünmez
   - Sadece "Çıkış Yap" görünür ve çalışır
   ========================================================= */
(() => {
  if (window.__AIVO_STUDIO_ONLY_LOGOUT__) return;
  window.__AIVO_STUDIO_ONLY_LOGOUT__ = true;

  const AUTH_KEYS_TO_CLEAR = [
    "aivo_auth",
    "aivo_credits",
    "aivo_invoices",
    "aivoInvoices",
    "aivo_store_v1",
    "aivo_store_v1_migrated"
  ];

  function forceOnlyLogout(){
    const guest = document.getElementById("authGuest");
    const user  = document.getElementById("authUser");

    // Guest bölümünü kesin kapat
    if (guest) guest.style.display = "none";

    // User bölümünü kesin aç (Çıkış Yap)
    if (user) user.style.display = "";
  }

  function bindLogout(){
    const btn = document.getElementById("btnLogoutTop");
    if (!btn) return;

    // capture: başka script engelleyemesin
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      AUTH_KEYS_TO_CLEAR.forEach(k => localStorage.removeItem(k));

      // hard redirect
      window.location.assign("/");
    }, true);
  }

  function boot(){
    bindLogout();
    forceOnlyLogout();

    // Sayfa yüklenirken başka JS/CSS geri açarsa tekrar kapat
    setTimeout(forceOnlyLogout, 50);
    setTimeout(forceOnlyLogout, 200);
    setTimeout(forceOnlyLogout, 600);
    setTimeout(forceOnlyLogout, 1200);
  }

  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("focus", forceOnlyLogout);
})();


/* =========================================================
   STUDIO LOGOUT -> VITRIN (SINGLE SOURCE OF TRUTH)
   - Tek handler (çakışma yok)
   - Capture ile en erken yakalar
   - Önce localStorage temizler (garanti)
   - Sonra vitrine logout=1 ile gider
   ========================================================= */
(() => {
  if (window.__AIVO_STUDIO_LOGOUT__) return;
  window.__AIVO_STUDIO_LOGOUT__ = true;

  function clearAuthEverywhere() {
    // 1) Net anahtarlar
    const keys = [
      "aivo_logged_in",
      "aivo_user_email",
      "aivo_auth",
      "aivo_token",
      "aivo_user",
      "aivo_credits",
      "aivo_store_v1",
      "aivo_store_v1_migrated",
      "token",
      "access_token",
    ];
    keys.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });

    // 2) AIVO_ ile başlayanların hepsini de temizle (garanti)
    try {
      Object.keys(localStorage).forEach(k => {
        if (String(k).toLowerCase().startsWith("aivo_")) {
          try { localStorage.removeItem(k); } catch(_) {}
        }
      });
    } catch(_) {}

    // Handshake (vitrin görürse UI refresh + ekstra temizler)
    try { sessionStorage.setItem("__AIVO_FORCE_LOGOUT__", "1"); } catch(_) {}
  }

  function goVitrinLogout() {
    // / ve /index.html farkı kalmasın: tek hedef belirle
    // Not: Sen vitrine /index.html kullanıyorsun, parametre ekleyelim
    const url = "/index.html?logout=1";
    // Safari’de daha güvenli
    setTimeout(() => window.location.assign(url), 0);
  }

  function isLogoutTarget(node) {
    if (!node || !node.closest) return false;
    // Senin standartların: id=btnLogoutTop, .logout, data-action=logout
    return !!node.closest("#btnLogoutTop, .logout, [data-action='logout']");
  }

  function onLogoutEvent(e) {
    if (!isLogoutTarget(e.target)) return;

    // Link default navigasyonunu kesin kes
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    clearAuthEverywhere();
    goVitrinLogout();
  }

  // En erken yakalama (capture)
  document.addEventListener("pointerdown", onLogoutEvent, true);
  document.addEventListener("click", onLogoutEvent, true);

  console.log("[AIVO] Studio logout handler active");
})();

/* =========================================================
   STUDIO USER PANEL (OPEN/CLOSE)
   - btnUserMenuTop -> userMenuPanel toggle
   - Dışarı tıklayınca kapanır
   - ESC ile kapanır
   - Çift çalışmayı engeller
   ========================================================= */
(() => {
  if (window.__AIVO_STUDIO_USERPANEL__) return;
  window.__AIVO_STUDIO_USERPANEL__ = true;

  const btn   = document.getElementById("btnUserMenuTop");
  const panel = document.getElementById("userMenuPanel");

  if (!btn || !panel) return;

  // Başlangıç: kapalı
  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");
    panel.classList.remove("is-open");
  }

  function openPanel() {
    panel.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
    panel.classList.add("is-open");
  }

  function togglePanel() {
    const isOpen = panel.getAttribute("aria-hidden") === "false";
    isOpen ? closePanel() : openPanel();
  }

  closePanel();

  // Pill tıkla -> aç/kapa
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel();
  });

  // Panel içine tıklayınca kapanmasın
  panel.addEventListener("click", (e) => e.stopPropagation());

  // Dışarı tıklayınca kapat
  document.addEventListener("click", () => closePanel());

  // ESC ile kapat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });
})();
/* =========================================================
   AIVO — TOPBAR / DROPDOWN INTERNAL NAV BRIDGE
   - URL ?to=... ve ?tab=... paramlarını Studio'nun sidebar nav'ına bağlar
   - Topbar link tıklarında reload'u engeller, sidebar butonunu click'ler
   ========================================================= */
(function AIVO_NAV_BRIDGE(){
  if (window.__AIVO_NAV_BRIDGE__) return;
  window.__AIVO_NAV_BRIDGE__ = true;

  function qs(sel, root=document){ return root.querySelector(sel); }

  function closeUserMenuIfOpen(){
    const panel = qs("#userMenuPanel");
    const btn   = qs("#btnUserMenuTop");
    if (panel) panel.setAttribute("aria-hidden", "true");
    if (btn)   btn.setAttribute("aria-expanded", "false");
  }

  function closeProductsIfOpen(){
    const nav = qs("#navProducts");
    if (!nav) return;
    const btn = nav.querySelector(".nav-link");
    if (btn) btn.setAttribute("aria-expanded", "false");
    nav.classList.remove("open");
  }

  function clickSidebarPage(page){
    // Sidebar butonu: <button class="sidebar-link" data-page-link="dashboard">
    const btn = qs(`.sidebar [data-page-link="${CSS.escape(page)}"]`);
    if (btn) { btn.click(); return true; }
    return false;
  }

  function clickMusicTab(tab){
    // Music submenu butonu: <button data-music-tab="ai-video"> ... </button>
    const b = qs(`.sidebar [data-music-tab="${CSS.escape(tab)}"]`);
    if (b) { b.click(); return true; }
    return false;
  }

  function routeTo(page, tab){
    const ok = clickSidebarPage(page);
    if (!ok) return false;

    // Tab varsa (özellikle music içi)
    if (tab) {
      // Sidebar click handler DOM'u güncellemiş olabilir; kısa gecikme güvenli.
      setTimeout(() => { clickMusicTab(tab); }, 60);
    }

    closeUserMenuIfOpen();
    closeProductsIfOpen();
    return true;
  }

  // 1) Sayfa ilk açılışta parametre varsa çalıştır
  function routeFromUrl(){
    const u = new URL(location.href);
    const to  = (u.searchParams.get("to") || "").trim();
    const tab = (u.searchParams.get("tab") || "").trim();
    if (!to) return;

    // Video ayrı page değil; music iç tab gibi davran.
    if (to === "video") {
      routeTo("music", tab || "ai-video");
      return;
    }

    // Normal route
    routeTo(to, tab);

    // URL'yi temizlemek istersen (opsiyonel):
    // u.searchParams.delete("to");
    // u.searchParams.delete("tab");
    // history.replaceState({}, "", u.pathname + u.search + u.hash);
  }

  // DOM hazır olunca parametreyi işle
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", routeFromUrl, { once:true });
  } else {
    routeFromUrl();
  }

  // 2) Topbar / dropdown link tıklarında reload'u engelle ve route et
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="/studio.html"]');
    if (!a) return;

    // Sadece aynı sayfa içinde internal nav ise engelle
    try{
      const href = new URL(a.getAttribute("href"), location.origin);
      if (href.pathname !== location.pathname) return;

      const to  = (href.searchParams.get("to") || "").trim();
      const tab = (href.searchParams.get("tab") || "").trim();
      if (!to) return;

      e.preventDefault();

      if (to === "video") {
        routeTo("music", tab || "ai-video");
      } else {
        routeTo(to, tab);
      }
    } catch(_){}
  });

})();

// 👇 EN ALTA BUNU YAPIŞTIR (SON HALİ)
document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("musicGenerateBtn");
  if (!btn) return;

  btn.addEventListener("click", function (e) {
    e.preventDefault();      // ⛔ yönlendirmeyi durdur
    e.stopPropagation();     // ⛔ diğer click handler’ları durdur

    const cost = Number(btn.getAttribute("data-credit-cost")) || 0;

    if (!window.AIVO_STORE_V1 || !AIVO_STORE_V1.consumeCredits(cost)) {
      alert("Yetersiz kredi");
      return;
    }

    console.log("🎵 Müzik üretildi, düşülen kredi:", cost);

    // burada SADECE kredi düştü
    // üretim akışına dokunmuyoruz
  });
});

// ✅ OVERRIDE: Music Generate click -> consume credits (no redirect)
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("musicGenerateBtn");
  if (!btn) return;

  // Mevcut click'ler çalışsa bile önce biz yakalayalım ve durduralım
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    var cost = Number(btn.getAttribute("data-credit-cost")) || 0;

    // kredi yetmiyorsa (veya store yoksa) satın al sayfasına gidebilir
    if (!window.AIVO_STORE_V1 || !window.AIVO_STORE_V1.consumeCredits(cost)) {
      alert("Yetersiz kredi");
      return;
    }

    console.log("✅ kredi düştü:", cost, "kalan:", window.AIVO_STORE_V1.getCredits());
  }, true); // <- CAPTURE MODE: önce biz çalışırız
});



}); // ✅ SADECE 1 TANE KAPANIŞ — DOMContentLoaded
