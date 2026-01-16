/* =========================================================
   AIVO AUTH — LOGOUT (FINAL / CLEAN)
   Trigger: [data-action="logout"]
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_LOGOUT_FINAL__) return;
  window.__AIVO_LOGOUT_FINAL__ = true;

  async function doLogout() {
    try {
      // backend logout (cookie silinsin)
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (_) {
      // sessiz geç
    }

    // frontend temizlik (GARANTİ)
    try {
      localStorage.removeItem("aivo_logged_in");
      localStorage.removeItem("aivo_user_email");
      localStorage.removeItem("aivo_token");
      sessionStorage.removeItem("aivo_after_login");
    } catch (_) {}

    // her zaman vitrine
    location.replace("/");
  }

  document.addEventListener("click", function (ev) {
    const btn = ev.target.closest('[data-action="logout"]');
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    doLogout();
  });
})();
