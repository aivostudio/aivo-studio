// auth-state.auto.js — FINAL V2 (NO FETCH OVERRIDE, SAFE ME CHECK)

/* ✅ SAFE ORIG FETCH (bozuk override’ları bypass eder) */
function getSafeFetch() {
  // 1) Daha önce yakalanmışsa onu kullan
  if (typeof window.__nativeFetch === "function") return window.__nativeFetch;

  // 2) Şu anki fetch'i al (native ya da patch’li olabilir)
  const f = window.fetch;

  // 3) bind ile mümkün olduğunca "orijinal" davranış al
  try {
    return f.bind(window);
  } catch (_) {
    // son çare
    return function () {
      return window.fetch.apply(window, arguments);
    };
  }
}

/* =========================================================
   auth-state.auto.js — FINAL (NO FETCH OVERRIDE)
   - Sets body[data-user-logged-in] using /api/auth/me
   - Does NOT monkey-patch window.fetch (pending biter)
   - Corporate/Contact pages: loader kill safe
   - Exposes: window.AIVO_REFRESH_AUTH_STATE()
   - Hooks: listens login/logout events (optional)
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_STATE_AUTO_V2__) return;
  window.__AIVO_AUTH_STATE_AUTO_V2__ = true;

  const safeFetch = getSafeFetch();

  /* =====================================================
     ❌ KURUMSAL / İLETİŞİM SAYFALARINDA TAM DEVRE DIŞI
     ===================================================== */
  if (
    window.__AIVO_DISABLE_STUDIO_LOADER__ === true ||
    document.getElementById("contactForm")
  ) {
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
      // ⚠️ Burada MUTLAKA safeFetch kullanıyoruz
      const res = await safeFetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });

      if (!res) { setLoggedOut(); return; }

      // 200-299 ise login say
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j && (j.ok === true || j.user)) setLoggedIn();
        else setLoggedOut();
        return;
      }

      // 401/403 gibi durumlarda logout say
      setLoggedOut();
    } catch (_) {
      setLoggedOut();
    } finally {
      // her durumda loader öldür
      killLoader();
    }
  }

  function killLoader() {
    try {
      document.documentElement.classList.remove(
        "studio-loading", "auth-loading", "loading", "is-loading"
      );
      if (document.body) {
        document.body.classList.remove(
          "studio-loading", "auth-loading", "loading", "is-loading"
        );
      }

      document.querySelectorAll(
        ".studio-loading, .auth-loading, .loading-overlay, .aivo-loading, .studio-overlay, .auth-overlay"
      ).forEach(function (el) {
        el.style.display = "none";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      });
    } catch (_) {}
  }

  // dışarıdan çağrılabilir olsun
  window.AIVO_REFRESH_AUTH_STATE = checkMe;

  // Login/Logout sonrası otomatik refresh için mini hook
  // (index.auth.js login success / logout success burayı tetikleyebilir)
  window.addEventListener("aivo:login", () => { try { checkMe(); } catch(_){} });
  window.addEventListener("aivo:logout", () => { try { setLoggedOut(); killLoader(); } catch(_){} });

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkMe, { once: true });
  } else {
    checkMe();
  }
})();
