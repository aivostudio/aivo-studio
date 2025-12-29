// credits-ui.js (ROBUST) — store event + DOM sonradan gelse bile
(function () {
  function readCredits() {
    try {
      if (window.AIVO_STORE_V1?.getCredits) return Number(window.AIVO_STORE_V1.getCredits() || 0) || 0;
    } catch (_) {}
    try { return Number(localStorage.getItem("aivo_credits") || 0) || 0; } catch (_) {}
    return 0;
  }

  function write(credits) {
    var el = document.getElementById("topCreditCount") || document.getElementById("creditCount");
    if (!el) return false;
    el.textContent = String(Number(credits) || 0);
    return true;
  }

  function sync() {
    return write(readCredits());
  }

  function boot() {
    // 1) ilk sync
    if (!sync()) {
      // 2) DOM sonradan gelirse yakala
      var obs = new MutationObserver(function () {
        if (sync()) obs.disconnect();
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(function () { try { obs.disconnect(); } catch (_) {} }, 10000);
    }

    // 3) store event dinle
    window.addEventListener("aivo:credits-changed", function (e) {
      var c = e?.detail?.credits;
      if (typeof c === "number") write(c);
      else sync();
    });

    // 4) dışarıdan manuel tetik
    window.AIVO_SYNC_CREDITS_UI = sync;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
