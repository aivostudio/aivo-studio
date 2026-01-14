/* =========================================================
   auth-state.auto.js — FINAL / SINGLE SOURCE OF TRUTH
   - Auto login / logout detection
   - Sets body[data-user-logged-in]
   - GLOBAL credit guard (legacy cleanup)
   - NO PATCH REQUIRED ANYWHERE ELSE
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_STATE_AUTO__) return;
  window.__AIVO_AUTH_STATE_AUTO__ = true;

  // ✅ CONTACT FORM SAYFASINDA DEVRE DIŞI (studio loader tetiklenmesin)
  // Not: footer contact form index.html içinde olduğu için burada yakalar.
  if (document.getElementById("contactForm")) {
    // ekstra sigorta: varsa “Studio hazırlanıyor…” overlay’ini öldür
    try {
      document.body.classList.remove("studio-loading", "auth-loading", "loading", "is-loading");
      document
        .querySelectorAll(".studio-loading, .auth-loading, .loading-overlay, .aivo-loading")
        .forEach((el) => (el.style.display = "none"));
    } catch (_) {}
    return;
  }

  const origFetch = window.fetch;

  function setLoggedIn() {
    try {
      document.body.setAttribute("data-user-logged-in", "");
    } catch (_) {}
  }

  function setLoggedOut() {
    try {
      document.body.removeAttribute("data-user-logged-in");
    } catch (_) {}
  }

  // ---------------------------------
  // INITIAL CHECK (cookie based)
  // ---------------------------------
  try {
    origFetch("/api/credits/get", { credentials: "include" })
      .then(function (res) {
        if (res && res.status === 200) {
          setLoggedIn();
        } else {
          setLoggedOut();
        }
      })
      .catch(function () {
        setLoggedOut();
      });
  } catch (_) {
    setLoggedOut();
  }

  // ---------------------------------
  // FETCH INTERCEPTOR (GLOBAL)
  // ---------------------------------
  window.fetch = function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : (input && input.url) || "";

    // 🔒 GLOBAL CREDIT GUARD
    if (url.includes("/api/credits/get")) {
      if (!document.body.hasAttribute("data-user-logged-in")) {
        // Guest → silently swallow
        return Promise.resolve(
          new Response(null, { status: 204 })
        );
      }
    }

    const p = origFetch.apply(this, arguments);

    try {
      // LOGIN SUCCESS
      if (url.includes("/api/login")) {
        p.then(function (res) {
          if (res && res.ok) setLoggedIn();
        });
      }

      // LOGOUT
      if (url.includes("/api/logout")) {
        p.then(function () {
          setLoggedOut();
        });
      }
    } catch (_) {}

    return p;
  };

  // ✅ EXTRA SİGORTA: sayfa yüklenince “Studio hazırlanıyor…” overlay’i kalmışsa öldür
  try {
    setTimeout(function () {
      document.body.classList.remove("studio-loading", "auth-loading", "loading", "is-loading");
      document
        .querySelectorAll(".studio-loading, .auth-loading, .loading-overlay, .aivo-loading")
        .forEach((el) => (el.style.display = "none"));
    }, 0);
  } catch (_) {}
})();
