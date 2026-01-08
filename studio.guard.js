/* =========================================================
   AIVO STUDIO — AUTH GUARD (FINAL / LOOP-SAFE)
   - TEK KAYNAK: aivo_logged_in + aivo_user_email
   - Login varsa: Studio'da kal
   - Login yoksa: SADECE 1 KEZ vitrine gönder
   - Sonsuz refresh İMKANSIZ
   ========================================================= */

(function AIVO_STUDIO_AUTH_GUARD(){
  "use strict";

  const REDIRECT_ONCE_KEY = "aivo_studio_redirect_once_v1";

  function isAuthed(){
    try {
      return (
        localStorage.getItem("aivo_logged_in") === "1" &&
        (localStorage.getItem("aivo_user_email") || "").trim().length > 0
      );
    } catch(_) {
      return false;
    }
  }

  // ✅ Login VARSA: guard kapalı, flag temizlenir
  if (isAuthed()) {
    try { sessionStorage.removeItem(REDIRECT_ONCE_KEY); } catch(_) {}
    return;
  }

  // ❌ Login YOKSA: sadece 1 kez yönlendir
  try {
    if (sessionStorage.getItem(REDIRECT_ONCE_KEY) === "1") {
      // ikinci kez buraya düştüyse -> hiçbir şey yapma (loop kırıldı)
      return;
    }
    sessionStorage.setItem(REDIRECT_ONCE_KEY, "1");
  } catch(_) {}

  // 🔁 Vitrine dön + login aç
  const target = "/studio.html";
  const url = "/?auth=1&return=" + encodeURIComponent(target);

  // replace: history şişmez, loop riski yok
  window.location.replace(url);
})();

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
