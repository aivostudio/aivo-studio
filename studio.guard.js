/* =========================================================
   AIVO — STUDIO GUARD (FINAL / SAFE) — AUTH KEY FIX
   SADECE studio.html için
   ========================================================= */

(function () {

  // ❗ SADECE STUDIO SAYFASINDA ÇALIŞ
  if (!location.pathname.includes("studio")) return;

  function isAuthed() {
    try {
      // ✅ tek otorite: vitrindeki auth ile aynı
      if (typeof window.isLoggedIn === "function") return window.isLoggedIn();
      return localStorage.getItem("aivo_logged_in") === "1";
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

  // Çıkış (tek otoriteye bağla)
  window.aivoLogout = function () {
    try {
      // ✅ vitrindeki logout ile aynı anahtarlar
      localStorage.removeItem("aivo_logged_in");
      localStorage.removeItem("aivo_user_email");
      localStorage.removeItem("aivo_user_name");
      // istersen token vs. varsa burada temizlenir
    } catch (_) {}
    window.location.href = "/";
  };

})();
