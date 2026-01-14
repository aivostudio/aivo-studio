// ✅ SAFE ORIG FETCH (bozuk override’ları bypass eder)
function getSafeFetch() {
  // 1) Daha önce yakalanmışsa onu kullan
  if (typeof window.__nativeFetch === "function") return window.__nativeFetch;

  // 2) Native fetch'i (Safari/Chrome) en yakın yerden al
  const f = window.fetch;

  // Bazı bozuk patch’ler toString/length gibi şeyleri de bozabiliyor.
  // Bu yüzden sadece "function" olmasını ve bind edilebilmesini baz alıyoruz.
  try {
    return f.bind(window);
  } catch (_) {
    return function () {
      // son çare: yine window.fetch dene
      return window.fetch.apply(window, arguments);
    };
  }
}

/* =========================================================
   auth-state.auto.js — FINAL (NO FETCH OVERRIDE)
   - Sets body[data-user-logged-in] using /api/auth/me
   - Does NOT monkey-patch window.fetch (pending biter)
   - Corporate/Contact pages: loader kill safe
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_STATE_AUTO_V2__) return;
  window.__AIVO_AUTH_STATE_AUTO_V2__ = true;

  // Kurumsal/İletişim sayfalarında loader asla takılmasın
  if (window.__AIVO_DISABLE_STUDIO_LOADER__ === true || document.getElementById("contactForm")) {
    killLoader();
    return;
  }

  function setLoggedIn() {
    try { document.body.setAttribute("data-user-logged-in", ""); } catch (_) {}
  }

  function setLoggedOut() {
    try { document.body.removeAttribute("data-user-logged-in"); } catch (_) {}
  }

  async function checkMe() {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });

      if (res && res.ok) {
        const j = await res.json().catch(() => ({}));
        // me endpoint ok ise login varsay
        if (j && (j.ok === true || j.user)) setLoggedIn();
        else setLoggedOut();
      } else {
        setLoggedOut();
      }
    } catch (_) {
      setLoggedOut();
    } finally {
      // her durumda loader öldür
      killLoader();
    }
  }

  function killLoader() {
    try {
      document.documentElement.classList.remove("studio-loading","auth-loading","loading","is-loading");
      if (document.body) document.body.classList.remove("studio-loading","auth-loading","loading","is-loading");

      document.querySelectorAll(
        ".studio-loading, .auth-loading, .loading-overlay, .aivo-loading, .studio-overlay, .auth-overlay"
      ).forEach(function (el) {
        el.style.display = "none";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      });
    } catch (_) {}
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkMe, { once: true });
  } else {
    checkMe();
  }

  // Login/logout sonrası başka scriptler bunu çağırabilsin:
  window.AIVO_REFRESH_AUTH_STATE = checkMe;
})();
