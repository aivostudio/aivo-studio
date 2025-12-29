/* =========================================================
   AIVO — CREDITS UI SYNC (FINAL)
   Listens: aivo:credits-changed
   Target: #topCreditCount
   ========================================================= */

(function () {
  "use strict";

  function readCredits() {
    try {
      if (window.AIVO_STORE_V1?.getCredits) {
        return Number(window.AIVO_STORE_V1.getCredits() || 0);
      }
    } catch (_) {}
    return 0;
  }

  function writeCredits(v) {
    var el = document.getElementById("topCreditCount");
    if (!el) return false;
    el.textContent = String(Number(v) || 0);
    return true;
  }

  function syncCredits() {
    return writeCredits(readCredits());
  }

  function boot() {
    // 1) İlk yükleme
    if (!syncCredits()) {
      // 2) DOM geç gelirse yakala
      var obs = new MutationObserver(function () {
        if (syncCredits()) obs.disconnect();
      });

      obs.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      setTimeout(function () {
        try { obs.disconnect(); } catch (_) {}
      }, 10000);
    }

    // 3) Store event
    window.addEventListener("aivo:credits-changed", function (e) {
      var c = e?.detail?.credits;
      if (typeof c === "number") writeCredits(c);
      else syncCredits();
    });
  }

  // dışarıdan manuel test için
  window.AIVO_SYNC_CREDITS_UI = syncCredits;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
