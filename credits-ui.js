console.warn("[AIVO] credits-ui.js DISABLED (FAZ-2)");
return;

/* =========================================================
   AIVO — CREDITS UI SYNC (HARDENED / FINAL)
   - Waits for AIVO_STORE_V1 to be ready (no false "0")
   - Updates: #topCreditCount AND #creditCount (if present)
   - Listens: aivo:credits-changed
   ========================================================= */

(function () {
  "use strict";

  function getStoreCreditsSafe() {
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        return Number(window.AIVO_STORE_V1.getCredits() || 0);
      }
    } catch (_) {}
    return null; // ✅ store hazır değil
  }

  function writeCreditsToTargets(v) {
    var n = String(Number(v) || 0);
    var ok = false;

    var el1 = document.getElementById("topCreditCount");
    if (el1) { el1.textContent = n; ok = true; }

    var el2 = document.getElementById("creditCount");
    if (el2) { el2.textContent = n; ok = true; }

    return ok;
  }

  function syncOnce() {
    var c = getStoreCreditsSafe();
    if (typeof c === "number") return writeCreditsToTargets(c);
    return false;
  }

  function waitForStoreAndSync() {
    // ✅ 2 saniye boyunca store'ı bekle (20 x 100ms)
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (syncOnce()) { clearInterval(t); return; }
      if (tries >= 20) { clearInterval(t); /* store gelmediyse sessiz kal */ }
    }, 100);
  }

  function boot() {
    // 1) DOM hazır olunca sync dene
    if (!syncOnce()) {
      // store yoksa bekle
      waitForStoreAndSync();
    }

    // 2) Event ile anlık güncelle
    window.addEventListener("aivo:credits-changed", function (e) {
      var c = e && e.detail ? e.detail.credits : null;
      if (typeof c === "number") writeCreditsToTargets(c);
      else syncOnce();
    });

    // 3) Sayfa görünür olunca tekrar sync (Safari tab discard sonrası)
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) syncOnce();
    });
  }

  // dışarıdan manuel test için
  window.AIVO_SYNC_CREDITS_UI = function () {
    if (!syncOnce()) waitForStoreAndSync();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
