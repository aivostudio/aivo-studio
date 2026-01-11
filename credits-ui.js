/* =========================================================
   credits-ui.js — AIVO CREDITS UI SYNC (SAFE)
   - No top-level return (Safari/strict safe)
   - Defines window.syncCreditsUI()
   - Reads credits from AIVO_STORE_V1 if exists
   - Optionally pulls from /api/credits/get?email=...
   ========================================================= */
(function () {
  "use strict";

  // ✅ Hard guard (aynı dosya 2 kez yüklenirse tekrar init etme)
  if (window.__AIVO_CREDITS_UI_LOADED__) return;
  window.__AIVO_CREDITS_UI_LOADED__ = true;

  function $(sel) {
    try { return document.querySelector(sel); } catch (_) { return null; }
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = String(txt == null ? "" : txt);
  }

  // UI hedefleri (senin projede mevcut olanlar)
  function updateBadges(credits) {
    credits = Number(credits);
    if (!Number.isFinite(credits) || credits < 0) credits = 0;
    credits = Math.floor(credits);

    // Topbar credit pill (vitrin/kurumsal/fiyat/studio)
    setText($("#topCreditCount"), credits);
    setText($("#creditCount"), credits);

    // Studio içi farklı badge'ler varsa:
    setText($("#studioCreditCount"), credits);
  }

  function getEmail() {
    // Senin mevcut auth yapına göre birkaç kaynak deniyoruz
    try {
      var el = $("#topUserEmail");
      if (el && el.textContent && el.textContent.includes("@")) return el.textContent.trim();
    } catch (_) {}

    try {
      var u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      if (u && u.email) return String(u.email).trim();
    } catch (_) {}

    try {
      var s = JSON.parse(localStorage.getItem("AIVO_AUTH") || "null");
      if (s && s.email) return String(s.email).trim();
    } catch (_) {}

    return "";
  }

  async function pullFromServerAndSet() {
    var email = getEmail();
    if (!email) return null;

    try {
      var res = await fetch("/api/credits/get?email=" + encodeURIComponent(email), {
        method: "GET",
        headers: { "accept": "application/json" },
        cache: "no-store"
      });

      if (!res.ok) return null;

      var data = await res.json().catch(function () { return null; });
      if (!data) return null;

      var credits = Number(data.credits);
      if (!Number.isFinite(credits) || credits < 0) credits = 0;
      credits = Math.floor(credits);

      // Server source-of-truth ise store’u güncelle
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
        window.AIVO_STORE_V1.setCredits(credits);
      }

      updateBadges(credits);
      return credits;
    } catch (_) {
      return null;
    }
  }

  // ✅ Global: store.js içinden çağrılabilir
  window.syncCreditsUI = async function syncCreditsUI() {
    // 1) Store varsa önce onu bas
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        updateBadges(window.AIVO_STORE_V1.getCredits());
      }
    } catch (_) {}

    // 2) Sonra server’dan çekmeyi dene (opsiyonel)
    await pullFromServerAndSet();
  };

  // İlk açılışta bir kere çalıştır
  try { window.syncCreditsUI(); } catch (_) {}

  // credits değişince UI güncelle
  window.addEventListener("aivo:credits-changed", function (e) {
    try {
      var c = e && e.detail ? e.detail.credits : null;
      updateBadges(c);
    } catch (_) {}
  });
})();
