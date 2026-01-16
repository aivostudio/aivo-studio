/* =========================================================
   AIVO — AUTH LOGOUT (GLOBAL)
   - Logout butonu API çağırmıyorsa cookie kalır -> /api/auth/me ok:true
   - Bu dosya: click'i yakalar, /api/auth/logout çağırır, state temizler, index'e yollar
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_LOGOUT__) return;
  window.__AIVO_AUTH_LOGOUT__ = true;

  async function apiLogout() {
    try {
      // POST tercih; endpoint GET de kabul ediyorsa sorun değil
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (_) {
      // sessiz geç (UI logout'u yine tamamlayacak)
    }
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
    // UI double-click koruması
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    await apiLogout();
    clearClientState();

    // index'e dön
    location.replace("/?loggedOut=1");

    setTimeout(function () {
      doLogout.__busy = false;
    }, 1000);
  }

  function matchesLogoutEl(el) {
    if (!el) return false;

    // 1) data attribute ile garanti yol
    if (el.matches && el.matches("[data-logout]")) return true;

    // 2) id/class olasıları
    if (el.id === "btnLogout") return true;
    if (el.classList && (el.classList.contains("btn-logout") || el.classList.contains("logout"))) return true;

    // 3) metin fallback (TR)
    var t = (el.textContent || "").trim().toLowerCase();
    if (t === "çıkış yap" || t === "cikis yap" || t === "logout") return true;

    return false;
  }

  // Capture phase: başka handler'lar engellese bile yakala
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target;
      if (!el) return;

      // Buton/Link üst elementini bul
      var node = el.closest ? el.closest("a,button,[role='button'],li,div,span") : el;
      if (!node) return;

      if (!matchesLogoutEl(node)) return;

      e.preventDefault();
      e.stopPropagation();
      doLogout();
    },
    true
  );

  // İstersen global çağrı da olsun:
  window.aivoLogout = doLogout;
})();
