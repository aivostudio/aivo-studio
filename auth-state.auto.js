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

  /* ---------------------------------
     FETCH INTERCEPTOR (GLOBAL)
     --------------------------------- */
  window.fetch = function (input, init) {
    const url =
      (typeof input === "string")
        ? input
        : (input && input.url) ? input.url : "";

    // 🔒 CREDIT GUARD (guest) — SADECE credits/get
    if (url.indexOf("/api/credits/get") !== -1) {
      try {
        if (!document.body || !document.body.hasAttribute("data-user-logged-in")) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
      } catch (_) {}
    }

    // ✅ Her şeyi native fetch'e geçir (apply yok)
    const p = origFetch(input, init);

    // login/logout hook (eski + yeni path)
    try {
      const isLogin =
        url.indexOf("/api/login") !== -1 || url.indexOf("/api/auth/login") !== -1;

      const isLogout =
        url.indexOf("/api/logout") !== -1 || url.indexOf("/api/auth/logout") !== -1;

      if (isLogin) {
        p.then(function (res) {
          try { if (res && res.ok) setLoggedIn(); } catch (_) {}
        });
      }

      if (isLogout) {
        p.then(function () {
          try { setLoggedOut(); } catch (_) {}
        });
      }
    } catch (_) {}

    return p;
  };

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
