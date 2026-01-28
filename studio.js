console.log("✅ studio.js loaded", location.href);
console.log("✅ stripe =", new URLSearchParams(location.search).get("stripe"));
console.log("✅ session_id =", new URLSearchParams(location.search).get("session_id"));

function applyCreditsNow(credits, meta = {}) {
  const n = Number(credits);
  if (!Number.isFinite(n)) return;

  // 1) Session mirror (varsa bir yer buradan okuyordur)
  window.__AIVO_SESSION__ = window.__AIVO_SESSION__ || {};
  window.__AIVO_SESSION__.credits = n;

  // 2) Store varsa: state güncelle + UI sync
  const S = window.AIVO_STORE_V1;
  try {
    if (S?.setCredits) S.setCredits(n);
    else if (S?.set?.credits) S.set.credits(n);
    else if (S?.state) S.state.credits = n;

    if (S?.syncCreditsUI) S.syncCreditsUI();
  } catch (e) {}

  // 3) DOM fallback (topbar)
  const el = document.querySelector("#topCreditCount");
  if (el) el.textContent = String(n);

  // 4) Event yayınla (ileride tek otoriteye geçiş için)
  window.dispatchEvent(
    new CustomEvent("aivo:credits-updated", { detail: { credits: n, ...meta } })
  );
}
/* =========================
   STORAGE GUARD (DEBUG) — FIXED
   ========================= */
(function AIVO_StorageGuard(){
  return; // 🔒 DISABLED (debug only)

  try {
    if (!window.localStorage) return;
    const ls = window.localStorage;

    const _clear = ls.clear.bind(ls);
    const _removeItem = ls.removeItem.bind(ls);
    const _setItem = ls.setItem.bind(ls);

    ls.clear = function(){
      console.warn("[AIVO][LS] clear() çağrıldı!");
      console.trace();
      return _clear();
    };

    ls.removeItem = function(k){
      const key = String(k || "");
      if (key.startsWith("aivo_") || key.startsWith("AIVO_")) {
        console.warn("[AIVO][LS] removeItem:", key);
        console.trace();
      }
      return _removeItem(k);
    };

    ls.setItem = function(k, v){
      const key = String(k || "");
      const isAivo = key.startsWith("aivo_") || key.startsWith("AIVO_");

      if (isAivo) {
        const len = String(v ?? "").length;
        const hot = (key === "aivo_credits" || key === "aivo_invoices" || key === "aivo_store_v1" || key === "aivo_invoices_v1");
        console.warn(
          hot ? "[AIVO][LS][HOT] setItem:" : "[AIVO][LS] setItem:",
          key,
          "(len:", len, ")"
        );
        console.trace();
      }

      return _setItem(k, v);
    };
  } catch (_) {}
})();

// =========================================================
// PAYMENT FINALIZER (DISABLED)
// ---------------------------------------------------------
// Bu dosyada ödeme doğrulama veya kredi ekleme yapılmaz.
// Tek otorite: store.js
// =========================================================
(function paymentFinalizeDisabled() {
  try {
    // no-op
  } catch (_) {}
})();




document.addEventListener("DOMContentLoaded", () => {

/* =========================================================
   HELPERS (CLEAN)
   - Satın alma / mock kredi / fatura helper'ları çıkarıldı
   - Routing helpers sadeleştirildi
   - Kredi UI sync: AIVO_STORE_V1 varsa onu okur, yoksa sadece fallback okur (write yok)
   ========================================================= */

const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function pageExists(key) {
  return !!qs(`.page[data-page="${key}"]`);
}

function normalizePageKey(input) {
  const p = String(input || "").toLowerCase().trim();
  if (p && pageExists(p)) return p;

  // ✅ SADE ALIAS (checkout yok)
  const aliases = {
    music: ["music", "muzik", "müzik", "audio", "song"],
    cover: ["cover", "kapak", "gorsel", "görsel", "visual", "image", "img"],
    video: ["video", "ai-video", "vid"],
    // checkout: tamamen kaldırıldı
  };

  for (const [target, keys] of Object.entries(aliases)) {
    if (keys.includes(p)) {
      if (pageExists(target)) return target;

      // cover fallback’leri (farklı isimle sayfa varsa)
      if (target === "cover" && pageExists("visual")) return "visual";
      if (target === "cover" && pageExists("gorsel")) return "gorsel";
      if (target === "cover" && pageExists("kapak")) return "kapak";
    }
  }

  // default page
  if (pageExists("music")) return "music";
  const first = qs(".page[data-page]")?.getAttribute("data-page");
  return first || "music";
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
  // önce tüm aktifleri temizle
  qsa(".sidebar [data-page-link]").forEach((b) => b.classList.remove("is-active"));

  // sadece aktif sayfanın sidebar’ı içinde işaretle
  const activePage = qs(".page.is-active");
  if (!activePage) return;

  qsa(".sidebar [data-page-link]", activePage).forEach((b) => {
    b.classList.toggle("is-active", b.getAttribute("data-page-link") === target);
  });
}

function activateRealPage(target) {
  qsa(".page").forEach((p) => {
    p.classList.toggle("is-active", p.getAttribute("data-page") === target);
  });

  setTopnavActive(target);
  setSidebarsActive(target);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================================
   Credits UI Sync (READ-ONLY)
   - Yeni otorite: AIVO_STORE_V1.getCredits() (varsa)
   - Fallback: localStorage aivo_credits (sadece okur, yazmaz)
   ========================================================= */
function aivoReadCredits() {
  try {
    if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
      return Number(window.AIVO_STORE_V1.getCredits() || 0);
    }
  } catch (_) {}

  // fallback (legacy) - write YOK
  try {
    return Number(localStorage.getItem("aivo_credits") || 0);
  } catch (_) {}

  return 0;
}

function syncCreditsUI() {
  const credits = aivoReadCredits();

  // studio içindeki olası id/selector’lar
  const el1 = qs("#creditCount");
  if (el1) el1.textContent = String(credits);

  const el2 = qs("#creditsCount");
  if (el2) el2.textContent = String(credits);

  const el3 = qs("[data-credits]");
  if (el3) el3.textContent = String(credits);

  const el4 = qs("#topCreditCount");
  if (el4) el4.textContent = String(credits);
}

// DOM hazır olunca 1 kez sync
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncCreditsUI);
} else {
  syncCreditsUI();
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
   (Right Panel OWNER-SAFE)
   ------------------------------ */
if (target === "video" || target === "ai-video") {
  // Music page’e geç
  if (pageExists("music")) activateRealPage("music");

  // Subview’i video yap
  if (typeof switchMusicView === "function") switchMusicView("ai-video");

  // Üst menü video seçili görünsün
  setTopnavActive("video");

  // Sidebar page aktifliği "music" (gerçek sayfa)
  setSidebarsActive("music");

  // AI Üret butonunu video’ya kilitle
  if (typeof setAIProduceActiveByPageLink === "function") {
    setAIProduceActiveByPageLink("video");
  }

  // 🔒 RIGHT PANEL OWNER GUARD (TEK OTORİTE)
  const rightPanel = document.querySelector('#studioRightPanel');
  if (!rightPanel || !rightPanel.hasAttribute('data-jobs-owner')) {
    if (typeof setRightPanelMode === "function") {
      setRightPanelMode("video");
    }
  }

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

// MUSIC'e dönünce: varsa pending tab'ı aç, yoksa default "geleneksel"
if (target === "music") {
  const pending = sessionStorage.getItem("aivo_music_tab"); // "ses-kaydi" | "ai-video" | "geleneksel"
  const viewToOpen = pending || "geleneksel";
  if (pending) sessionStorage.removeItem("aivo_music_tab");

  if (typeof switchMusicView === "function") switchMusicView(viewToOpen);
{
  const rightPanel = document.querySelector('#studioRightPanel');
  if (!rightPanel || !rightPanel.hasAttribute('data-jobs-owner')) {
    if (typeof setRightPanelMode === "function") setRightPanelMode("music");
  }
}

  if (typeof refreshEmptyStates === "function") refreshEmptyStates();

  // ✅ KRİTİK FIX:
  // MUSIC içindeki subview'a göre AI Üret active'i ZORLA senkronla
  if (typeof window.setAIProduceActiveByPageLink === "function") {
    if (viewToOpen === "ai-video") {
      window.setAIProduceActiveByPageLink("video");
    } else if (viewToOpen === "ses-kaydi") {
      window.setAIProduceActiveByPageLink("record");
    } else {
      // 👈 GELENEKSEL
      window.setAIProduceActiveByPageLink("music");
    }
  }
}

// ✅ CHECKOUT açılınca seçilen paket/fiyatı doldur
if (target === "checkout") {
  renderCheckoutFromStorage();
}
}

// ✅ KRİTİK: Pricing içi BUY -> checkout geçişi window.switchPage ister
window.switchPage = switchPage;



/* =========================================================
   AI ÜRET ACTIVE (BUTON ÇERÇEVESİ) — AYRI YÖNETİM
   ========================================================= */
function setAIProduceActiveByLink(linkEl) {
  const btn = linkEl && linkEl.closest ? linkEl.closest(".sidebar-section--ai .sidebar-link") : null;
  if (!btn) return;
  document
    .querySelectorAll(".sidebar-section--ai .sidebar-link")
    .forEach(x => x.classList.remove("is-active"));
  btn.classList.add("is-active");
}

function setAIProduceActiveByPageLink(pageLink) {
  const btn = document.querySelector(`.sidebar-section--ai .sidebar-link[data-page-link="${pageLink}"]`);
  if (!btn) return;
  document
    .querySelectorAll(".sidebar-section--ai .sidebar-link")
    .forEach(x => x.classList.remove("is-active"));
  btn.classList.add("is-active");
}

 /* =========================================================
   GLOBAL CLICK HANDLER (NAV + MODALS + GENERATE)
   ========================================================= */
document.addEventListener("click", (e) => {





  /* -----------------------------------------
     2) Page navigation
     ----------------------------------------- */
  const linkEl = e.target.closest("[data-page-link]");
  if (!linkEl) return;

  const target = linkEl.getAttribute("data-page-link");
  if (!target) return;

  e.preventDefault();
  e.stopPropagation();

  // ✅ AI Üret: tıklanan butonun çerçevesini hemen güncelle
  setAIProduceActiveByLink(linkEl);

  // ✅ Kredi menüsü yanlışlıkla page-link olarak bağlandıysa modal aç
  const pricingKeys = new Set(["pricing", "credits", "kredi", "kredi-al", "credit", "buy-credits"]);
 if (pricingKeys.has(target)) {
  window.location.href = "/fiyatlandirma.html#packs";
  return;
}

  // ✅ RECORD (ses kaydı) ayrı page değil -> MUSIC subview
  if (target === "record") {
    sessionStorage.setItem("aivo_music_tab", "ses-kaydi");
    switchPage("music");
    if (typeof switchMusicView === "function") switchMusicView("ses-kaydi");
    setTopnavActive("music");
    setSidebarsActive("music");
    setAIProduceActiveByPageLink("record");
    return;
  }

  // ✅ VIDEO ayrı page değil -> MUSIC + ai-video subview
  if (target === "video" || target === "ai-video") {
    sessionStorage.setItem("aivo_music_tab", "ai-video");
    switchPage("music");
    if (typeof switchMusicView === "function") switchMusicView("ai-video");
    setTopnavActive("video");
    setSidebarsActive("music");
    setAIProduceActiveByPageLink("video");
    return;
  }

  switchPage(target);
});

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
function buildMusicCardHTML(data){
  // data: { title, subtitle, durationText, dateText, statusText, audio_url }
  var title = (data && data.title) ? String(data.title) : "Müzik";
  var subtitle = (data && data.subtitle) ? String(data.subtitle) : "Üretim";
  var durationText = (data && data.durationText) ? String(data.durationText) : "";
  var dateText = (data && data.dateText) ? String(data.dateText) : "";
  var statusText = (data && data.statusText) ? String(data.statusText) : "";

  return `
    <div class="mcard">
      <button type="button" class="mplay" data-role="play" aria-label="Oynat/Duraklat">
        ▶
      </button>

      <div class="minfo">
        <div class="mtop">
          <div class="mtitle">${escapeHtml(title)}</div>
          ${statusText ? `<span class="mbadge">${escapeHtml(statusText)}</span>` : ``}
        </div>
        <div class="msub">${escapeHtml(subtitle)}</div>
        <div class="mmeta">
          ${durationText ? `<span>${escapeHtml(durationText)}</span>` : ``}
          ${(durationText && dateText) ? `<span class="mdot">•</span>` : ``}
          ${dateText ? `<span>${escapeHtml(dateText)}</span>` : ``}
        </div>
      </div>

      <div class="mactions">
        <button type="button" class="mico" data-role="copy" aria-label="Kopyala">⧉</button>
        <button type="button" class="mico" data-role="download" aria-label="İndir">⬇</button>
        <button type="button" class="mico danger" data-role="delete" aria-label="Sil">🗑</button>
      </div>

      <audio preload="none" data-role="audio"></audio>
    </div>
  `;
}

function escapeHtml(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

  function createMusicItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    // Eita-like card template
item.innerHTML = `
  <div class="mwrap">
    <button type="button" class="mplay" data-role="play" aria-label="Oynat/Duraklat">▶</button>

    <div class="minfo">
      <div class="mline1">
        <div class="mtitle" data-role="title">Müzik</div>
        <span class="mbadge" data-role="badge">${placeholder ? "İşleniyor" : "Hazır"}</span>
      </div>

      <div class="msub" data-role="subtitle">${placeholder ? "Üretim başladı..." : "Türkçe güncel sesler"}</div>

      <div class="mmeta">
        <span data-role="duration"></span>
        <span class="mdot"></span>
        <span data-role="date"></span>
      </div>
    </div>

    <div class="mactions">
      <button type="button" class="mico" data-role="share" aria-label="Paylaş">👥</button>
      <button type="button" class="mico" data-role="copy" aria-label="Kopyala">⧉</button>
      <button type="button" class="mico" data-role="download" aria-label="İndir">⬇</button>
      <button type="button" class="mico" data-role="regen" aria-label="Yenile">↻</button>
      <button type="button" class="mico" data-role="edit" aria-label="Düzenle">✎</button>
      <button type="button" class="mico danger" data-role="delete" aria-label="Sil">🗑</button>
    </div>

    <audio preload="none" data-role="audio"></audio>
  </div>
`;
    item.className = "media-item music-item";
    item.dataset.kind = "music";
    item.dataset.status = placeholder ? "pending" : "ready";

    item.innerHTML = `
      <div class="mwrap">
        <button type="button" class="mplay" data-role="play" aria-label="Oynat/Duraklat">▶</button>

        <div class="minfo">
          <div class="mline1">
            <div class="mtitle" data-role="title">Müzik</div>
            <span class="mbadge" data-role="badge">${placeholder ? "İşleniyor" : "Hazır"}</span>
          </div>

          <div class="msub" data-role="subtitle">${placeholder ? "Üretim başladı..." : "Türkçe güncel sesler"}</div>

          <div class="mmeta">
            <span data-role="duration"></span>
            <span class="mdot">•</span>
            <span data-role="date"></span>
          </div>
        </div>

        <div class="mactions">
          <button type="button" class="mico" data-role="share" aria-label="Paylaş">👥</button>
          <button type="button" class="mico" data-role="copy" aria-label="Kopyala">⧉</button>
          <button type="button" class="mico" data-role="download" aria-label="İndir">⬇</button>
          <button type="button" class="mico" data-role="regen" aria-label="Yenile">↻</button>
          <button type="button" class="mico" data-role="edit" aria-label="Düzenle">✎</button>
          <button type="button" class="mico danger" data-role="delete" aria-label="Sil">🗑</button>
        </div>

        <audio preload="none" data-role="audio"></audio>
      </div>
    `;

    if (placeholder) {
      item.querySelectorAll("button").forEach((b) => b.classList.add("is-disabled"));
    } else {
      // no-op
    }
    function wireMusicCard(item){
  var playBtn = item.querySelector('[data-role="play"]');
  var audio = item.querySelector('[data-role="audio"]');

  var btnCopy = item.querySelector('[data-role="copy"]');
  var btnDl = item.querySelector('[data-role="download"]');
  var btnDel = item.querySelector('[data-role="delete"]');

  function setPlayingUI(on){
    if (!playBtn) return;
    playBtn.textContent = on ? "❚❚" : "▶";
    item.classList.toggle("is-playing", !!on);
  }

  if (audio){
    audio.addEventListener("play", function(){ setPlayingUI(true); });
    audio.addEventListener("pause", function(){ setPlayingUI(false); });
    audio.addEventListener("ended", function(){ setPlayingUI(false); });
  }

if (playBtn){
  playBtn.addEventListener("click", function(ev){
    ev.preventDefault();
    ev.stoppropagation();
    if (!audio) return;

    // url yoksa oynatma
    if (!audio.src) {
      if (window.toast) window.toast.error("Ses henüz hazır değil.");
      return;
    }

    if (audio.paused) {
      // 🔒 başka çalan varsa durdur
      stopOtherAudio(audio);

      audio.play().catch(function(){});
    } else {
      audio.pause();
    }
  });
}

  if (btnCopy){
    btnCopy.addEventListener("click", function(ev){
      ev.preventDefault(); ev.stopPropagation();
      var url = audio && audio.src ? audio.src : "";
      if (!url) return;
      try {
        navigator.clipboard.writeText(url);
        if (window.toast) window.toast.success("Link kopyalandı");
      } catch(_){}
    });
  }

  if (btnDl){
    btnDl.addEventListener("click", function(ev){
      ev.preventDefault(); ev.stopPropagation();
      var url = audio && audio.src ? audio.src : "";
      if (!url) return;
      // basit download
      var a = document.createElement("a");
      a.href = url;
      a.download = "aivo-music.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  if (btnDel){
    btnDel.addEventListener("click", function(ev){
      ev.preventDefault(); ev.stopPropagation();
      item.remove();
      if (typeof refreshEmptyStates === "function") refreshEmptyStates();
    });
  }
}


    return item;
  }

/* =========================================================
   MUSIC PLAYER CARDS (V2) — player-first (no jobs)
   - addProcessingPair() => v1 + v2 kartı anında basar
   - markReady(id, audioUrl) => kartı ready yapar
   - markError(id, msg) => kartı error yapar
   ========================================================= */

function uid(prefix="trk"){
  return prefix + "_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

function ensureMusicList(){
  const list = document.querySelector("#musicList");
  if (!list) {
    console.warn("[AIVO] #musicList yok");
    return null;
  }
  return list;
}

function createMusicCardV2({ id, title, subtitle, status = "processing" }){
  const item = document.createElement("div");
  item.className = "media-item music-item";
  item.dataset.kind = "music";
  item.dataset.trackId = id;
  item.dataset.status = status; // processing | ready | error
  item.dataset.src = "";

  // left
  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "4px";
  left.style.minWidth = "0";

  const rowTop = document.createElement("div");
  rowTop.style.display = "flex";
  rowTop.style.alignItems = "center";
  rowTop.style.gap = "10px";

  const playBtn = createIconButton("▶", "Oynat/Duraklat");
  playBtn.style.width = "46px";
  playBtn.style.height = "46px";
  playBtn.style.borderRadius = "999px";

  const meta = document.createElement("div");
  meta.style.minWidth = "0";

  const t = document.createElement("div");
  t.style.fontWeight = "800";
  t.style.whiteSpace = "nowrap";
  t.style.overflow = "hidden";
  t.style.textOverflow = "ellipsis";
  t.textContent = title || "Müzik";

  const sub = document.createElement("div");
  sub.style.opacity = ".75";
  sub.style.fontSize = "12px";
  sub.style.whiteSpace = "nowrap";
  sub.style.overflow = "hidden";
  sub.style.textOverflow = "ellipsis";
  sub.textContent = subtitle || "";

  meta.appendChild(t);
  meta.appendChild(sub);

  const badge = document.createElement("span");
  badge.className = "chip";
  badge.style.marginLeft = "auto";
  badge.textContent = status === "processing" ? "İşleniyor" : status === "ready" ? "Hazır" : "Hata";

  rowTop.appendChild(playBtn);
  rowTop.appendChild(meta);
  rowTop.appendChild(badge);

  left.appendChild(rowTop);

  // right icons
  const right = document.createElement("div");
  right.className = "icon-row";

  const downloadBtn = createIconButton("⬇", "İndir");
  const delBtn = createIconButton("✖", "Sil", "danger");

  right.appendChild(downloadBtn);
  right.appendChild(delBtn);

  item.appendChild(left);
  item.appendChild(right);

  // state helpers
  function setStatus(st, msg){
    item.dataset.status = st;
    if (st === "processing"){
      badge.textContent = "İşleniyor";
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
    } else if (st === "ready"){
      badge.textContent = "Hazır";
      playBtn.classList.remove("is-disabled");
      downloadBtn.classList.remove("is-disabled");
    } else {
      badge.textContent = "Hata";
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      if (msg) sub.textContent = msg;
    }
  }

  // events
  playBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (item.dataset.status !== "ready") return;

    const src = item.dataset.src;
    if (!src) return;

    // Global player varsa oraya ver (yoksa sadece console)
    if (window.AIVO_PLAYER && typeof window.AIVO_PLAYER.load === "function") {
      window.AIVO_PLAYER.load({ src, title: t.textContent });
      window.AIVO_PLAYER.play();
      return;
    }

    console.log("[AIVO] play:", src);
  });

  downloadBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (item.dataset.status !== "ready") return;
    const src = item.dataset.src;
    if (!src) return;

    // şimdilik direkt aç
    window.open(src, "_blank");
  });

  delBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    item.remove();
    refreshEmptyStates();
  });

  // initial state
  setStatus(status);

  // expose setters on element
  item.__setStatus = setStatus;
  item.__setSubtitle = (txt) => { sub.textContent = txt || ""; };
  item.__setSrc = (src) => { item.dataset.src = src || ""; };

  return item;
}

window.AIVO_MUSIC_CARDS = window.AIVO_MUSIC_CARDS || {
  addProcessingPair: function({ name = "Yeni Müzik", prompt = "" } = {}){
    const list = ensureMusicList();
    if (!list) return null;

    setRightPanelMode("music");

    const id1 = uid("trk_v1");
    const id2 = uid("trk_v2");

    const c1 = createMusicCardV2({
      id: id1,
      title: name,
      subtitle: "v1 • işleniyor",
      status: "processing"
    });

    const c2 = createMusicCardV2({
      id: id2,
      title: name + " (Bonus)",
      subtitle: "v2 • işleniyor",
      status: "processing"
    });

    list.prepend(c2);
    list.prepend(c1);
    refreshEmptyStates();

    return { v1: id1, v2: id2 };
  },

  markReady: function(trackId, audioUrl){
    const el = document.querySelector(`.music-item[data-track-id="${trackId}"]`);
    if (!el) return false;
    el.__setSrc(audioUrl);
    el.__setSubtitle("Hazır • oynat / indir");
    el.__setStatus("ready");
    return true;
  },

  markError: function(trackId, msg){
    const el = document.querySelector(`.music-item[data-track-id="${trackId}"]`);
    if (!el) return false;
    el.__setStatus("error", msg || "Üretim başarısız");
    return true;
  }
};

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

// ===============================
// VIDEO FLOW — UI + placeholder + "API'ye gidecek" log'u
// Bu fonksiyon kredi kesmez. Krediyi VIDEO OVERRIDE bloğu kesecek.
// ===============================

bindCounter("videoPrompt", "videoPromptCounter", 1000);
bindCounter("videoImagePrompt", "videoImagePromptCounter", 500);

// ✅ TEK UI AKIŞI (global fonksiyon)
window.AIVO_RUN_VIDEO_FLOW = function (btn, loadingText, delay) {
  try {
    delay = Number(delay) || 1400;
    loadingText = String(loadingText || "🎬 Video Oluşturuluyor...");

    if (!btn) return;
    if (btn.classList && btn.classList.contains("is-loading")) return;

    // Right panel video moda al
    try { setRightPanelMode("video"); } catch (_) {}

    var original = btn.textContent;
    try { btn.classList.add("is-loading"); } catch (_) {}
    try { btn.textContent = loadingText; } catch (_) {}

    // Placeholder ekle
    try { addPlaceholderAndActivate(videoList, createVideoItem, delay); } catch (_) {}

    setTimeout(function () {
      try { btn.classList.remove("is-loading"); } catch (_) {}
      try { btn.textContent = original; } catch (_) {}
      console.log("AI Video isteği burada API'ye gidecek.");
    }, delay);

  } catch (e) {
    console.error("AIVO_RUN_VIDEO_FLOW error:", e);
  }
};

// ✅ attach sadece flow çağırır (kredi kesmez)
function attachVideoGenerate(btnId, loadingText, delay) {
  var btn = (typeof qs === "function") ? qs("#" + btnId) : document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener("click", function (e) {
    // ⚠️ ÖNEMLİ: Eğer kredi override (capture) devredeyse,
    // burada ikinci bir iş yapmayalım; sadece flow çağrısı kalsın.
    try { if (e) e.preventDefault(); } catch (_) {}

    if (typeof window.AIVO_RUN_VIDEO_FLOW === "function") {
      window.AIVO_RUN_VIDEO_FLOW(btn, loadingText, delay);
    } else {
      console.warn("AIVO_RUN_VIDEO_FLOW bulunamadı.");
    }
  }, false);
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
   COVER GENERATE + GALLERY ITEMS (LEGACY - DISABLED)
   Moved to studio.app.js: generateCover() + credits + output
   ========================================================= */
(function disableLegacyCoverBlock(){
  // default OFF. To temporarily test legacy, set: window.__AIVO_DISABLE_LEGACY_COVER__ = false;
  if (window.__AIVO_DISABLE_LEGACY_COVER__ !== false) return;

  /* ====== LEGACY (kept for reference) ======
  const coverGenerateBtn = qs("#coverGenerateBtn");
  const coverGallery = qs("#coverGallery");

  function createCoverGalleryItem({ placeholder = false } = {}) { ... }

  if (coverGenerateBtn) {
    coverGenerateBtn.addEventListener("click", (e) => {
      ...
      console.log("Kapak üretim isteği burada görsel AI API'ye gidecek.");
      ...
    });
  }
  ========================================= */
})();


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
   INVOICES (BACKEND) — FETCH + RENDER (NO localStorage writes, NO switchPage override)
   Tek otorite: /api/invoices/get?email=...
   ========================================================= */
(function () {
  var LS_KEY = "aivo_invoices"; // sadece fallback okumak için (yazma YOK)

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (_) { return fallback; }
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

  function formatTRY(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return String(amount || "");
    try {
      return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
    } catch (_) {
      return (Math.round(n * 100) / 100).toFixed(2) + " TL";
    }
  }

  // ✅ verify-session invoice shape normalize:
  // { id, provider:"stripe", credits, created_at, status, ... }
  function normalizeInvoice(inv) {
    inv = (inv && typeof inv === "object") ? inv : {};

    var created =
      inv.createdAt || inv.created_at || inv.created || inv.date || inv.ts || inv.time || inv.createdAtMs;

    // createdAt: number(ms) veya ISO/string
    var createdAt =
      (typeof created === "number") ? created :
      (created ? String(created) : "");

    // plan/title
    var plan =
      inv.plan || inv.title || inv.type || "Satın Alma";

    var provider =
      inv.provider || inv.gateway || inv.source || "Stripe";

    var status =
      inv.status || "paid";

    // credits alanları
    var creditsAdded =
      (inv.creditsAdded != null) ? inv.creditsAdded :
      (inv.credits != null) ? inv.credits :
      (inv.added != null) ? inv.added :
      null;

    // price alanları (yoksa boş bırak)
    var price =
      (inv.price != null) ? inv.price :
      (inv.amount != null) ? inv.amount :
      (inv.total != null) ? inv.total :
      null;

    return {
      id: inv.id || "",
      createdAt: createdAt,
      plan: plan,
      provider: provider,
      status: status,
      price: price,
      creditsAdded: creditsAdded
    };
  }

  function invoiceCardHtml(rawInv) {
    var inv = normalizeInvoice(rawInv);

    var created = inv.createdAt ? new Date(inv.createdAt) : null;
    var createdText = created && !isNaN(created.getTime())
      ? created.toLocaleString("tr-TR")
      : (inv.createdAt ? String(inv.createdAt) : "");

    var plan = escapeHtml(inv.plan || "Satın Alma");
    var provider = escapeHtml(inv.provider || "Stripe");
    var status = escapeHtml(inv.status || "paid");

    var priceText = (inv.price != null && inv.price !== "")
      ? escapeHtml(formatTRY(inv.price))
      : "";

    var creditsText = (inv.creditsAdded != null && inv.creditsAdded !== "")
      ? escapeHtml(String(inv.creditsAdded))
      : "";

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
      return toTime(normalizeInvoice(b).createdAt) - toTime(normalizeInvoice(a).createdAt);
    });

    nodes.cards.innerHTML = sorted.map(invoiceCardHtml).join("");
  }

  // ✅ email kaynağı: session/store fallback
  function getEmail() {
    try {
      if (window.__AIVO_SESSION__ && window.__AIVO_SESSION__.email) return String(window.__AIVO_SESSION__.email || "").trim().toLowerCase();
    } catch (_) {}
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getEmail === "function") {
        return String(window.AIVO_STORE_V1.getEmail() || "").trim().toLowerCase();
      }
    } catch (_) {}
    return "";
  }

  async function fetchInvoicesFromApi() {
    var email = getEmail();
    if (!email) return [];

    var url = "/api/invoices/get?email=" + encodeURIComponent(email);
    var r = await fetch(url, { credentials: "include", cache: "no-store" });
    var data = await r.json().catch(function () { return null; });
    if (!data || !data.ok) return [];

    // data.invoices -> backend normalize: array
    return Array.isArray(data.invoices) ? data.invoices : [];
  }

  // (opsiyonel) sadece okuma fallback: localStorage’daki eski kayıtlar
  function loadLegacyInvoicesReadOnly() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var list = safeJsonParse(raw, []);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  async function refreshInvoices() {
    try {
      var list = await fetchInvoicesFromApi();

      // API boş dönerse (ilk geçişlerde) legacy’yi sadece görüntüle (yazma yok)
      if (!list || list.length === 0) {
        var legacy = loadLegacyInvoicesReadOnly();
        if (legacy && legacy.length) {
          renderInvoices(legacy);
          return;
        }
      }

      renderInvoices(list || []);
    } catch (_) {
      // offline / hata: legacy read-only göster
      renderInvoices(loadLegacyInvoicesReadOnly());
    }
  }

  // ✅ GLOBAL: sadece “refresh” expose edelim (add/save yok)
  window.refreshInvoices = refreshInvoices;

  // ✅ Router’a dokunma. Sadece “invoices sayfası açıldıysa” periyodik dene.
  function isInvoicesPageActive() {
    // Senin sistemde sayfa active class / data-page olabilir.
    // En güvenlisi: DOM’da invoices container var mı diye bakmak.
    var nodes = getInvoicesNodes();
    return !!(nodes && nodes.cards && nodes.empty);
  }

  document.addEventListener("DOMContentLoaded", function () {
    // İlk yüklemede (eğer invoices DOM hazırsa) çek
    if (isInvoicesPageActive()) refreshInvoices();

    // Router DOM’u sonradan basıyorsa kısa retry
    setTimeout(function () {
      if (isInvoicesPageActive()) refreshInvoices();
    }, 300);

    // Kullanıcı sayfaya geçince (routing event yoksa) hafif gözlem:
    // invoices DOM oluştuğu an 1 kez fetch et.
    var done = false;
    var obs = new MutationObserver(function () {
      if (done) return;
      if (isInvoicesPageActive()) {
        done = true;
        refreshInvoices();
        try { obs.disconnect(); } catch (_) {}
      }
    });
    try { obs.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  });
})();






document.addEventListener("DOMContentLoaded", function () {
  // HERO TYPE SWAP
  const el = document.querySelector(".aivo-title .type");
  if (el) {
    const words = (el.dataset.words || "").split(",");
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

    const panel = el.querySelector(".dropdown");
    if (panel) panel.addEventListener("click", (e) => e.stopPropagation());

    btn.addEventListener("click", (e) => {
      const isLink = btn.tagName === "A";
      const href = isLink ? (btn.getAttribute("href") || "").trim() : "";

      const isDummyHref =
        !href || href === "#" || href.toLowerCase().startsWith("javascript:");

      if (isDummyHref) {
        e.preventDefault();
      }

      e.stopPropagation();

      document
        .querySelectorAll(".nav-item.has-dropdown.is-open")
        .forEach((x) => {
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

  document.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item.has-dropdown.is-open")
      .forEach((x) => x.classList.remove("is-open"));
  });
})();

/* =========================================================
   STUDIO TOPBAR — AUTH UI (UI ONLY, NO LOGOUT LOGIC)
   - Studio'da Guest (Giriş/Kayıt) ASLA görünmez
   - Sadece "Çıkış Yap" UI olarak görünür
   - Logout işlemi auth.unify.fix.js tarafından yönetilir
   ========================================================= */
(() => {
  if (window.__AIVO_STUDIO_ONLY_UI__) return;
  window.__AIVO_STUDIO_ONLY_UI__ = true;

  function enforceStudioAuthUI(){
    const guest = document.getElementById("authGuest");
    const user  = document.getElementById("authUser");

    if (guest) guest.style.display = "none";
    if (user)  user.style.display = "";
  }

  function boot(){
    enforceStudioAuthUI();

    // Başka JS/CSS geri açarsa tekrar kapat
    setTimeout(enforceStudioAuthUI, 50);
    setTimeout(enforceStudioAuthUI, 200);
    setTimeout(enforceStudioAuthUI, 600);
  }

  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("focus", enforceStudioAuthUI);
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

/* =========================
   VIDEO UI COST LABEL (10/14)
   - sadece yazı günceller
   - kredi kesme mantığına dokunmaz
   ========================= */
(function videoCostUILabel(){
  const audio = document.getElementById("audioEnabled");
  const textBtn = document.getElementById("videoGenerateTextBtn");
  const imgBtn  = document.getElementById("videoGenerateImageBtn");
  if (!audio || !textBtn || !imgBtn) return;

  // Badge’ler: mevcut yapıda card-header içindeki .badge-beta
  const textBadge = textBtn.closest(".card")?.querySelector(".card-header .badge-beta");
  const imgBadge  = imgBtn.closest(".card")?.querySelector(".card-header .badge-beta");

  function apply() {
    const cost = audio.checked ? 14 : 10;

    if (textBadge) textBadge.textContent = `${cost} Kredi`;
    if (imgBadge)  imgBadge.textContent  = `${cost} Kredi`;

    // Buton yazıları
    textBtn.innerHTML = `🎬 Video Oluştur (${cost} Kredi)`;
    imgBtn.innerHTML  = `🎞 Video Oluştur (${cost} Kredi)`;
  }

  audio.addEventListener("change", apply);
  apply(); // ilk açılışta doğru yazsın
})();


/* =========================================================
   INVOICES PAGE RENDER — STABLE + PREMIUM + LOAD MORE (FINAL)
   - target: [data-invoices-cards]
   - empty:  [data-invoices-empty]
   - filters: [data-invoices-filter]
   - export:  [data-invoices-export]
   - more:    [data-invoices-more]
   - source: AIVO_STORE_V1.listInvoices() || _readInvoices() || localStorage
   - UI: TR status/provider + AIVO order_no (human readable)
   - Load more: PAGE_SIZE=12, filter reset, print shows all
   ========================================================= */
(function () {
  "use strict";

  var FILTER_KEY = "__AIVO_INVOICES_FILTER_V1";

  // ✅ Load more
  var PAGE_SIZE = 12;
  var LIMIT_KEY = "__AIVO_INVOICES_LIMIT_V1";

  function safeJSON(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function getInvoicesSafe() {
    var S = window.AIVO_STORE_V1;

    if (S && typeof S.listInvoices === "function") {
      var a = S.listInvoices();
      return Array.isArray(a) ? a : [];
    }

    if (S && typeof S._readInvoices === "function") {
      var b = S._readInvoices();
      return Array.isArray(b) ? b : [];
    }

    var raw = localStorage.getItem("aivo_invoices_v1");
    var c = raw ? safeJSON(raw, []) : [];
    return Array.isArray(c) ? c : [];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (!isFinite(d.getTime())) return String(iso);
      return d.toLocaleString("tr-TR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (_) {
      return String(iso);
    }
  }

  function fmtTRY(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return "";
    try {
      return n.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
      });
    } catch (_) {
      return String(n) + " ₺";
    }
  }

  // --- UI MAPS (TR) ---
  function mapStatusTR(status) {
    var s = String(status || "").toLowerCase().trim();

    if (s === "paid" || s === "succeeded" || s === "success") return "Ödendi";
    if (s === "pending" || s === "open" || s === "processing") return "Beklemede";
    if (s === "failed" || s === "error") return "Başarısız";
    if (s === "canceled" || s === "cancelled") return "İptal";
    if (s === "refunded") return "İade";
    if (s === "partial_refund" || s === "partially_refunded") return "Kısmi İade";

    if (!s || s === "-") return "-";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function mapProviderTR(provider) {
    var p = String(provider || "").toLowerCase().trim();
    if (!p || p === "-") return "-";

    if (p.includes("stripe")) return "Kart";
   
    if (p.includes("iyzico") || p.includes("iyzi")) return "iyzico";

    return p.toUpperCase();
  }

  // --- AIVO ORDER NO (human readable) ---
  function makeAivoOrderNo(inv, fallbackId) {
    var existing = inv && (inv.order_no || inv.orderNo || inv.aivo_order_no);
    if (existing) return String(existing);

    var iso = inv && inv.created_at;
    var d = iso ? new Date(iso) : new Date();

    var y = String(d.getFullYear());
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");

    var base = String(fallbackId || "").replace(/\s+/g, "");
    var suffix = base ? base.slice(-6) : Math.random().toString(36).slice(2, 8).toUpperCase();

    var no = "AIVO-" + y + m + day + "-" + hh + mm + "-" + String(suffix).toUpperCase();

    try { inv.order_no = no; } catch (_) {}
    return no;
  }

  // --- FILTER ---
  function getFilter() {
    try {
      var v = window[FILTER_KEY] || localStorage.getItem(FILTER_KEY) || "all";
      v = String(v || "all");
      if (v !== "all" && v !== "purchase" && v !== "refund") v = "all";
      window[FILTER_KEY] = v;
      return v;
    } catch (_) {
      return "all";
    }
  }

  function setFilter(v) {
    try {
      v = String(v || "all");
      if (v !== "all" && v !== "purchase" && v !== "refund") v = "all";
      window[FILTER_KEY] = v;
      localStorage.setItem(FILTER_KEY, v);
    } catch (_) {}
  }

  function inferType(inv) {
    var t = (inv && (inv.type || inv.kind || inv.event || inv.action)) || "";
    t = String(t).toLowerCase();
    if (!t) return "purchase";
    if (t.includes("refund") || t.includes("iade")) return "refund";
    if (t.includes("purchase") || t.includes("buy") || t.includes("paid")) return "purchase";
    return "purchase";
  }

  function applyFilter(invoices) {
    var f = getFilter();
    if (f === "all") return invoices;

    return invoices.filter(function (inv) {
      var type = inferType(inv);
      return type === f;
    });
  }

  function syncFilterButtons() {
    var wrap = document.querySelector(".invoices-actions");
    if (!wrap) return;

    var f = getFilter();
    var btns = wrap.querySelectorAll("[data-invoices-filter]");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var v = b.getAttribute("data-invoices-filter") || "all";
      if (v === f) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
  }

  function syncExportButton(totalCount) {
    var exp = document.querySelector("[data-invoices-export]");
    if (!exp) return;
    exp.disabled = !(totalCount && totalCount > 0);
  }

  // --- LIMIT (LOAD MORE) ---
  function getLimit() {
    try {
      var v = window[LIMIT_KEY] || localStorage.getItem(LIMIT_KEY) || String(PAGE_SIZE);
      var n = parseInt(v, 10);
      if (!isFinite(n) || n < PAGE_SIZE) n = PAGE_SIZE;
      window[LIMIT_KEY] = n;
      return n;
    } catch (_) {
      return PAGE_SIZE;
    }
  }

  function setLimit(n) {
    try {
      n = parseInt(n, 10);
      if (!isFinite(n) || n < PAGE_SIZE) n = PAGE_SIZE;
      window[LIMIT_KEY] = n;
      localStorage.setItem(LIMIT_KEY, String(n));
    } catch (_) {}
  }

  function resetLimit() {
    setLimit(PAGE_SIZE);
  }

  function syncLoadMoreButton(totalFilteredCount, shownCount) {
    var btn = document.querySelector("[data-invoices-more]");
    if (!btn) return;

    var hasMore = totalFilteredCount > shownCount;
    btn.hidden = !hasMore;
  }

  function render() {
    var listEl = document.querySelector("[data-invoices-cards]");
    var emptyEl = document.querySelector("[data-invoices-empty]");

    if (!listEl && !emptyEl) return;

    var invoicesAll = getInvoicesSafe();
    syncExportButton(invoicesAll.length);

    // filtre butonları her render'da doğru görünsün
    syncFilterButtons();

    // 1) filtre uygula
    var invoices = applyFilter(invoicesAll);

    // 2) limit uygula (load more)
    var limit = getLimit();
    var invoicesShown = invoices.slice(0, limit);

    // Empty state (filtrelenmiş toplam üzerinden)
    if (emptyEl) {
      emptyEl.style.display = invoices.length ? "none" : "";
      if (!invoices.length) {
        var f = getFilter();
        emptyEl.textContent =
          (f === "all")
            ? "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek."
            : "Bu filtrede kayıt bulunamadı.";
      }
    }

    if (!listEl) return;

    if (!invoices.length) {
      listEl.innerHTML = "";
      syncLoadMoreButton(0, 0);
      return;
    }

    // Load more butonu (toplam filtrelenmiş vs gösterilen)
    syncLoadMoreButton(invoices.length, invoicesShown.length);

    listEl.innerHTML = invoicesShown.map(function (inv, i) {
      inv = inv || {};

      // ham id (teknik)
      var orderId  = inv.order_id || inv.orderId || inv.id || ("row_" + i);

      // user-friendly sipariş no
      var orderNo  = makeAivoOrderNo(inv, orderId);

      // raw -> TR
      var providerRaw = inv.provider || inv.gateway || "-";
      var statusRaw   = inv.status || "-";

      var provider = mapProviderTR(providerRaw);
      var status   = mapStatusTR(statusRaw);

      var pack     = inv.pack || inv.pack_key || "-";
      var credits  = (inv.credits != null ? inv.credits : "");
      var amount   = (inv.amount_try != null ? fmtTRY(inv.amount_try) : "");
      var created  = (inv.created_at ? fmtDate(inv.created_at) : "");

      // status semantic class (badge colors)
      var statusClass = "inv-badge--warn";
      var sr = String(statusRaw || "").toLowerCase();

      if (sr === "paid" || sr === "succeeded" || sr === "success") {
        statusClass = "inv-badge--ok";
      } else if (sr === "pending" || sr === "open" || sr === "processing") {
        statusClass = "inv-badge--warn";
      } else if (sr === "failed" || sr === "error" || sr === "canceled" || sr === "cancelled") {
        statusClass = "inv-badge--bad";
      } else if (sr === "refunded" || sr === "partial_refund" || sr === "partially_refunded") {
        statusClass = "inv-badge--refund";
      }

      var html = "";
      html += '<article class="invoice-card">';

      // HEADER (referans gizli)
      html +=   '<div class="inv-head">';
      html +=     '<div class="inv-head-left">';
      html +=       '<div class="inv-title">SİPARİŞ</div>';
      html +=       '<div class="inv-id">#' + esc(orderNo) + '</div>';
      html +=     '</div>';
      html +=     '<div class="inv-head-right">';
      html +=       '<span class="inv-badge inv-badge--status ' + statusClass + '">' + esc(status) + '</span>';
      html +=       '<span class="inv-badge inv-badge--provider">' + esc(provider) + '</span>';
      html +=     '</div>';
      html +=   '</div>';

      // GRID
      html +=   '<div class="inv-grid">';
      html +=     '<div class="inv-item"><span>Paket</span><strong>' + esc(pack) + '</strong></div>';

      if (credits !== "") {
        html +=   '<div class="inv-item"><span>Kredi</span><strong class="inv-good">+' + esc(credits) + '</strong></div>';
      }

      if (amount) {
        html +=   '<div class="inv-item"><span>Tutar</span><strong>' + esc(amount) + '</strong></div>';
      }

      if (created) {
        html +=   '<div class="inv-item"><span>Tarih</span><strong>' + esc(created) + '</strong></div>';
      }

      html +=   '</div>';
      html += '</article>';

      return html;
    }).join("");
  }

  function bindOnceUIHandlers() {
    if (window.__aivoInvoicesUIBound) return;
    window.__aivoInvoicesUIBound = true;

    // ✅ Filter click: reset limit + setFilter + render
    document.addEventListener("click", function (e) {
      var btn = e && e.target && e.target.closest ? e.target.closest("[data-invoices-filter]") : null;
      if (!btn) return;

      try { btn.blur && btn.blur(); } catch (_) {}

      var v = btn.getAttribute("data-invoices-filter") || "all";
      setFilter(v);
      resetLimit();
      render();
    });

    // ✅ Load more click
    document.addEventListener("click", function (e) {
      var btn = e && e.target && e.target.closest ? e.target.closest("[data-invoices-more]") : null;
      if (!btn) return;

      try { btn.blur && btn.blur(); } catch (_) {}

      var next = getLimit() + PAGE_SIZE;
      setLimit(next);
      render();
    });

    // ✅ Export click (print-to-PDF)
    document.addEventListener("click", function (e) {
      var btn = e && e.target && e.target.closest ? e.target.closest("[data-invoices-export]") : null;
      if (!btn) return;
      if (btn.disabled) return;

      try { btn.blur && btn.blur(); } catch (_) {}

      // PDF/Yazdır: hepsini bas
      try { setFilter("all"); } catch (_) {}
      try { setLimit(999999); } catch (_) {}
      try { render(); } catch (_) {}

      document.documentElement.classList.add("aivo-print-invoices");

      try {
        window.showToast && window.showToast("PDF / Yazdır penceresi açılıyor…", "ok");
      } catch (_) {}

      setTimeout(function () {
        try { window.print(); } catch (_) {}

        setTimeout(function () {
          document.documentElement.classList.remove("aivo-print-invoices");
          // print sonrası limit'i normal akışa döndür
          try { resetLimit(); } catch (_) {}
          try { render(); } catch (_) {}
        }, 400);
      }, 120);
    });
  }

  function bind() {
    // default filter: all
    if (!window[FILTER_KEY] && !localStorage.getItem(FILTER_KEY)) setFilter("all");
    // default limit: PAGE_SIZE
    if (!window[LIMIT_KEY] && !localStorage.getItem(LIMIT_KEY)) resetLimit();

    bindOnceUIHandlers();

    // Export buton metni: "PDF / Yazdır"
    try {
      var expBtn = document.querySelector("[data-invoices-export]");
      if (expBtn) expBtn.textContent = "PDF / Yazdır";
    } catch (_) {}

    render();

    // invoices değişti event'i varsa yakala (tek sefer)
    if (!window.__aivoInvoicesEvtBound) {
      window.__aivoInvoicesEvtBound = true;
      window.addEventListener("aivo:invoices-changed", function () {
        try { resetLimit(); } catch (_) {}
        try { render(); } catch (_) {}
      });
    }

    // switchPage varsa "invoices"e geçince yeniden render (limit reset)
    var _switch = window.switchPage;
    if (typeof _switch === "function" && !_switch.__aivoInvoicesWrapped) {
      function wrappedSwitchPage(target) {
        var r = _switch.apply(this, arguments);
        try {
          if (target === "invoices") {
            resetLimit();
            render();
          }
        } catch (_) {}
        return r;
      }
      wrappedSwitchPage.__aivoInvoicesWrapped = true;
      wrappedSwitchPage._orig = _switch;
      window.switchPage = wrappedSwitchPage;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();

/* =========================================================
   STRIPE SUCCESS FLOW — DISABLED (tek otorite: store.js)
   ---------------------------------------------------------
   - Studio tarafında verify-session / credits/add / toast YOK.
   - Bu blok intentionally no-op bırakıldı.
   ========================================================= */
(function AIVO_StripeSuccessFlow_DISABLED() {
  try {
    // no-op
  } catch (_) {}
})();





}); // ✅ SADECE 1 TANE KAPANIŞ — DOMContentLoaded
