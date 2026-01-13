/* =========================================================
   credits-ui.js — AIVO CREDITS UI (FINAL / GUARDED)
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_CREDITS_UI__) return;
  window.__AIVO_CREDITS_UI__ = true;

  var TTL_MS = 15000;
  var lastFetchAt = 0;
  var inFlight = null;

  function $(sel) {
    try { return document.querySelector(sel); } catch (_) { return null; }
  }

  function setText(el, v) {
    if (!el) return;
    el.textContent = String(v == null ? "—" : v);
  }

  function clamp(v) {
    var n = Number(v);
    if (!Number.isFinite(n) || n < 0) n = 0;
    return Math.floor(n);
  }

  function updateUI(credits) {
    var c = clamp(credits);
    setText($("#topCreditCount"), c);
    setText($("#creditCount"), c);
    setText($("#studioCreditCount"), c);
  }

  function resetUI() {
    setText($("#topCreditCount"), "—");
    setText($("#creditCount"), "—");
    setText($("#studioCreditCount"), "—");
  }

  function isLoggedIn() {
    return !!document.querySelector("[data-user-logged-in]");
  }

  async function fetchCredits(force) {
    // 🔒 LOGIN GUARD — guest ise asla çağırma
    if (!isLoggedIn()) {
      resetUI();
      return null;
    }

    var now = Date.now();
    if (!force && (now - lastFetchAt) < TTL_MS) return null;
    if (!force && inFlight) return inFlight;

    inFlight = (async function () {
      try {
        var res = await fetch("/api/credits/get", {
          method: "GET",
          credentials: "include",
          headers: { "Accept": "application/json" },
          cache: "no-store"
        });

        lastFetchAt = Date.now();

        if (res.status === 401) {
          resetUI();
          return null;
        }

        if (!res.ok) return null;

        var data = await res.json().catch(function () { return null; });
        if (!data) return null;

        var credits =
          data.credits ??
          (data.data && data.data.credits) ??
          null;

        if (credits == null) return null;

        try {
          if (window.AIVO_STORE_V1 &&
              typeof window.AIVO_STORE_V1.setCredits === "function") {
            window.AIVO_STORE_V1.setCredits(clamp(credits));
          }
        } catch (_) {}

        updateUI(credits);
        return credits;
      } catch (_) {
        lastFetchAt = Date.now();
        return null;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  window.syncCreditsUI = function (opts) {
    opts = opts || {};
    var force = !!opts.force;

    try {
      if (window.AIVO_STORE_V1 &&
          typeof window.AIVO_STORE_V1.getCredits === "function") {
        updateUI(window.AIVO_STORE_V1.getCredits());
      }
    } catch (_) {}

    fetchCredits(force);
  };

  function onReady(fn) {
    if (document.readyState === "complete" ||
        document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    }
  }

  onReady(function () {
    window.syncCreditsUI({ force: true });
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      window.syncCreditsUI({ force: true });
    }
  });

})();
