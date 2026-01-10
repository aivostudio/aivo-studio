if (window.__AIVO_AUTH_LOGOUT_LOADED__) {
  console.warn("[AIVO] auth.logout.js already loaded — skip");
} else {
  window.__AIVO_AUTH_LOGOUT_LOADED__ = true;
  // dosyanın geri kalanı aşağıda devam etsin

/* =========================================================
   AIVO — LOGOUT (GLOBAL) v3 — FINAL / CREDIT-SAFE
   - /api/logout çağırır (cookie invalidate)
   - SADECE auth/login izlerini temizler
   - KREDİ / FATURA / JOBS / SETTINGS KORUNUR
   - Include gecikmesine dayanıklı (event delegation + capture)
   - Double-trigger guard
========================================================= */
(function () {
  "use strict";

  // Aynı dosya 2 kez yüklense bile tek kez bağla
  if (window.__AIVO_LOGOUT_BOUND__) return;
  window.__AIVO_LOGOUT_BOUND__ = true;

  function safe(fn) {
    try { return fn(); } catch (e) {}
  }

  /* =========================================================
     AUTH TEMİZLİĞİ (KREDİ KORUNUR)
     ========================================================= */
  function clearAuthStorage() {
    // ❌ SİLİNECEK: SADECE auth / login izleri
    const authKeysExact = [
      "aivo_user",
      "aivo_user_v1",
      "aivo_auth",
      "aivo_auth_v1",
      "aivo_session",
      "aivo_session_v1",
      "aivo_after_login",
      "aivo_after_login_v1",
      "aivo_login_email",
      "aivo_login_state"
    ];

    // ✅ ASLA SİLİNMEYECEK: ürün verileri
    const keepPrefixes = [
      "aivo_store",          // kredi ana kaynağı
      "aivo_credit",
      "aivo_credits",
      "aivo_invoice",
      "aivo_invoices",
      "aivo_jobs",
      "aivo_settings",
      "aivo_profile_stats"
    ];

    function shouldKeep(key) {
      const lk = String(key || "").toLowerCase();
      return keepPrefixes.some(p => lk.startsWith(p));
    }

    // 1) Net auth key'leri sil
    safe(() => {
      authKeysExact.forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    });

    // 2) İçinde auth/session geçen ama ürün verisi olmayanları sil
    safe(() => {
      const lsRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const lk = k.toLowerCase();

        const looksAuth =
          lk.includes("auth") ||
          lk.includes("session") ||
          lk.includes("after_login") ||
          lk.includes("logged");

        if (looksAuth && !shouldKeep(k)) {
          lsRemove.push(k);
        }
      }
      lsRemove.forEach(k => localStorage.removeItem(k));
    });

    safe(() => {
      const ssRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        const lk = k.toLowerCase();

        const looksAuth =
          lk.includes("auth") ||
          lk.includes("session") ||
          lk.includes("after_login") ||
          lk.includes("logged");

        if (looksAuth && !shouldKeep(k)) {
          ssRemove.push(k);
        }
      }
      ssRemove.forEach(k => sessionStorage.removeItem(k));
    });
  }

  /* =========================================================
     API LOGOUT
     ========================================================= */
  async function callLogoutApi() {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
    } catch (e) {
      // API fail olsa bile client logout devam eder
    }
  }

  /* =========================================================
     RUNTIME AUTH RESET
     ========================================================= */
  function resetRuntimeAuth() {
    safe(() => { window.isLoggedIn = false; });
    safe(() => {
      if (window.AIVO_AUTH && typeof window.AIVO_AUTH.logout === "function") {
        window.AIVO_AUTH.logout();
      }
    });
  }

  /* =========================================================
     REDIRECT
     ========================================================= */
  function redirectHome() {
    safe(() => history.replaceState(null, "", "/"));
    location.assign("/");
  }

  /* =========================================================
     LOGOUT FLOW
     ========================================================= */
  async function doLogout() {
    if (window.__AIVO_LOGOUT_IN_PROGRESS__) return;
    window.__AIVO_LOGOUT_IN_PROGRESS__ = true;

    await callLogoutApi();      // 1) cookie invalidate
    clearAuthStorage();         // 2) SADECE auth temizle
    resetRuntimeAuth();         // 3) JS state reset
    redirectHome();             // 4) garanti redirect
  }

  /* =========================================================
     CLICK DELEGATION (CAPTURE MODE)
     ========================================================= */
  function findLogoutTarget(ev) {
    if (!ev || !ev.target || !ev.target.closest) return null;

    // Net selector’lar
    let t = ev.target.closest(
      '#btnLogoutTop,' +
      ' [data-action="logout"],' +
      ' [data-auth-action="logout"],' +
      ' [data-logout="1"],' +
      ' button[data-logout],' +
      ' a[data-logout]'
    );
    if (t) return t;

    // <a> metni fallback
    const a = ev.target.closest("a");
    if (a && (a.textContent || "").trim() === "Çıkış Yap") return a;

    // <button> metni fallback
    const b = ev.target.closest("button");
    if (b && (b.textContent || "").trim() === "Çıkış Yap") return b;

    return null;
  }

  // CAPTURE = true → include + link navigation sorun çıkaramaz
  document.addEventListener("click", function (ev) {
    const target = findLogoutTarget(ev);
    if (!target) return;

    ev.preventDefault();
    ev.stopPropagation();
    doLogout();
  }, true);

})();
