/* =========================================================
   credits-ui.js — AIVO CREDITS UI SYNC (V4 ROOT FIX)
   - NEVER call /api/credits/get without email (kills 400 spam)
   - Reads email from localStorage("aivo_user_email") FIRST
   - TTL + in-flight guard
   - Store -> UI first, server second
   ========================================================= */
(function () {
  "use strict";

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

  function updateBadges(credits) {
    var c = clampCredits(credits);
    setText($("#topCreditCount"), c);
    setText($("#creditCount"), c);
    setText($("#studioCreditCount"), c);
  }

  // ---------------------------------
  // EMAIL (SAFE) — ROOT FIX
  // ---------------------------------
  function getEmailSafe() {
    // 0) Your real source (confirmed)
    try {
      var direct = localStorage.getItem("aivo_user_email");
      if (direct && String(direct).includes("@")) {
        return String(direct).trim().toLowerCase();
      }
    } catch (_) {}

    // 1) DOM (optional)
    try {
      var el = $("#topUserEmail");
      if (el && el.textContent && el.textContent.includes("@")) {
        return el.textContent.trim().toLowerCase();
      }
    } catch (_) {}

    // 2) Other legacy stores (optional)
    try {
      var u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      if (u && u.email) return String(u.email).trim().toLowerCase();
    } catch (_) {}

    try {
      var a = JSON.parse(localStorage.getItem("AIVO_AUTH") || "null");
      if (a && a.email) return String(a.email).trim().toLowerCase();
    } catch (_) {}

    return null;
  }

  // ---------------------------------
  // REQUEST GUARDS
  // ---------------------------------
  var TTL_MS = 15000;
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

  async function fetchJSON(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
      cache: "no-store",
      credentials: "include"
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    var data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: true, status: res.status, data: data };
  }

  async function pullFromServer(opts) {
    opts = opts || {};
    var force = !!opts.force;

    var now = Date.now();
    if (!force && (now - lastFetchAt) < TTL_MS) return null;
    if (!force && inFlight) return inFlight;

    inFlight = (async function () {
      try {
        var email = getEmailSafe();

        // ROOT RULE: no email => no request
        if (!email) {
          lastFetchAt = Date.now();
          return null;
        }

        var url = "/api/credits/get?email=" + encodeURIComponent(email);
        var r = await fetchJSON(url);

        var credits = r.ok ? parseCredits(r.data) : null;
        if (credits == null) {
          lastFetchAt = Date.now();
          return null;
        }

        // STORE -> UI (loop safe)
        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          try { window.AIVO_STORE_V1.setCredits(credits); } catch (_) {}
        }

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
  // GLOBAL API
  // ---------------------------------
  var debounceTimer = null;
  function debouncedSync() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      try { window.syncCreditsUI({ force: false }); } catch (_) {}
    }, 120);
  }

  window.syncCreditsUI = async function (opts) {
    opts = opts || {};
    var force = !!opts.force;

    // Store -> UI first
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        updateBadges(window.AIVO_STORE_V1.getCredits());
      }
    } catch (_) {}

    await pullFromServer({ force: force });
  };

  // ---------------------------------
  // LIFECYCLE
  // ---------------------------------
  try { window.syncCreditsUI({ force: false }); } catch (_) {}

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
