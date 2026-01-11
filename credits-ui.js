/* =========================================================
   credits-ui.js — AIVO CREDITS UI SYNC (V4 FINAL / SINGLE-SOURCE)
   - No request spam (TTL + in-flight)
   - NEVER calls /api/credits/get without email (fixes 400 root cause)
   - Email-safe fallback (DOM + multiple LS keys)
   - Store + UI loop safe
   - Stripe / tab focus friendly
   - SINGLE lifecycle trigger (no duplicate startup calls)
   ========================================================= */
(function () {
  "use strict";

  // ---------------------------------
  // HARD GUARD
  // ---------------------------------
  if (window.__AIVO_CREDITS_UI_LOADED__) return;
  window.__AIVO_CREDITS_UI_LOADED__ = true;

  function $(sel) {
    try { return document.querySelector(sel); } catch (_) { return null; }
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = String(txt == null ? "" : txt);
  }

  function clampCredits(v) {
    var n = Number(v);
    if (!Number.isFinite(n) || n < 0) n = 0;
    return Math.floor(n);
  }

  // ---------------------------------
  // UI
  // ---------------------------------
  function updateBadges(credits) {
    var c = clampCredits(credits);
    setText($("#topCreditCount"), c);
    setText($("#creditCount"), c);
    setText($("#studioCreditCount"), c);
  }

  // ---------------------------------
  // EMAIL (SAFE + MULTI SOURCE)
  // ---------------------------------
  function getEmailSafe() {
    // 1) DOM (if exists on some pages)
    try {
      var el = $("#topUserEmail");
      if (el && el.textContent && el.textContent.includes("@")) {
        return el.textContent.trim().toLowerCase();
      }
    } catch (_) {}

    // 2) Your observed key
    try {
      var e0 = localStorage.getItem("aivo_user_email");
      if (e0 && String(e0).includes("@")) return String(e0).trim().toLowerCase();
    } catch (_) {}

    // 3) Known user objects
    try {
      var u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      if (u && u.email) return String(u.email).trim().toLowerCase();
    } catch (_) {}

    try {
      var a = JSON.parse(localStorage.getItem("AIVO_AUTH") || "null");
      if (a && a.email) return String(a.email).trim().toLowerCase();
    } catch (_) {}

    // 4) Optional global user (if any)
    try {
      var gu = window.AIVO_USER || window.__AIVO_USER__ || null;
      if (gu && gu.email) return String(gu.email).trim().toLowerCase();
    } catch (_) {}

    return null;
  }

  // ---------------------------------
  // REQUEST GUARDS
  // ---------------------------------
  var TTL_MS = 15000; // 15s
  var lastFetchAt = 0;
  var inFlight = null;

  function parseCredits(data) {
    if (!data) return null;
    if (data.credits != null) return clampCredits(data.credits);
    if (data.balance != null) return clampCredits(data.balance);
    if (data.data && data.data.credits != null) return clampCredits(data.data.credits);
    if (data.data && data.data.balance != null) return clampCredits(data.data.balance);
    return null;
  }

  async function fetchOnce(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
      cache: "no-store",
      credentials: "include"
    });

    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json().catch(function () { return null; }) };
  }

  // ---------------------------------
  // SERVER PULL (ROOT FIX: ALWAYS EMAIL)
  // ---------------------------------
  async function pullFromServer(opts) {
    opts = opts || {};
    var force = !!opts.force;

    var now = Date.now();
    if (!force && (now - lastFetchAt) < TTL_MS) return null;
    if (!force && inFlight) return inFlight;

    inFlight = (async function () {
      try {
        // ✅ ROOT FIX:
        // Backend 400 root cause is calling /api/credits/get WITHOUT email.
        // So we ALWAYS require email before calling server.
        var email = getEmailSafe();
        if (!email) {
          lastFetchAt = Date.now();
          return null;
        }

        var r = await fetchOnce("/api/credits/get?email=" + encodeURIComponent(email));
        var credits = r.ok ? parseCredits(r.data) : null;

        if (credits == null) {
          lastFetchAt = Date.now();
          return null;
        }

        // STORE → UI (loop safe)
        try {
          if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
            window.AIVO_STORE_V1.setCredits(credits);
          }
        } catch (_) {}

        updateBadges(credits);
        lastFetchAt = Date.now();
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

  // ---------------------------------
  // GLOBAL API (single entry + debounce)
  // ---------------------------------
  var debounceTimer = null;

  function debouncedSync() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      try { window.syncCreditsUI({ force: false }); } catch (_) {}
    }, 120);
  }

  function onReady(fn) {
    try {
      if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(fn, 0);
      } else {
        document.addEventListener("DOMContentLoaded", fn, { once: true });
      }
    } catch (_) {
      try { fn(); } catch (_) {}
    }
  }

  window.syncCreditsUI = async function (opts) {
    opts = opts || {};
    var force = !!opts.force;

    // Store → UI first
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        updateBadges(window.AIVO_STORE_V1.getCredits());
      }
    } catch (_) {}

    await pullFromServer({ force: force });
  };

  // ---------------------------------
  // LIFECYCLE (ONLY ONE initial trigger)
  // ---------------------------------
  onReady(function () {
    // initial: force once (TTL + inFlight still prevents spam)
    try { window.syncCreditsUI({ force: true }); } catch (_) {}
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      try { window.syncCreditsUI({ force: true }); } catch (_) {}
    }
  });

  window.addEventListener("aivo:credits-changed", function (e) {
    try {
      updateBadges(e && e.detail ? e.detail.credits : null);
      debouncedSync();
    } catch (_) {}
  });
})();
