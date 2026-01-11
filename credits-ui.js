/* =========================================================
   credits-ui.js — AIVO CREDITS UI SYNC (V2 SAFE)
   - Prevents request spam (TTL + in-flight lock)
   - Keeps window.syncCreditsUI()
   - Updates badges safely
   - Pulls from /api/credits/get (no email first, email fallback)
   ========================================================= */
(function () {
  "use strict";

  // ✅ Hard guard (dosya 2 kez yüklenirse tekrar init etme)
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

  // UI hedefleri
  function updateBadges(credits) {
    var c = clampCredits(credits);
    setText($("#topCreditCount"), c);
    setText($("#creditCount"), c);
    setText($("#studioCreditCount"), c);
  }

  function getEmail() {
    // Birkaç kaynak deniyoruz (senin mevcut auth yapına göre)
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

  // ---------------------------
  // ✅ Request spam guard (V2)
  // ---------------------------
  var TTL_MS = 15000;         // 15s cooldown (istersen 30000 yap)
  var lastFetchAt = 0;
  var inFlight = null;

  // Bazı endpointler farklı field döndürüyor olabilir:
  // - { credits: 60 }
  // - { balance: 60 }
  // - { ok:true, credits: 60 }
  function parseCreditsFromResponse(data) {
    if (!data) return null;
    if (data.credits != null) return clampCredits(data.credits);
    if (data.balance != null) return clampCredits(data.balance);
    if (data.data && data.data.credits != null) return clampCredits(data.data.credits);
    if (data.data && data.data.balance != null) return clampCredits(data.data.balance);
    return null;
  }

  async function fetchCreditsOnce(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
      cache: "no-store",
      credentials: "include" // ✅ cookie/session varsa kullan
    });

    if (!res.ok) return { ok: false, status: res.status, data: null };
    var data = await res.json().catch(function () { return null; });
    return { ok: true, status: res.status, data: data };
  }

  async function pullFromServerAndSet(opts) {
    opts = opts || {};
    var force = !!opts.force;

    var now = Date.now();
    if (!force && (now - lastFetchAt) < TTL_MS) return null;
    if (!force && inFlight) return inFlight;

    inFlight = (async function () {
      try {
        // 1) Önce email'siz dene (V2 ideal)
        var r1 = await fetchCreditsOnce("/api/credits/get");
        var credits = r1.ok ? parseCreditsFromResponse(r1.data) : null;

        // 2) Eğer backend email zorunluysa fallback
        if (credits == null && (r1.status === 400 || r1.status === 401 || r1.status === 403)) {
          var email = getEmail();
          if (email) {
            var r2 = await fetchCreditsOnce("/api/credits/get?email=" + encodeURIComponent(email));
            credits = r2.ok ? parseCreditsFromResponse(r2.data) : null;
          }
        }

        if (credits == null) {
          lastFetchAt = Date.now();
          return null;
        }

        // ✅ Store güncelle (ama loop olmasın diye event tetiklenmesini store yönetiyor)
        // Burada store setCredits çağırıyoruz; store zaten "aivo:credits-changed" atıyorsa
        // tekrar syncCreditsUI çağırmayacağız (aşağıda debounce var).
        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          // Bazı store'larda setCredits(x, {silent:true}) gibi opsiyon yoksa da sorun değil
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

  // ---------------------------
  // ✅ Global API (store.js çağırabilir)
  // ---------------------------
  var debounceTimer = null;
  function debouncedSync() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      try { window.syncCreditsUI({ force: false }); } catch (_) {}
    }, 120);
  }

  window.syncCreditsUI = async function syncCreditsUI(options) {
    options = options || {};
    var force = !!options.force;

    // 1) Store varsa önce onu bas
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        updateBadges(window.AIVO_STORE_V1.getCredits());
      }
    } catch (_) {}

    // 2) Sonra server’dan çek (TTL/in-flight korumalı)
    await pullFromServerAndSet({ force: force });
  };

  // İlk açılışta bir kere çalıştır (force değil)
  try { window.syncCreditsUI({ force: false }); } catch (_) {}

  // Tab geri gelince (kullanıcı geri döndü) → force refresh
  document.addEventListener("visibilitychange", function () {
    try {
      if (!document.hidden) window.syncCreditsUI({ force: true });
    } catch (_) {}
  });

  // credits değişince UI güncelle
  window.addEventListener("aivo:credits-changed", function (e) {
    try {
      var c = e && e.detail ? e.detail.credits : null;
      updateBadges(c);
      // Event yağarsa fetch spam olmasın diye debounce ile (force:false) sync
      debouncedSync();
    } catch (_) {}
  });
})();
