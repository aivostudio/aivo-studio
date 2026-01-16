/* =========================================================
   AUTH UNIFY FIX — aivo_auth_unified_v2 (FINALIZE)
   Amaç:
   - Topbar görünürlük tek otorite: window.__AIVO_SESSION__?.ok
   - Partial/topbar geç gelirse retry ile yakala
   - Legacy localStorage sadece FALLBACK
   - UI kontrolü: html.is-auth / html.is-guest class’ları
   ========================================================= */
(function () {
  "use strict";

  // legacy fallback anahtarlar
  var KEY_LOGGED_IN  = "aivo_logged_in";    // "1" / null
  var KEY_USER_EMAIL = "aivo_user_email";  // "mail@..."
  var KEY_AUTH       = "aivo_auth";        // "1" / null

  function qs(id) { return document.getElementById(id); }

  function readState() {
    // 1) TEK OTORITE: __AIVO_SESSION__ (ok boolean ise kullan)
    try {
      var s = window.__AIVO_SESSION__;
      if (s && typeof s.ok === "boolean") {
        return {
          loggedIn: !!s.ok,
          email: String(s.email || s.user_email || s.userEmail || "").trim()
        };
      }
    } catch (e) {}

    // 2) FALLBACK: localStorage (legacy)
    try {
      var li = localStorage.getItem(KEY_LOGGED_IN);
      var au = localStorage.getItem(KEY_AUTH);
      var em = localStorage.getItem(KEY_USER_EMAIL);
      return {
        loggedIn: (li === "1") || (au === "1"),
        email: String(em || "").trim()
      };
    } catch (e) {
      return { loggedIn: false, email: "" };
    }
  }

  function applyRootClass(isLoggedIn) {
    var root = document.documentElement;
    if (!root) return;
    root.classList.toggle("is-auth", !!isLoggedIn);
    root.classList.toggle("is-guest", !isLoggedIn);
  }

  function fillEmails(email) {
    var val = String(email || "").trim() || "Hesap";
    var email1 = qs("topUserEmail");
    var email2 = qs("topMenuEmail");
    var email3 = qs("umEmail");
    var name1  = qs("topUserName");
    var name2  = qs("umName");
    if (email1) email1.textContent = val;
    if (email2) email2.textContent = val;
    if (email3) email3.textContent = val;
    if (name1 && name1.textContent.trim() === "Hesap") name1.textContent = "Hesap";
    if (name2 && name2.textContent.trim() === "Hesap") name2.textContent = "Hesap";
  }

  function setVisible(el, on) {
    if (!el) return;
    el.hidden = !on;
    // inline display ile “yanlışlıkla açık kalma”yı da bitiriyoruz
    el.style.display = on ? "" : "none";
  }

  function updateTopbarUI() {
    var guest = qs("authGuest");
    var user  = qs("authUser");

    // Topbar henüz inject edilmemiş olabilir
    if (!guest || !user) return false;

    var st = readState();
    applyRootClass(!!st.loggedIn);

    // hem hidden hem display
    setVisible(guest, !st.loggedIn);
    setVisible(user,  !!st.loggedIn);

    fillEmails(st.email);
    return true;
  }

  // PARTIAL/ASYNC için retry
  function boot() {
    var tries = 0;
    var maxTries = 40;   // 4sn
    var intervalMs = 100;

    updateTopbarUI();

    var t = setInterval(function () {
      tries++;
      var ok = updateTopbarUI();
      if (ok || tries >= maxTries) clearInterval(t);
    }, intervalMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // dışarıdan manuel tetik
  window.__AIVO_TOPBAR_REFRESH__ = function () {
    try { updateTopbarUI(); } catch (e) {}
  };

  // başka tab localStorage değiştirirse (fallback dünyası)
  window.addEventListener("storage", function (ev) {
    var k = String((ev && ev.key) || "");
    if (k === KEY_LOGGED_IN || k === KEY_USER_EMAIL || k === KEY_AUTH) {
      updateTopbarUI();
    }
  });
})();
