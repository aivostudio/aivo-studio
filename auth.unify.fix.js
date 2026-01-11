/* =========================================================
   AUTH UNIFY (STUDIO) — aivo_auth_unified_v2 (FINAL)
   Amaç:
   - Tek sorumluluk: auth state oku -> topbar UI toggle et
   - Kaybolma fix: topbar DOM sonradan re-render olursa MutationObserver ile tekrar uygula
   - Dışarı export: window.AIVO_AUTH.refresh()

   Kaynak key'ler:
   - aivo_logged_in = "1"
   - aivo_user_email = "mail@..."
   - legacy: aivo_auth = "1" (fallback)

   Topbar hedefleri:
   - #authGuest / #authUser
   - email alanları: #topUserEmail / #topMenuEmail / #umEmail (hangisi varsa)
   ========================================================= */
(function () {
  "use strict";

  if (window.__AIVO_AUTH_UNIFIED_V2_LOADED__) return;
  window.__AIVO_AUTH_UNIFIED_V2_LOADED__ = true;

  var KEY_LOGGED_IN = "aivo_logged_in";
  var KEY_USER_EMAIL = "aivo_user_email";
  var KEY_AUTH = "aivo_auth";

  function readState() {
    var li = "";
    var auth = "";
    var email = "";
    try {
      li = String(localStorage.getItem(KEY_LOGGED_IN) || "");
      auth = String(localStorage.getItem(KEY_AUTH) || "");
      email = String(localStorage.getItem(KEY_USER_EMAIL) || "");
    } catch (e) {}

    var loggedIn = (li === "1") || (auth === "1");
    var em = String(email || "").trim();
    return { loggedIn: loggedIn, email: em };
  }

  function syncCanonicalKeys(state) {
    try {
      if (state.loggedIn) {
        if (localStorage.getItem(KEY_LOGGED_IN) !== "1") localStorage.setItem(KEY_LOGGED_IN, "1");
        if (localStorage.getItem(KEY_AUTH) !== "1") localStorage.setItem(KEY_AUTH, "1");
        if (state.email && localStorage.getItem(KEY_USER_EMAIL) !== state.email) {
          localStorage.setItem(KEY_USER_EMAIL, state.email);
        }
      } else {
        localStorage.removeItem(KEY_LOGGED_IN);
        localStorage.removeItem(KEY_AUTH);
        localStorage.removeItem(KEY_USER_EMAIL);
      }
    } catch (e) {}
  }

  function qs(id) { return document.getElementById(id); }

  function setVisible(el, on) {
    if (!el) return;
    // hidden + display ikisini de yönet
    if (on) {
      el.hidden = false;
      el.removeAttribute("hidden");
      el.style.display = "";
      el.setAttribute("aria-hidden", "false");
    } else {
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  }

  function updateTopbarUI() {
    var guest = qs("authGuest");
    var user  = qs("authUser");

    // Topbar henüz DOM'a basılmadıysa sessizce çık
    if (!guest || !user) return false;

    var state = readState();
    syncCanonicalKeys(state);

    setVisible(guest, !state.loggedIn);
    setVisible(user, state.loggedIn);

    // Email alanlarını besle (hangisi varsa)
    var val = state.email || "Hesap";
    var email1 = qs("topUserEmail");
    var email2 = qs("topMenuEmail");
    var umEmail = qs("umEmail");

    if (email1) email1.textContent = val;
    if (email2) email2.textContent = val;
    if (umEmail) umEmail.textContent = val;

    return true;
  }

  function bindLogoutButtons() {
    var ids = ["btnLogoutTop", "btnLogoutUnified"];
    for (var i = 0; i < ids.length; i++) {
      var b = qs(ids[i]);
      if (!b || b.__aivoBound) continue;
      b.__aivoBound = true;

      b.addEventListener("click", function (e) {
        e.preventDefault();
        syncCanonicalKeys({ loggedIn: false, email: "" });
        updateTopbarUI();
      });
    }
  }

  // DOM sonradan re-render olunca auth UI tekrar uygulansın
  var obs = null;
  function startObserver() {
    if (obs) return;

    obs = new MutationObserver(function () {
      // Topbar yeni basıldıysa veya hidden geri geldiyse toparla
      // Çok sık tetiklenebilir; basit throttling:
      if (startObserver.__t) return;
      startObserver.__t = setTimeout(function () {
        startObserver.__t = 0;
        updateTopbarUI();
        bindLogoutButtons();
      }, 30);
    });

    try {
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "style", "class"]
      });
    } catch (e) {}
  }

  // Dışarı export: studio.app.js tek satırla çağırabilsin
  window.AIVO_AUTH = window.AIVO_AUTH || {};
  window.AIVO_AUTH.refresh = function () {
    try {
      updateTopbarUI();
      bindLogoutButtons();
    } catch (e) {}
  };

  function boot() {
    window.AIVO_AUTH.refresh();
    startObserver();

    // storage event: başka tab login/logout yaptıysa
    window.addEventListener("storage", function (ev) {
      if (!ev) return;
      var k = String(ev.key || "");
      if (k === KEY_LOGGED_IN || k === KEY_USER_EMAIL || k === KEY_AUTH) {
        window.AIVO_AUTH.refresh();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
