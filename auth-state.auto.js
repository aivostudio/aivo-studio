/* =========================================================
   auth-state.auto.js — FINAL / SINGLE SOURCE OF TRUTH (FIXED)
   - Auto login / logout detection
   - Sets body[data-user-logged-in]
   - GLOBAL credit guard (only /api/credits/get)
   - Kurumsal / iletişim sayfalarında STUDIO LOADER ASLA ÇALIŞMAZ
   - ✅ fetch override artık asla pending bırakmaz (native fetch bind)
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_STATE_AUTO__) return;
  window.__AIVO_AUTH_STATE_AUTO__ = true;

  /* =====================================================
     ❌ KURUMSAL / İLETİŞİM SAYFALARINDA TAM DEVRE DIŞI
     ===================================================== */

  // 1) Sayfa özel bayrak varsa (iletisim.html head’inde set edilir)
  if (window.__AIVO_DISABLE_STUDIO_LOADER__ === true) {
    killLoader();
    return;
  }

  // 2) contactForm varsa (footer / iletişim)
  if (document.getElementById("contactForm")) {
    killLoader();
    return;
  }

  /* =====================================================
     CORE LOGIC (SADECE STUDIO / INDEX İÇİN)
     ===================================================== */

  // ✅ Native fetch'i sağlam yakala (bind)
  const origFetch =
    (window.fetch && window.fetch.bind) ? window.fetch.bind(window) : window.fetch;

  function setLoggedIn() {
    try {
      document.body && document.body.setAttribute("data-user-logged-in", "");
    } catch (_) {}
  }

  function setLoggedOut() {
    try {
      document.body && document.body.removeAttribute("data-user-logged-in");
    } catch (_) {}
  }

  /* ---------------------------------
     INITIAL CHECK (cookie based)
     --------------------------------- */
  try {
    origFetch("/api/credits/get", { credentials: "include" })
      .then(function (res) {
        if (res && res.status === 200) setLoggedIn();
        else setLoggedOut();
      })
      .catch(function () {
        setLoggedOut();
      });
  } catch (_) {
    setLoggedOut();
  }

 
  /* =====================================================
     EXTRA SAFETY — loader kalmışsa öldür
     ===================================================== */
  setTimeout(killLoader, 0);

  function killLoader() {
    try {
      document.documentElement.classList.remove(
        "studio-loading",
        "auth-loading",
        "loading",
        "is-loading"
      );
      if (document.body) {
        document.body.classList.remove(
          "studio-loading",
          "auth-loading",
          "loading",
          "is-loading"
        );
      }

      document
        .querySelectorAll(
          ".studio-loading, .auth-loading, .loading-overlay, .aivo-loading, .studio-overlay, .auth-overlay"
        )
        .forEach(function (el) {
          el.style.display = "none";
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        });
    } catch (_) {}
  }
})();
