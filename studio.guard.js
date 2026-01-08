/* =========================================================
   AIVO — STUDIO GUARD (MINIMAL)
   - index.auth.js exportlarına dayanır:
       window.isLoggedIn
       window.rememberTarget
       window.openLoginModal
   - Studio'da login yoksa: vitrine gönderir, hedefi saklar
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_STUDIO_GUARD__) return;
  window.__AIVO_STUDIO_GUARD__ = true;

  function safeIsLoggedIn() {
    try {
      if (typeof window.isLoggedIn === "function") return !!window.isLoggedIn();
      // fallback (index.auth.js gelmediyse)
      return localStorage.getItem("aivo_logged_in") === "1";
    } catch (_) {
      return false;
    }
  }

  function rememberTarget(url) {
    try {
      if (typeof window.rememberTarget === "function") {
        window.rememberTarget(url);
        return;
      }
      sessionStorage.setItem("aivo_after_login", url);
    } catch (_) {}
  }

  function redirectToIndexAndLogin() {
    var target = "/studio.html" + (location.search || "") + (location.hash || "");
    rememberTarget(target);

    // index'e gidince login modal açsın diye param
    var url = "/?auth=1";
    location.replace(url);
  }

  // ✅ Guard
  if (!safeIsLoggedIn()) {
    redirectToIndexAndLogin();
    return;
  }
})();
