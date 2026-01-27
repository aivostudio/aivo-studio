/* =========================================================
   credits-ui.js — AIVO CREDITS UI (UI-ONLY / SINGLE-RESPONSIBILITY)
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

  // UI yoksa tamamen pasif
  var HAS_CREDITS_DOM =
    $("#topCreditCount") ||
    $("#creditCount") ||
    $("#studioCreditCount");

  if (!HAS_CREDITS_DOM) return;

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

  // UI tarafı sadece body dataset’e bakar
  function isLoggedIn() {
    try {
      if (document.body && document.body.dataset) {
        var v = document.body.dataset.userLoggedIn;
        if (v === "1") return true;
        if (v === "0") return false;
        return null;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  async function fetchCredits(force) {
    var logged = isLoggedIn();
    if (logged !== true) {
      if (logged === false) resetUI();
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

    var logged = isLoggedIn();
    if (logged !== true) {
      if (logged === false) resetUI();
      return;
    }

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
