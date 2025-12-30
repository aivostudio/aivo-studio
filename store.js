/* AIVO STORE v1 — isolated (SINGLE SOURCE OF TRUTH) */
(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  var KEY = "aivo_store_v1";

  function toInt(v) {
    v = Number(v);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  /* ================= CORE READ / WRITE ================= */

  function read() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return { v: 1, credits: 0 };

    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object") return { v: 1, credits: 0 };
      s.credits = toInt(s.credits);
      return s;
    } catch {
      return { v: 1, credits: 0 };
    }
  }

  function write(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  /* ================= MIGRATION (LEGACY) ================= */

  function migrateOnce() {
    var flag = "aivo_store_v1_migrated";
    if (localStorage.getItem(flag) === "1") return;

    var legacy = localStorage.getItem("aivo_credits");
    if (legacy !== null) {
      var s = read();
      if (!s.credits) {
        s.credits = toInt(legacy);
        write(s);
      }
    }
    localStorage.setItem(flag, "1");
  }

  /* ================= EVENTS ================= */

  function emitCreditsChanged(credits) {
    try {
      window.dispatchEvent(
        new CustomEvent("aivo:credits-changed", {
          detail: { credits: toInt(credits) }
        })
      );
    } catch (_) {}
  }

  /* ================= PUBLIC API ================= */

  function getCredits() {
    return read().credits;
  }

  function setCredits(v) {
    var s = read();
    s.credits = toInt(v);
    write(s);
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function addCredits(delta) {
    delta = toInt(delta);
    var s = read();
    s.credits = toInt(s.credits + delta);
    write(s);
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function consumeCredits(delta) {
    delta = toInt(delta);
    var s = read();

    if (s.credits < delta) return false;

    s.credits = toInt(s.credits - delta);
    write(s);
    emitCreditsChanged(s.credits);
    return true;
  }

  function syncCreditsUI() {
    emitCreditsChanged(getCredits());
  }

  /* ================= INIT ================= */

  migrateOnce();

  /* ================= EXPORT ================= */

  window.AIVO_STORE_V1 = {
    getCredits: getCredits,
    setCredits: setCredits,
    addCredits: addCredits,
    consumeCredits: consumeCredits,
    syncCreditsUI: syncCreditsUI
  };
})();
/* =========================================================
   AIVO — CREDIT PACKS + PURCHASE APPLY (TEK OTORİTE)
   ========================================================= */
(function () {
  const PACKS = {
    "199":  { price: 199,  credits: 25  },
    "399":  { price: 399,  credits: 60  },
    "899":  { price: 899,  credits: 150 },
    "2999": { price: 2999, credits: 500 }
  };

  function safeInt(v, d=0){ v = parseInt(String(v||"").replace(/[^\d]/g,""),10); return Number.isFinite(v)?v:d; }

  // Store mevcutsa kullan, yoksa minimal oluştur
  const S = (window.AIVO_STORE_V1 = window.AIVO_STORE_V1 || {});
  if (typeof S.getCredits !== "function") {
    S.getCredits = function(){
      return safeInt(localStorage.getItem("AIVO_CREDITS") || localStorage.getItem("credits") || 0, 0);
    };
  }
  if (typeof S.setCredits !== "function") {
    S.setCredits = function(n){
      n = Math.max(0, safeInt(n, 0));
      localStorage.setItem("AIVO_CREDITS", String(n));
      // UI yenileme varsa tetikle
      try { window.callCreditsUIRefresh && window.callCreditsUIRefresh(); } catch(e){}
      try { document.dispatchEvent(new CustomEvent("aivo:credits:update", { detail:{ credits:n } })); } catch(e){}
      return n;
    };
  }
  S.addCredits = function(delta){
    const cur = S.getCredits();
    return S.setCredits(cur + safeInt(delta,0));
  };

  // ✅ Checkout başarıdan çağıracağımız fonksiyon
  S.applyPurchase = function(payload){
    payload = payload || {};
    const orderId = String(payload.order_id || payload.orderId || payload.oid || "").trim();
    const packKey = String(payload.pack || payload.pack_key || payload.price || "").trim(); // "199" gibi
    const creditsFromServer = safeInt(payload.credits, 0);

    // 1) credits server’dan geldiyse onu baz al (ileride PayTR/iyzico)
    let add = creditsFromServer;

    // 2) yoksa pack mapping’den hesapla
    if (!add) {
      const p = PACKS[packKey];
      if (!p) return { ok:false, reason:"unknown_pack", packKey };
      add = p.credits;
    }

    // 3) çifte yazmayı engelle (order_id varsa)
    if (orderId) {
      const lockKey = "AIVO_PURCHASE_APPLIED_" + orderId;
      if (localStorage.getItem(lockKey) === "1") {
        return { ok:false, reason:"already_applied", orderId };
      }
      localStorage.setItem(lockKey, "1");
    }

    const after = S.addCredits(add);
    return { ok:true, added:add, credits:after, orderId:orderId || null };
  };
})();
