/* =========================
   STORAGE GUARD (DEBUG)
   ========================= */
(function AIVO_StorageGuard(){
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
    if (String(k || "").startsWith("aivo_")) {
      console.warn("[AIVO][LS] removeItem:", k);
      console.trace();
    }
    return _removeItem(k);
  };

  ls.setItem = function(k, v){
    if (k === "aivo_invoices_v1") {
      console.warn("[AIVO][LS] setItem aivo_invoices_v1 (len:", String(v||"").length, ")");
      console.trace();
    }
    return _setItem(k, v);
  };
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


/* =========================================================
   🔒 MUSIC — SINGLE CREDIT SOURCE (FINAL)
   - Kredi kesen TEK yer: capture override
   - UI flow: AIVO_RUN_MUSIC_FLOW (kredi kesmez)
   - Maliyet: 5 (sadece müzik) / 14 (müzik + video)
   ========================================================= */
(function () {
  function toast(msg, type) {
    try {
      if (type === "error") return window.toast?.error?.(String(msg));
      if (type === "warning") return window.toast?.warning?.(String(msg));
      if (type === "info") return window.toast?.info?.(String(msg));
      return window.toast?.success?.(String(msg));
    } catch (_) {}
  }


  function openPricingModal() {
    try {
      if (typeof window.openPricingIfPossible === "function") return window.openPricingIfPossible();
      if (typeof window.openPricing === "function") return window.openPricing();

      var opener =
        document.querySelector(".btn-credit-buy") ||
        document.querySelector("[data-open-pricing]") ||
        document.getElementById("creditsButton");

      if (opener && typeof opener.click === "function") opener.click();
    } catch (_) {}
  }

  function isMusicWithVideoOn() {
    // 1) data attribute
    try {
      var el = document.querySelector('[data-music-with-video]');
      if (el) {
        var v = el.getAttribute("data-music-with-video");
        if (v === "true") return true;
        if (v === "false") return false;
      }
    } catch (_) {}

    // 2) class toggle
    try {
      if (document.querySelector(".music-with-video.is-active")) return true;
    } catch (_) {}

    // 3) checkbox/toggle variasyonları (varsa)
    try {
      var input =
        document.getElementById("musicWithVideo") ||
        document.querySelector('input[name="musicWithVideo"]') ||
        document.querySelector("[data-music-with-video-toggle]");

      if (input && typeof input.checked === "boolean") return !!input.checked;
    } catch (_) {}

    return false;
  }

  function getMusicCost() {
    var BASE_COST = 5;
    var VIDEO_ADDON = 9; // 5 + 9 = 14
    return isMusicWithVideoOn() ? (BASE_COST + VIDEO_ADDON) : BASE_COST;
  }

// ✅ CAPTURE OVERRIDE (MUSIC)
document.addEventListener(
  "click",
  function (e) {
    try {
      if (!e || !e.target) return;

      var t = e.target;

      // 1) Net ID
      var btn = t.closest ? t.closest("#musicGenerateBtn") : null;

      // 2) Fallback: data-generate="music"
      if (!btn && t.closest) {
        var cand = t.closest('button[data-generate="music"],a[data-generate="music"]');
        if (cand) btn = cand;
      }

      // 3) Fallback: içinde "music" geçen ve data-credit-cost taşıyan buton/anchor
      if (!btn && t.closest) {
        var cand2 = t.closest('button[data-credit-cost],a[data-credit-cost]');
        if (cand2) {
          var name = ((cand2.id || "") + " " + (cand2.className || "")).toLowerCase();
          if (name.indexOf("music") !== -1) btn = cand2;
        }
      }

      if (!btn) return;

      // 🔒 Zinciri tamamen kes
      try { e.preventDefault(); } catch (_) {}
      try { e.stopPropagation(); } catch (_) {}
      try { if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation(); } catch (_) {}

      var cost = getMusicCost();

      // 🔐 TEK OTORİTE: AIVO_STORE_V1
      if (
        !window.AIVO_STORE_V1 ||
        typeof window.AIVO_STORE_V1.consumeCredits !== "function" ||
        !window.AIVO_STORE_V1.consumeCredits(cost)
      ) {
        window.toast?.info?.("Yetersiz kredi. Kredi satın alman gerekiyor.");
        (window.redirectToPricing || window.redirectToPricingSafe || window.redirectToPricingLegacy)?.();
        if (!window.redirectToPricing && !window.redirectToPricingSafe && !window.redirectToPricingLegacy) {
          location.href = "/fiyatlandirma.html";
        }
        return;
      }

      // ✅ UI flow çağır (kredi kesmez)
      if (typeof window.AIVO_RUN_MUSIC_FLOW === "function") {
        window.AIVO_RUN_MUSIC_FLOW(btn, "🎵 Müzik Oluşturuluyor...", 1400);
      } else {
        try { console.log("🎵 MUSIC kredi düştü:", cost); } catch (_) {}
      }
    } catch (err) {
      console.error("MUSIC SINGLE CREDIT SOURCE error:", err);
    }
  },
  true
);
})(); 


/* =========================================================
   🎬 VIDEO — SINGLE CREDIT SOURCE (FINAL - FULL BLOCK)
   - Generate butonu: #videoGenerateTextBtn (fallback: [data-generate="video"])
   - Ses kapalı: 10 kredi
   - Ses açık : 14 kredi
   - Kredi kesen TEK yer: capture override
   ========================================================= */

(function VIDEO_SINGLE_CREDIT_SOURCE_FINAL(){

  // ---------------------------------------------------------
  // 0) Audio toggle cache (DOM okunamazsa bile garanti)
  // ---------------------------------------------------------
  window.__AIVO_VIDEO_AUDIO_CACHE__ = window.__AIVO_VIDEO_AUDIO_CACHE__;

  // Ses Üretimi kartına tıklanınca cache'i güncelle (zor UI switch’lerde garanti)
  document.addEventListener("click", function(e){
    try{
      var t = e.target;
      if (!t || !t.closest) return;

      // "Ses Üretimi" metnini içeren bir kapsayıcıya tıklandı mı?
      var box = t.closest(".audio-card, .audio-box, .audio-row, .card, section, div");
      if (!box) return;

      if ((box.textContent || "").indexOf("Ses Üretimi") === -1) return;

      // UI switch state'i bazen click sonrası değişir, bu yüzden microtask
      setTimeout(function(){
        // Eğer daha önce hiç belirlenmediyse default false
        if (typeof window.__AIVO_VIDEO_AUDIO_CACHE__ !== "boolean") {
          window.__AIVO_VIDEO_AUDIO_CACHE__ = false;
        }

        // Parent-zincir okuyucu ile gerçek state yakalamayı dene
        var real = (function readReal(){
          // Direct input
          var direct =
            document.querySelector("#videoAudioToggle") ||
            document.querySelector("input[role='switch']") ||
            document.querySelector("input[type='checkbox'][name*='audio']") ||
            document.querySelector("input[type='checkbox'][id*='audio']");
          if (direct && typeof direct.checked === "boolean") return !!direct.checked;

          // "Ses Üretimi" node'u
          var title = Array.prototype.slice.call(document.querySelectorAll("*"))
            .find(function(n){ return (n.textContent || "").trim() === "Ses Üretimi"; });
          if (!title) return null;

          // Parent zincir taraması
          function findSwitchIn(node){
            if (!node) return null;
            return (
              node.querySelector("input[type='checkbox']") ||
              node.querySelector("input[role='switch']") ||
              node.querySelector("[role='switch']") ||
              node.querySelector("[aria-checked]") ||
              node.querySelector("[data-state]") ||
              node.querySelector("[data-checked]") ||
              node.querySelector(".switch, .toggle, .slider, .knob, .pill")
            );
          }

          var cur = title, sw = null;
          for (var i=0; i<10; i++){
            cur = cur.parentElement;
            sw = findSwitchIn(cur);
            if (sw) break;
          }
          if (!sw) return null;

          if (typeof sw.checked === "boolean") return !!sw.checked;

          var aria = sw.getAttribute && sw.getAttribute("aria-checked");
          if (aria === "true") return true;
          if (aria === "false") return false;

          var ds = sw.getAttribute && (sw.getAttribute("data-state") || sw.getAttribute("data-checked"));
          if (ds === "on" || ds === "checked" || ds === "true" || ds === "1") return true;
          if (ds === "off" || ds === "unchecked" || ds === "false" || ds === "0") return false;

          var cls = (sw.className || "").toLowerCase();
          if (cls.indexOf("active") >= 0 || cls.indexOf("on") >= 0 || cls.indexOf("checked") >= 0) return true;

          return null;
        })();

        if (typeof real === "boolean") {
          window.__AIVO_VIDEO_AUDIO_CACHE__ = real;
        } else {
          // Son çare: flip
          window.__AIVO_VIDEO_AUDIO_CACHE__ = !window.__AIVO_VIDEO_AUDIO_CACHE__;
        }
      }, 0);

    } catch(_){}
  }, true);


  // ---------------------------------------------------------
  // 1) Audio state reader (primary)
  // ---------------------------------------------------------
  function isVideoAudioEnabled(){
    // Cache varsa onu kullan
    if (typeof window.__AIVO_VIDEO_AUDIO_CACHE__ === "boolean") {
      return window.__AIVO_VIDEO_AUDIO_CACHE__;
    }

    // Direct input varsa
    var direct =
      document.querySelector("#videoAudioToggle") ||
      document.querySelector("input[role='switch']") ||
      document.querySelector("input[type='checkbox'][name*='audio']") ||
      document.querySelector("input[type='checkbox'][id*='audio']");

    if (direct && typeof direct.checked === "boolean") {
      window.__AIVO_VIDEO_AUDIO_CACHE__ = !!direct.checked;
      return window.__AIVO_VIDEO_AUDIO_CACHE__;
    }

    // "Ses Üretimi" node'u
    var title = Array.prototype.slice.call(document.querySelectorAll("*"))
      .find(function(n){ return (n.textContent || "").trim() === "Ses Üretimi"; });

    if (!title) return false;

    function findSwitchIn(node){
      if (!node) return null;
      return (
        node.querySelector("input[type='checkbox']") ||
        node.querySelector("input[role='switch']") ||
        node.querySelector("[role='switch']") ||
        node.querySelector("[aria-checked]") ||
        node.querySelector("[data-state]") ||
        node.querySelector("[data-checked]") ||
        node.querySelector(".switch, .toggle, .slider, .knob, .pill")
      );
    }

    var cur = title, sw = null;
    for (var i=0; i<10; i++){
      cur = cur.parentElement;
      sw = findSwitchIn(cur);
      if (sw) break;
    }
    if (!sw) return false;

    if (typeof sw.checked === "boolean") {
      window.__AIVO_VIDEO_AUDIO_CACHE__ = !!sw.checked;
      return window.__AIVO_VIDEO_AUDIO_CACHE__;
    }

    var aria = sw.getAttribute && sw.getAttribute("aria-checked");
    if (aria === "true")  { window.__AIVO_VIDEO_AUDIO_CACHE__ = true;  return true; }
    if (aria === "false") { window.__AIVO_VIDEO_AUDIO_CACHE__ = false; return false; }

    var ds = sw.getAttribute && (sw.getAttribute("data-state") || sw.getAttribute("data-checked"));
    if (ds === "on" || ds === "checked" || ds === "true" || ds === "1")  { window.__AIVO_VIDEO_AUDIO_CACHE__ = true;  return true; }
    if (ds === "off" || ds === "unchecked" || ds === "false" || ds === "0") { window.__AIVO_VIDEO_AUDIO_CACHE__ = false; return false; }

    var cls = (sw.className || "").toLowerCase();
    if (cls.indexOf("active") >= 0 || cls.indexOf("on") >= 0 || cls.indexOf("checked") >= 0) {
      window.__AIVO_VIDEO_AUDIO_CACHE__ = true;
      return true;
    }

    window.__AIVO_VIDEO_AUDIO_CACHE__ = false;
    return false;
  }

  function getVideoCost(){
    return isVideoAudioEnabled() ? 14 : 10;
  }

  // ---------------------------------------------------------
  // 2) Capture override (single authority)
  // ---------------------------------------------------------
  document.addEventListener("click", function(e){
    try{
      if (!e || !e.target) return;
      var t = e.target;

      // ✅ doğru buton
      var btn = t.closest ? t.closest("#videoGenerateTextBtn, button[data-generate='video']") : null;
      if (!btn) return;

      // ✅ zinciri kes
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var cost = getVideoCost();

      // Store yoksa çık
      if (!window.AIVO_STORE_V1 || typeof AIVO_STORE_V1.consumeCredits !== "function") return;

     // Kredi tüket
var ok = AIVO_STORE_V1.consumeCredits(cost);

if (!ok) {
  window.toast.error("Yetersiz kredi. Kredi satın alman gerekiyor.");
  return;
}


      // UI refresh
      if (typeof AIVO_STORE_V1.syncCreditsUI === "function") AIVO_STORE_V1.syncCreditsUI();

      console.log("🎬 VIDEO kredi düştü:", cost, "| audio:", isVideoAudioEnabled());
     try { (typeof toast === "function" ? toast : (typeof showToast === "function" ? showToast : null))?.("İşlem başlatıldı. " + cost + " kredi harcandı.", "ok"); } catch(_) {}


      // UI flow (kredi kesmez)
      if (typeof AIVO_RUN_VIDEO_FLOW === "function") AIVO_RUN_VIDEO_FLOW();

    } catch(err){
      console.error("VIDEO SINGLE CREDIT SOURCE ERROR:", err);
    }
  }, true);

  // Debug helpers
  window.__AIVO_VIDEO_AUDIO_ENABLED__ = isVideoAudioEnabled;
  window.__AIVO_VIDEO_COST__ = getVideoCost;

})();
/* =========================================================
   🖼️ COVER — SINGLE CREDIT SOURCE (FINAL)
   ========================================================= */
(function COVER_SINGLE_CREDIT_SOURCE(){

  var COVER_COST = 6; // Kapak kredi maliyeti

  function openPricingSafe(){
    if (typeof openPricingIfPossible === "function") {
      openPricingIfPossible();
      return;
    }
    if (typeof openPricing === "function") {
      openPricing();
      return;
    }
    var p = document.querySelector(".btn-credit-buy, [data-open-pricing], #creditsButton");
    if (p && typeof p.click === "function") {
      p.click();
    }
  }

  document.addEventListener("click", function(e){
    try{
      if (!e || !e.target) return;

      var t = e.target;
      var btn = t.closest ? t.closest("#coverGenerateBtn") : null;
      if (!btn) return;

      // 🔒 Capture override
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!window.AIVO_STORE_V1 || typeof AIVO_STORE_V1.consumeCredits !== "function") {
        console.warn("AIVO_STORE_V1 yok");
        return;
      }

      var ok = AIVO_STORE_V1.consumeCredits(COVER_COST);
if (!ok) {
  return redirectToPricing();
}


      if (typeof AIVO_STORE_V1.syncCreditsUI === "function") {
        AIVO_STORE_V1.syncCreditsUI();
      }

      console.log("🖼️ COVER kredi düştü:", COVER_COST);
   try {
  (typeof toast === "function"
    ? toast
    : (typeof showToast === "function" ? showToast : null)
  )?.("İşlem başlatıldı. " + COVER_COST + " kredi harcandı.", "ok");
} catch (_) {}


      // UI flow (kredi kesmez)
      if (typeof AIVO_RUN_COVER_FLOW === "function") {
        AIVO_RUN_COVER_FLOW();
      }

    } catch(err){
      console.error("COVER CREDIT ERROR:", err);
    }
  }, true);

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
    window.toast.error("Plan bulunamadı");
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

    window.toast.success("Satın alma başarılı (mock)");
  } catch (e) {
    window.toast.error(e?.message || "Satın alma başlatılamadı");
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

    window.toast.success("Satın alma başarılı (mock)");
  } catch (e) {
    window.toast.error(e?.message || "Satın alma başlatılamadı");
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

    // UI: faturalar sayfasına götür
    if (typeof switchPage === "function") {
      switchPage("invoices");
    } else {
      const el = document.querySelector('.page[data-page="invoices"]');
      if (el) {
        document.querySelectorAll(".page").forEach(p => p.classList.remove("is-active"));
        el.classList.add("is-active");
      }
    }
  } catch (err) {
    window.toast.error(err?.message || "Satın alma başlatılamadı");
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
// URL/page alias -> studio'daki gerçek data-page anahtarına çevir
function normalizePageKey(input) {
  const p = String(input || "").toLowerCase().trim();

  // 1) Direkt mevcutsa zaten doğru
  if (p && pageExists(p)) return p;

  // 2) Alias listeleri (senin vitrin linkleri + eski adlar)
  const aliases = {
    music: ["music", "muzik", "müzik", "audio", "song"],
    cover: ["cover", "kapak", "gorsel", "görsel", "visual", "image", "img"],
    video: ["video", "ai-video", "vid"],
    checkout: ["checkout", "odeme", "payment", "paytr-ok", "paytr-fail"]
  };

  // 3) Alias -> hedef key (mevcut olanı seç)
  for (const [target, keys] of Object.entries(aliases)) {
    if (keys.includes(p)) {
      // önce target'ın kendisi var mı?
      if (pageExists(target)) return target;

      // cover için bazı projelerde "visual" sayfa adı olabiliyor
      if (target === "cover" && pageExists("visual")) return "visual";
      if (target === "cover" && pageExists("gorsel")) return "gorsel";
      if (target === "cover" && pageExists("kapak")) return "kapak";
    }
  }

  // 4) En güvenli fallback: music varsa music, yoksa ilk bulunan page
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

      // ✅ KRİTİK: AI Üret buton aktifliğini "video"ya kilitle (music'e geri dönmesin)
      if (typeof setAIProduceActiveByPageLink === "function") setAIProduceActiveByPageLink("video");

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

// MUSIC'e dönünce: varsa pending tab'ı aç, yoksa default "geleneksel"
if (target === "music") {
  const pending = sessionStorage.getItem("aivo_music_tab"); // "ses-kaydi" | "ai-video" | "geleneksel"
  const viewToOpen = pending || "geleneksel";
  if (pending) sessionStorage.removeItem("aivo_music_tab");

  if (typeof switchMusicView === "function") switchMusicView(viewToOpen);
  if (typeof setRightPanelMode === "function") setRightPanelMode("music");
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
     0) MUSIC GENERATE (PROD)
     ----------------------------------------- */
  const genBtn = e.target.closest('[data-generate="music"]');
  if (genBtn) {
    e.preventDefault();
    e.stopPropagation();

    // 🔒 PROD generate çağrısı (consume + job create)
    if (window.AIVO_APP && typeof AIVO_APP.generateMusic === "function") {
      AIVO_APP.generateMusic({
        buttonEl: genBtn,
        email: AIVO_STORE_V1.getUserEmail(),
        prompt: "",              // şimdilik boş
        mode: "instrumental",
        durationSec: 30,
        quality: "standard",
      });
    }
    return; // ⛔ başka click logic çalışmasın
  }

  /* -----------------------------------------
     1) Pricing modal trigger
     ----------------------------------------- */
  const pricingEl = e.target.closest("[data-open-pricing]");
  if (pricingEl) {
    e.preventDefault();
    if (typeof window.openPricing === "function") window.openPricing();
    return;
  }

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
    if (typeof window.openPricing === "function") window.openPricing();
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
     window.toast.error("Plan / fiyat okunamadı. Pricing ekranından tekrar deneyin.");

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
          window.toast.error((data && data.message) || "Bir hata oluştu");

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
       window.toast.error("Ağ hatası (demo).");

        payBtn.dataset.locked = "0";
        setPayState(payBtn, false);
      });
  });
})();
/* =========================================================
   CHECKOUT – STRIPE PAYMENT (FINAL)
   - Backend sadece: "199" | "399" | "899" | "2999" kabul eder
   - Eski resolvePlan() ("pro") sistemini KALDIRIR
   - Satın alma hub: /fiyatlandirma.html  (Studio değil)
   ========================================================= */

(function initCheckoutStripeFlow() {
  if (window.__aivoCheckoutStripeInit) return;
  window.__aivoCheckoutStripeInit = true;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function safeParseInt(x) {
    var s = String(x || "").replace(/[^\d]/g, "");
    var n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function getUrlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch (_) {
      return "";
    }
  }

  function getStoreSelectedPack() {
    try {
      // ✅ store.js public API: getSelectedPack()
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getSelectedPack === "function") {
        var p = window.AIVO_STORE_V1.getSelectedPack();
        return p ? String(p).trim() : "";
      }
    } catch (e) {}
    return "";
  }

  // UI / Store / URL’den "199|399|899|2999" üret
  function resolvePackCode() {
    var ALLOWED = ["199", "399", "899", "2999"];

    // 1) Store
    var p = getStoreSelectedPack();
    p = String(p || "").trim();
    if (ALLOWED.indexOf(p) !== -1) return p;

    // 2) UI fiyat (#checkoutPrice)
    var priceEl = qs("#checkoutPrice");
    var uiPrice = priceEl ? safeParseInt(priceEl.textContent) : 0;
    if (uiPrice && ALLOWED.indexOf(String(uiPrice)) !== -1) return String(uiPrice);

    // 3) URL price (?price=399)
    var urlPrice = safeParseInt(getUrlParam("price"));
    if (urlPrice && ALLOWED.indexOf(String(urlPrice)) !== -1) return String(urlPrice);

    return ""; // bulunamadı
  }

  // Tek otorite: window.startStripeCheckout
  window.startStripeCheckout = async function startStripeCheckout(packCode) {
    var ALLOWED = ["199", "399", "899", "2999"];
    packCode = String(packCode || "").trim();

    if (ALLOWED.indexOf(packCode) === -1) {
      throw new Error("INVALID_PACK:" + packCode);
    }

    // ✅ success/cancel URL'lerini FRONTEND belirlemez.
    // ✅ Tek otorite BACKEND’dir (create-checkout-session içinde).
    // (Satın alma hub: /fiyatlandirma.html olduğundan backend dönüşleri de ideally oraya olmalı.)

    var r = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: packCode,
        pack: packCode,
        price: packCode
      })
    });

    var raw = await r.text();
    var data = null;
    try { data = JSON.parse(raw); } catch (_) {}

    if (!r.ok || !data || !data.url) {
      var msg =
        (data && (data.error || data.message)) ? (data.error || data.message) :
    ("HTTP " + r.status + " RAW=" + raw.slice(0, 160));
      throw new Error("STRIPE_INIT_FAILED: " + msg);
    }

    window.location.href = data.url;
  };

  // Checkout butonu
  var payBtn = qs("[data-checkout-pay]") || qs("#payBtn");
  if (!payBtn) return;

  // Eski handler’ları temizle
  var fresh = payBtn.cloneNode(true);
  payBtn.parentNode.replaceChild(fresh, payBtn);
  payBtn = fresh;

  function setPayState(loading) {
    if (loading) {
      payBtn.dataset.prevText = payBtn.textContent || "Ödemeye Geç";
      payBtn.textContent = "İşleniyor...";
      payBtn.disabled = true;
    } else {
      payBtn.textContent = payBtn.dataset.prevText || "Ödemeye Geç";
      payBtn.disabled = false;
    }
  }

  payBtn.addEventListener("click", async function () {
    if (payBtn.dataset.locked === "1") return;
    payBtn.dataset.locked = "1";

    try {
      setPayState(true);

      // ✅ Global switch’ler:
      // - PayTR aktifse Stripe çalışmaz
      // - Stripe kapalıysa (geçiş döneminde) Stripe çalışmaz
      var paytrEnabled  = (localStorage.getItem("AIVO_PAYTR_ENABLED") === "1");
      var stripeEnabled = (localStorage.getItem("AIVO_STRIPE_ENABLED") !== "0"); // default ON

      if (paytrEnabled) throw new Error("PAYTR_ACTIVE");
      if (!stripeEnabled) throw new Error("STRIPE_DISABLED");

      var pack = resolvePackCode();
      if (!pack) throw new Error("PACK_NOT_RESOLVED");

      console.log("[Checkout] Stripe pack =", pack);
      await window.startStripeCheckout(pack);

    } catch (e) {
      console.error("[Checkout] failed:", e);
     window.toast.error("Checkout başarısız: " + (e && e.message ? e.message : "Bilinmeyen hata"));

      setPayState(false);
      payBtn.dataset.locked = "0";
    }
  });
})();

// =========================================================
// STRIPE CHECKOUT START (helper) — AIVO
// =========================================================
async function startStripeCheckout(plan) {
  try {
const successUrl = `${location.origin}/studio?payment=success&session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl  = `${location.origin}/studio?payment=cancel`;





    const r = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, successUrl, cancelUrl }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data || !data.url) {
      console.error("[StripeCheckout] failed:", r.status, data);
      window.toast.error("Checkout başarısız: " + (data.error || data.message || ("HTTP " + r.status)));

      return;
    }

    // Stripe'a git
    window.location.href = data.url;
  } catch (e) {
    console.error("[StripeCheckout] error:", e);
   window.toast.error("Checkout başlatılamadı. Console'u kontrol et.");

  }
}
// =========================================================
// STRIPE CHECKOUT START (GLOBAL) – AIVO
// =========================================================
window.startStripeCheckout = async function (plan) {
  try {
    console.log("[Stripe] startStripeCheckout called with plan:", plan);

   const successUrl = `${location.origin}/studio.html`;
const cancelUrl  = `${location.origin}/studio.html`;


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
      window.toast.error("Ödeme başlatılamadı.");

      return;
    }

    // Stripe'a yönlendir
    window.location.href = data.url;

  } catch (err) {
    console.error("[Stripe] Fatal error:", err);
    window.toast.error("Ödeme başlatılamadı.");

  }
};

// =========================================================
// STRIPE CHECKOUT START (helper) — AIVO (FINAL)
// - session_id'yi localStorage'a yazar (finalizer bunu okur)
// =========================================================
async function startStripeCheckout(planOrPack) {
  try {
    // Senin backend normalize ediyor: plan/pack/price -> 199/399/899/2999 gibi
    // Bu yüzden burada "2999" gibi pack göndermek en temiz yol.
    const pack = String(planOrPack || "").trim();

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack: pack }) // ✅ kritik: pack gönder
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok || !data || data.ok !== true || !data.url) {
      console.error("[Stripe] create-checkout-session failed:", res.status, data);
      throw new Error((data && data.error) ? data.error : ("HTTP_" + res.status));
    }

    // ✅ KRİTİK: session id'yi kaydet (finalizer buradan okuyor)
    // Not: backend aşağıda session_id döndürecek şekilde güncellenecek.
    if (data.session_id) {
      localStorage.setItem("aivo_pending_stripe_session", data.session_id);
    } else {
      // session_id yoksa bile en azından debug için yaz
      console.warn("[Stripe] session_id missing in response. Backend must return it.");
    }

    // Stripe Checkout'a yönlendir
    window.location.href = data.url;

  } catch (err) {
    console.error("[Stripe] startStripeCheckout error:", err);
    if (typeof showToast === "function") showToast("Checkout başlatılamadı.", "error");
    throw err;
  }
}



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
   SPEND (KREDİ HARCATMA) — delegated click (SAFE) — FINAL
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
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.syncCreditsUI === "function") {
        window.AIVO_STORE_V1.syncCreditsUI();
      }
    } catch (e) {}
  }

  function openPricingIfPossible() {
    try {
      var btn = document.querySelector("[data-open-pricing]");
      if (btn) { btn.click(); return true; }

      var cb = document.getElementById("creditsButton");
      if (cb) { cb.click(); return true; }

      if (typeof window.openPricingModal === "function") { window.openPricingModal(); return true; }
    } catch (e) {}
    return false;
  }

  function getEffectiveCost(action, baseCost) {
    var cost = Math.max(0, toInt(baseCost));

    // Örnek: music’te “Ses Üretimi kapalıysa %33 daha az”
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
try { e.preventDefault(); } catch (_) {}

var action = (btn.getAttribute("data-generate") || "").trim();
var baseCost = btn.getAttribute("data-credit-cost");
var cost = getEffectiveCost(action, baseCost);

var credits = readCreditsSafe();

if (credits < cost) {
  window.toast.error("Yetersiz kredi. Kredi satın alman gerekiyor.");
  redirectToPricing();
  return;
}

// Local düş (şimdilik); server consume ile birleştireceğiz
writeCreditsSafe(credits - cost);
callCreditsUIRefresh();

window.toast.success("İşlem başlatıldı. " + cost + " kredi harcandı.");

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
        window.toast.error("PayTR başlatılamadı. Console’u kontrol et.");

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
/* Premium color ONLY for legacy "Yetersiz kredi" ERROR toasts */
(function premiumNoCreditToast(){
  const PREMIUM_BG = "linear-gradient(90deg, rgba(122,92,255,.92), rgba(255,122,179,.86))";
  const PREMIUM_C  = "rgba(255,255,255,.96)";
  const PREMIUM_B  = "1px solid rgba(255,255,255,.18)";
  const PREMIUM_S  = "0 14px 40px rgba(0,0,0,.45)";

  function isLegacyErrorToast(el){
    if (!el || el.nodeType !== 1) return false;
    const text = (el.innerText || "").trim();
    if (!text.includes("Yetersiz kredi")) return false;

    // info/success toast'lara dokunma
    if (el.classList.contains("info") || el.classList.contains("success")) return false;

    // daha önce boyandıysa tekrar etme
    if (el.dataset.premiumPainted === "1") return false;

    return true;
  }

  function paint(el){
    if (!isLegacyErrorToast(el)) return;
    el.dataset.premiumPainted = "1";
    el.style.background = PREMIUM_BG;
    el.style.color = PREMIUM_C;
    el.style.border = PREMIUM_B;
    el.style.boxShadow = PREMIUM_S;
  }

  // mevcutları boya
  document.querySelectorAll(".toast, .aivo-toast, [role='alert']").forEach(paint);

  // sonradan eklenenleri yakala
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes?.forEach((n) => {
        if (n.nodeType === 1) {
          paint(n);
          n.querySelectorAll?.(".toast, .aivo-toast, [role='alert']").forEach(paint);
        }
      });
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
})();

/* =========================================================
   📄 EVRAKLARIM (INVOICES) — RENDER BLOĞU (TEK BLOK)
   - Kaynak: window.AIVO_STORE_V1 (listInvoices / getInvoices fallback)
   - Render hedefi: #invoicesList (yoksa #invoicesRoot içine basar)
   ========================================================= */
(function invoicesPageInit() {
  "use strict";

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function readInvoices() {
    try {
      if (window.AIVO_STORE_V1) {
        // Yeni/önerilen API
        if (typeof window.AIVO_STORE_V1.listInvoices === "function") {
          return window.AIVO_STORE_V1.listInvoices() || [];
        }
        // Bazı örneklerde geçebilir
        if (typeof window.AIVO_STORE_V1.getInvoices === "function") {
          return window.AIVO_STORE_V1.getInvoices() || [];
        }
        // Store içinde doğrudan tutuyorsan
        if (typeof window.AIVO_STORE_V1.read === "function") {
          var s = window.AIVO_STORE_V1.read();
          if (s && Array.isArray(s.invoices)) return s.invoices;
        }
      }
    } catch (_) {}

    // Son çare: legacy key
    try {
      var raw = localStorage.getItem("aivo_invoices");
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function moneyTRY(n) {
    try {
      var v = Number(n || 0);
      return v.toLocaleString("tr-TR") + " ₺";
    } catch (_) {
      return (n || 0) + " ₺";
    }
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso || "");
      return d.toLocaleString("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return String(iso || "");
    }
  }

  function render() {
    // 1) Sayfa var mı?
    var page = qs('.page[data-page="invoices"]');
    if (!page) return;

    // 2) Hedef konteyner:
    // Tercih: <div id="invoicesList"></div>
    // Fallback: <div id="invoicesRoot"></div>
    var listEl = qs("#invoicesList", page) || qs("#invoicesRoot", page);
    if (!listEl) {
      // Hiç yoksa page içine otomatik oluştur
      listEl = document.createElement("div");
      listEl.id = "invoicesList";
      page.appendChild(listEl);
    }

    var invoices = readInvoices();

    // 3) Boş durum
    if (!invoices.length) {
      listEl.innerHTML =
        '<div class="empty-state" style="padding:18px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.03)">' +
          '<div style="font-weight:700;margin-bottom:6px">Henüz faturan yok</div>' +
          '<div style="opacity:.75">Kredi satın aldığında faturaların burada görünecek.</div>' +
        '</div>';
      return;
    }

    // 4) Liste bas
    var html = '';
    html += '<div class="inv-grid" style="display:grid;gap:12px">';

    invoices.forEach(function (inv) {
      // Normalize: farklı şemaları da yakala
      var id = inv.id || inv.orderId || inv.order_id || inv.ref || ("inv_" + Math.random().toString(16).slice(2));
      var createdAt = inv.createdAt || inv.created_at || inv.date || "";
      var title = inv.title || inv.planCode || inv.pack || "Kredi Satın Alımı";
      var amount = inv.amountTRY ?? inv.amountTry ?? inv.amount ?? 0;
      var credits = inv.credits ?? inv.creditsAdded ?? inv.credit ?? 0;
      var provider = inv.provider || "—";
      var status = inv.status || "paid";

      html +=
        '<div class="inv-card" style="padding:14px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03)">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
            '<div>' +
              '<div style="font-weight:800;margin-bottom:4px">' + String(title) + '</div>' +
              '<div style="opacity:.70;font-size:12px">ID: ' + String(id) + '</div>' +
              (createdAt ? '<div style="opacity:.70;font-size:12px;margin-top:2px">' + fmtDate(createdAt) + '</div>' : '') +
            '</div>' +
            '<div style="text-align:right">' +
              '<div style="font-weight:800">' + moneyTRY(amount) + '</div>' +
              '<div style="opacity:.80;font-size:12px;margin-top:2px">+' + String(credits) + ' kredi</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px">' +
            '<div style="opacity:.70;font-size:12px">Sağlayıcı: ' + String(provider) + '</div>' +
            '<div style="font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)">' +
              String(status).toUpperCase() +
            '</div>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
    listEl.innerHTML = html;
  }

  // Sayfa açıldığında da, sayfa değişince de render et
  function bind() {
    render();

    // switchPage varsa "invoices"e geçince yeniden render
    var _switch = window.switchPage;
    if (typeof _switch === "function" && !_switch.__aivoInvoicesWrapped) {
      function wrappedSwitchPage(target) {
        var r = _switch.apply(this, arguments);
        try { if (target === "invoices") render(); } catch (_) {}
        return r;
      }
      wrappedSwitchPage.__aivoInvoicesWrapped = true;
      // Orijinal referansı koru
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
    if (p.includes("paytr")) return "PayTR";
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

// =========================================================
// OVERRIDE: MUSIC GENERATE → APP LAYER (PROD)
// =========================================================
document.addEventListener("click", function (e) {
  const btn = e.target.closest("#musicGenerateBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
    console.warn("[AIVO] generateMusic not ready");
    return;
  }

  window.AIVO_APP.generateMusic({
    buttonEl: btn,
    email: window.AIVO_STORE_V1?.getEmail?.(),
    prompt: document.querySelector("[name='prompt']")?.value || "",
    mode: "instrumental",
    durationSec: 30
  });
});
document.addEventListener("click", function (e) {
  var btn = e.target.closest("[data-generate]");
  if (!btn) return;

  e.preventDefault();

  var action = btn.getAttribute("data-generate");
  if (!action) return;

  console.log("[GENERATE]", action);

  if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
    var jid = action + "--" + Date.now();
    window.AIVO_JOBS.add({
      job_id: jid,
      type: action,
      status: "queued"
    });
  }
});



}); // ✅ SADECE 1 TANE KAPANIŞ — DOMContentLoaded
