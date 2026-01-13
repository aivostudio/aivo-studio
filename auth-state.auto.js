/* =========================================================
   AIVO AUTH STATE — AUTO LOGIN GUARD (NO PATCH)
   - Watches /api/login and /api/logout
   - Sets/removes: body[data-user-logged-in]
   - Zero integration changes required
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_STATE__) return;
  window.__AIVO_AUTH_STATE__ = true;

  var origFetch = window.fetch;

  function setLoggedIn() {
    document.body.setAttribute("data-user-logged-in", "");
  }

  function setLoggedOut() {
    document.body.removeAttribute("data-user-logged-in");
  }

  // On load: optimistic check (credit endpoint)
  (function initialCheck() {
    try {
      origFetch("/api/credits/get", { credentials: "include" })
        .then(function (r) {
          if (r && r.status === 200) setLoggedIn();
          else setLoggedOut();
        })
        .catch(setLoggedOut);
    } catch (_) {
      setLoggedOut();
    }
  })();

  // Monkey-patch fetch to observe auth transitions
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var p = origFetch.apply(this, arguments);

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
})();
