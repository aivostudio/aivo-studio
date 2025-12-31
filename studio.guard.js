/* =========================================================
   AIVO — STUDIO GUARD (FINAL / SAFE)
   SADECE studio.html için
   ========================================================= */

(function () {

  // ❗ SADECE STUDIO SAYFASINDA ÇALIŞ
  if (!location.pathname.includes("studio")) return;

  function isAuthed() {
    try {
      return localStorage.getItem("aivo_auth") === "1";
    } catch (_) {
      return false;
    }
  }

  function rememberTarget(url) {
    try {
      sessionStorage.setItem("aivo_auth_target", url);
    } catch (_) {}
  }

  function openLogin() {
    if (typeof window.openLoginModal === "function") {
      window.openLoginModal();
      return;
    }

    // fallback: klasik login sayfası
    window.location.href = "/login.html";
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Giriş varsa → hiçbir şey yapma
    if (isAuthed()) return;

    // Giriş yok → hedefi kaydet + login aç
    rememberTarget(location.pathname + location.search + location.hash);
    openLogin();
  });

  // Çıkış
  window.aivoLogout = function () {
    try {
      localStorage.removeItem("aivo_auth");
    } catch (_) {}
    window.location.href = "/";
  };

})();
