/* =========================================================
   AUTH UNIFY FIX — aivo_auth_unified_v2 (FINALIZE)
   Amaç:
   - Topbar görünürlük tek otorite: window.__AIVO_SESSION__?.ok
   - Partial/topbar geç gelirse retry ile yakala
   - Legacy localStorage sadece FALLBACK (istersen sonra kaldır)
   - UI kontrolü: html.is-auth / html.is-guest class’ları
   Not:
   - CSS tarafında globalde şunlar olmalı:
     .is-auth  #authGuest{display:none !important;}
     .is-auth  #authUser {display:flex !important;}
     .is-guest #authGuest{display:flex !important;}
     .is-guest #authUser {display:none !important;}
   ========================================================= */
(function () {
  "use strict";

  // legacy fallback anahtarlar (sadece fallback)
  var KEY_LOGGED_IN = "aivo_logged_in";   // "1" / null
  var KEY_USER_EMAIL = "aivo_user_email"; // "mail@..."
  var KEY_AUTH = "aivo_auth";             // "1" / null

  function qs(id) { return document.getElementById(id); }

  function readState() {
    // 1) TEK OTORITE (hedef)
    try {
      if (window.__AIVO_SESSION__ && window.__AIVO_SESSION__.ok) {
        return {
          loggedIn: true,
          email: String(window.__AIVO_SESSION__.email || window.__AIVO_SESSION__.userEmail || "").trim()
        };
      }
    } catch (e) {}

    // 2) FALLBACK (legacy)
    try {
      var li = localStorage.getItem(KEY_LOGGED_IN);
      var auth = localStorage.getItem(KEY_AUTH);
      var email = localStorage.getItem(KEY_USER_EMAIL);
      return {
        loggedIn: (li === "1") || (auth === "1"),
        email: String(email || "").trim()
      };
    } catch (e) {
      return { loggedIn: false, email: "" };
    }
  }

  function applyRootClass(isLoggedIn) {
    var root = document.documentElement; // <html>
    if (!root) return;
    root.classList.toggle("is-auth", !!isLoggedIn);
    root.classList.toggle("is-guest", !isLoggedIn);
  }

  function fillEmails(email) {
    var val = String(email || "").trim() || "Hesap";
    // sayfalara göre değişen id’ler
    var email1 = qs("topUserEmail");
    var email2 = qs("topMenuEmail");
    var email3 = qs("umEmail");
    if (email1) email1.textContent = val;
    if (email2) email2.textContent = val;
    if (email3) email3.textContent = val;
  }

  function updateTopbarUI() {
    var guest = qs("authGuest");
    var user  = qs("authUser");

    // Topbar henüz inject edilmemiş olabilir → sessiz çık
    if (!guest || !user) return false;

    var st = readState();
    applyRootClass(!!st.loggedIn);

    // ekstra güvenlik: hidden attribute bırakılmışsa düzelt (CSS’e rağmen)
    // (özellikle authUser default hidden ise)
    guest.hidden = !!st.loggedIn;
    user.hidden  = !st.loggedIn;

    fillEmails(st.email);
    return true;
  }

  // PARTIAL/ASYNC için retry
  function boot() {
    var tries = 0;
    var maxTries = 40;   // 40 * 100ms = 4sn
    var intervalMs = 100;

    // ilk deneme hemen
    updateTopbarUI();

    var t = setInterval(function () {
      tries++;
      var ok = updateTopbarUI();
      if (ok || tries >= maxTries) clearInterval(t);
    }, intervalMs);
  }

  // DOM hazır olunca boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Session değişince manuel tetiklemek için (istersen başka yerden çağır)
  window.__AIVO_TOPBAR_REFRESH__ = function () {
    try { updateTopbarUI(); } catch (e) {}
  };

  // Başka tab/sayfada login/logout olursa (fallback dünyası için) güncelle
  window.addEventListener("storage", function (ev) {
    var k = String((ev && ev.key) || "");
    if (k === KEY_LOGGED_IN || k === KEY_USER_EMAIL || k === KEY_AUTH) {
      updateTopbarUI();
    }
  });
})();
