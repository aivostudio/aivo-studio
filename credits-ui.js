/* =========================================================
   credits-ui.js — AIVO CREDITS UI SYNC (V3 FIXED)
   - Stops 400 spam by NEVER calling /api/credits/get without email
   - Strong email detection (DOM + multiple LS keys + global user)
   - TTL + in-flight guard
   - Store -> UI first, server second
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_CREDITS_UI_LOADED__) return;
  window.__AIVO_CREDITS_UI_LOADED__ = true;

  // ---------------------------------
  // HELPERS
  // ---------------------------------
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

  function parseCredits(data) {
    if (!data) return null;

    // common shapes
    if (data.credits != null) return clampCredits(data.credits);
    if (data.balance != null) return clampCredits(data.balance);

    // nested shapes
    if (data.data && data.data.credits != null) return clampCredits(data.data.credits);
    if (data.data && data.data.balance != null) return clampCredits(data.data.balance);

    // sometimes APIs return { ok:true, data:{...} }
    if (data.ok && data.data) return parseCredits(data.data);

    return null;
  }

  // ---------------------------------
  // EMAIL (STRONG SAFE)
  // ---------------------------------
  function normalizeEmail(v) {
    var s = (v == null ? "" : String(v)).trim().toLowerCase();
    if (!s || !s.includes("@")) return null;
    return s;
  }

  function getEmailSafe() {
    // 1) DOM
    try {
      var el = $("#topUserEmail");
      var domEmail = normalizeEmail(el && el.textContent);
      if (domEmail) return domEmail;
    } catch (_) {}

    // 2) localStorage (string keys)
    try {
      var keys = [
        "aivo_user_email",
        "user_email",
        "email",
        "AIVO_USER_EMAIL"
      ];
      for (var i = 0; i < keys.length; i++) {
        var v = normalizeEmail(localStorage.getItem(keys[i]));
        if (v) return v;
      }
    } catch (_) {}

    // 3) localStorage (json keys)
    try {
      var u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      var e1 = normalizeEmail(u && u.email);
      if (e1) return e1;
    } catch (_) {}

    try {
      var a = JSON.parse(localStorage.getItem("AIVO_AUTH") || "null");
      var e2 = normalizeEmail(a && a.email);
      if (e2) return e2;
    } catch (_) {}

    // 4) globals (if auth script sets something)
    try {
      var g = window.__AIVO_USER || window.AIVO_USER || window.user;
      var e3 = normalizeEmail(g && g.email);
      if (e3) return e3;
    } catch (_) {}

    return null;
  }

  // ---------------------------------
  // REQUEST GUARDS
  // ---------------------------------
  var TTL_MS = 15000; // 15s
  var lastFetchAt = 0;
  var inFlight = null;

  // If your backend truly supports session-based credits without email,
  // you can set this to true. Default false to avoid 400 spam.
  var ALLOW_ANON_ENDPOINT = false;

  async function fetchOnce(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
      cache: "no-store",
      credentials: "include"
    });

    var data = null;
    try { data = await res.json(); } catch (_) { data = null; }

    return { ok: res.ok, status: res.status, data: data };
  }

  async function pullFromServer(opts) {
    opts = opts || {};
    var force = !!opts.force;

    var now = Date.now();
    if (!force && (now - lastFetchAt) < TTL_MS) return null;
    if (!force && inFlight) return inFlight;

    inFlight = (async function () {
      try {
        var credits = null;

        // ✅ EMAIL FIRST (prevents 400)
        var email = getEmailSafe();
        if (email) {
          var r = await fetchOnce("/api/credits/get?email=" + encodeURIComponent(email));
          credits = r.ok ? parseCredits(r.data) : null;
        } else if (ALLOW_ANON_ENDPOINT) {
          // Optional: only if backend supports it
          var r0 = await fetchOnce("/api/credits/get");
          credits = r0.ok ? parseCredits(r0.data) : null;
        } else {
          // No email -> do not hit server
          lastFetchAt = Date.now();
          return null;
        }

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

    // 1) Store -> UI first (instant)
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        updateBadges(window.AIVO_STORE_V1.getCredits());
      }
    } catch (_) {}

    // 2) Then server (safe)
    await pullFromServer({ force: force });
  };

  // ---------------------------------
  // LIFECYCLE
  // ---------------------------------
  // Don't slam server immediately; let auth populate email.
  // First attempt after a tiny delay.
  setTimeout(function () {
    try { window.syncCreditsUI({ force: false }); } catch (_) {}
  }, 250);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      try { window.syncCreditsUI({ force: true }); } catch (_) {}
    }
  });

  window.addEventListener("aivo:credits-changed", function (e) {
    try {
      if (e && e.detail && e.detail.credits != null) {
        updateBadges(e.detail.credits);
      }
      debouncedSync();
    } catch (_) {}
  });

  // Optional: if your auth script can dispatch this after login
  window.addEventListener("aivo:auth-ready", function () {
    try { window.syncCreditsUI({ force: true }); } catch (_) {}
  });
})();

