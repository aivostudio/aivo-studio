/* =========================================================
   AIVO — STUDIO GUARD (direct URL protection)
   Depends on index.auth.js (openLoginModal / isLoggedIn / rememberTarget)
   ========================================================= */

(function () {
  function safeIsLoggedIn() {
    try {
      if (typeof window.isLoggedIn === "function") return window.isLoggedIn();
      return localStorage.getItem("aivo_logged_in") === "1";
    } catch (_) {
      return false;
    }
  }

  function safeRememberTarget(url) {
    try {
      if (typeof window.rememberTarget === "function") return window.rememberTarget(url);
      // fallback (index.auth.js farklı isim kullanıyorsa diye)
      sessionStorage.setItem("aivo_auth_target", url);
    } catch (_) {}
  }

  function safeOpenModal() {
    if (typeof window.openLoginModal === "function") {
      window.openLoginModal();
      return;
    }
    // Eğer bir sebeple index.auth.js yüklenmediyse:
    console.warn("[AIVO] openLoginModal not found. index.auth.js loaded?");
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Login varsa hiçbir şey yapma
    if (safeIsLoggedIn()) return;

    // Login yoksa: hedef studio olsun + modal aç
    safeRememberTarget(window.location.pathname + window.location.search + window.location.hash);
    safeOpenModal();
  });

  // İleride “Çıkış Yap” bağlamak için hazır fonksiyon
  window.aivoLogout = function aivoLogout() {
    try {
      localStorage.removeItem("aivo_logged_in");
      localStorage.removeItem("aivo_user_email");
      // istersen hedefi landing’e al:
      window.location.href = "/";
    } catch (_) {
      window.location.href = "/";
    }
  };
})();
