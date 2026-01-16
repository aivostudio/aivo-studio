// auth.logout.js (logout'u GERÇEK yapar)
(function () {
  "use strict";

  async function apiLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (_) {}
  }

  function clearClientState() {
    try {
      localStorage.removeItem("aivo_logged_in");
      localStorage.removeItem("aivo_user_email");
      localStorage.removeItem("aivo_token");
    } catch (_) {}
    try {
      sessionStorage.removeItem("aivo_after_login");
    } catch (_) {}
  }

  async function doLogout() {
    await apiLogout();
    clearClientState();
    location.replace("/?loggedOut=1");
  }

  // Buton bağlama (senin HTML'ine göre selector gerekebilir)
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("[data-logout], #btnLogout, .btn-logout");
    if (!el) return;
    e.preventDefault();
    doLogout();
  });
})();
