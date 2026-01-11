/* =========================================================
   credits-ui.js — AIVO CREDITS UI SYNC (V2 FINAL)
   - No request spam (TTL + in-flight)
   - Email-safe fallback
   - Store + UI loop safe
   - Stripe / tab focus friendly
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
  // EMAIL (SAFE)
  // ---------------------------------
  function getEmailSafe() {
    try {
      var el = $("#topUserEmail");
      if (el && el.textContent.includes("@")) {
        return el.textContent.trim().toLowerCase();
      }
    } catch (_) {}

    try {
      var u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      if (u?.email) return String(u.email).toLowerCase();
    } catch (_) {}

    try {
      var a = JSON.parse(localStorage.getItem("AIVO_AUTH") || "null");
      if (a?.email) return String(a.email).toLowerCase();
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
    if (data.data?.credits != null) return clampCredits(data.data.credits);
    if (data.data?.balance != null) return clampCredits(data.data.balance);
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
    return { ok: true, status: res.status, data: await res.json().catch(() => null) };
  }

  async function pullFromServer(opts) {
    opts = opts || {};
    var force = !!opts.force;

    var now = Date.now();
    if (!force && (now - lastFetchAt) < TTL_MS) return null;
    if (!force && inFlight) return inFlight;

    inFlight = (async function () {
      try {
        // 1️⃣ EMAIL’SİZ (ideal V2)
        var r1 = await fetchOnce("/api/credits/get");
        var credits = r1.ok ? parseCredits(r1.data) : null;

        // 2️⃣ EMAIL FALLBACK (sadece backend isterse)
        if (
          credits == null &&
          (r1.status === 400 || r1.status === 401 || r1.status === 403)
        ) {
          var email = getEmailSafe();
          if (email) {
            var r2 = await fetchOnce(
              "/api/credits/get?email=" + encodeURIComponent(email)
            );
            credits = r2.ok ? parseCredits(r2.data) : null;
          }
        }

        if (credits == null) {
          lastFetchAt = Date.now();
          return null;
        }

        // STORE → UI (loop safe)
        if (
          window.AIVO_STORE_V1 &&
          typeof window.AIVO_STORE_V1.setCredits === "function"
        ) {
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

    // Store → UI first
    try {
      if (
        window.AIVO_STORE_V1 &&
        typeof window.AIVO_STORE_V1.getCredits === "function"
      ) {
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
      updateBadges(e?.detail?.credits);
      debouncedSync();
    } catch (_) {}
  });
})();
