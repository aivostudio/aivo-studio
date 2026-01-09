/* =========================================================
   AIVO — LOGOUT (GLOBAL) v1
   - /api/logout çağırır (cookie varsa temizler)
   - localStorage/sessionStorage auth izlerini temizler (asıl çıkış)
   - UI reset + redirect
========================================================= */
(function () {
  "use strict";
  if (window.__AIVO_LOGOUT_BOUND__) return;
  window.__AIVO_LOGOUT_BOUND__ = true;

  function clearAuthStorage() {
    // Bilinen anahtarlar
    const knownKeys = [
      "aivo_user",
      "aivo_user_v1",
      "aivo_auth",
      "aivo_auth_v1",
      "aivo_session",
      "aivo_session_v1",
      "aivo_after_login",
      "aivo_after_login_v1",
    ];

    try {
      knownKeys.forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } catch (e) {}

    // aivo_* ile başlayan ne varsa da temizle (güvenli temizlik)
    try {
      const lsKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^aivo_/i.test(k)) lsKeys.push(k);
      }
      lsKeys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}

    try {
      const ssKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && /^aivo_/i.test(k)) ssKeys.push(k);
      }
      ssKeys.forEach((k) => sessionStorage.removeItem(k));
    } catch (e) {}
  }

  async function callLogoutApi() {
    try {
      // Cookie temizliği için credentials şart
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (e) {
      // API fail olsa bile local logout çalışmalı
    }
  }

  async function doLogout() {
    // 1) server cookie temizliği (varsa)
    await callLogoutApi();

    // 2) local auth temizliği (asıl çıkış)
    clearAuthStorage();

    // 3) global auth state varsa kapat
    try { window.isLoggedIn = false; } catch(e) {}
    try {
      if (window.AIVO_AUTH && typeof window.AIVO_AUTH.logout === "function") {
        window.AIVO_AUTH.logout();
      }
    } catch (e) {}

    // 4) UI’yı garantile: sayfayı yenile / ana sayfaya dön
    location.href = "/";
  }

  // Tüm sitelerde “Çıkış Yap” yakalama (id / data-action / text fallback)
  document.addEventListener("click", function (ev) {
    const el = ev.target && ev.target.closest
      ? ev.target.closest(
          '#btnLogoutTop, [data-action="logout"], [data-auth-action="logout"], button[data-logout], a[data-logout]'
        )
      : null;

    // Eğer butonda selector yoksa, son çare: buton metni "Çıkış Yap" ise
    const textBtn =
      !el &&
      ev.target &&
      ev.target.closest &&
      ev.target.closest("button") &&
      (ev.target.closest("button").textContent || "").trim() === "Çıkış Yap"
        ? ev.target.closest("button")
        : null;

    const target = el || textBtn;
    if (!target) return;

    ev.preventDefault();
    ev.stopPropagation();
    doLogout();
  });
})();
