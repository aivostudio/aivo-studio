(function () {
  "use strict";

  // ✅ HARD GUARD (dosya 2 kez yüklense bile sadece 1 kere çalışır)
  if (window.__AIVO_INDEX_AUTH_LOADED__) {
    console.warn("[AIVO] index.auth.js already loaded — hard skip");
    return;
  }
  window.__AIVO_INDEX_AUTH_LOADED__ = true;

  console.log("[AIVO] index.auth.js LOADED ✅", new Date().toISOString());

  // ✅ Demo auth (duplicate-safe)
  var DEMO_AUTH = (window.DEMO_AUTH = window.DEMO_AUTH || {
    email: "harunerkezen@gmail.com",
    pass: "123456",
  });

  // ✅ Keys (tek kaynak)
  var TARGET_KEY = "aivo_after_login";
  var LOGIN_KEY = "aivo_logged_in";
  var EMAIL_KEY = "aivo_user_email";

  // ✅ Logout’ta SADECE auth temizlenecek (store/fatura ASLA silinmez)
  var AUTH_KEYS_TO_CLEAR = [
    "aivo_logged_in",
    "aivo_user_email",
    "aivo_auth",
    "aivo_token",
    "aivo_user",
  ];
  var SESSION_KEYS_TO_CLEAR = ["__AIVO_FORCE_LOGOUT__", "aivo_auth_target"];

  /* =========================
     AUTH STATE
     ========================= */
  function isLoggedIn() {
    try {
      return localStorage.getItem(LOGIN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }
  function setLoggedIn(v) {
    try {
      localStorage.setItem(LOGIN_KEY, v ? "1" : "0");
    } catch (_) {}
  }

  /* =========================
     MODAL FINDER
     ========================= */
  function getModalEl() {
    return (
      document.getElementById("loginModal") ||
      document.getElementById("authModal") ||
      document.querySelector('[data-modal="login"]') ||
      document.querySelector(".login-modal") ||
      null
    );
  }

  function openModal(mode /* "login" | "register" */) {
    var m = getModalEl();
    if (!m) {
      console.warn(
        "[AIVO] Login modal bulunamadı. (#loginModal/#authModal/[data-modal='login']/.login-modal)"
      );
      return;
    }
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    m.setAttribute("data-mode", mode === "register" ? "register" : "login");
    document.body.classList.add("modal-open");

    setTimeout(function () {
      var email =
        document.getElementById("loginEmail") ||
        m.querySelector('input[type="email"]');
      if (email && typeof email.focus === "function") email.focus();
    }, 30);
  }

  function closeModal() {
    var m = getModalEl();
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  /* =========================
     TARGET / REDIRECT
     ========================= */
  function normalizeStudio(url) {
    var u = String(url || "/studio.html").trim();
    if (u.indexOf("/studio") !== -1) return "/studio.html";
    return u;
  }

  function rememberTargetFromAnchor(a) {
    try {
      var u = new URL(a.href, location.origin);
      if (u.origin !== location.origin) return;
      sessionStorage.setItem(TARGET_KEY, u.pathname + u.search + u.hash);
    } catch (_) {}
  }

  function rememberTarget(url) {
    try {
      sessionStorage.setItem(TARGET_KEY, url || "/studio.html");
    } catch (_) {}
  }

  function goAfterLogin() {
    var raw = "/studio.html";
    try {
      raw = sessionStorage.getItem(TARGET_KEY) || "/studio.html";
      sessionStorage.removeItem(TARGET_KEY);
    } catch (_) {}
    location.href = normalizeStudio(raw);
  }

  /* =========================
     TOPBAR UI SYNC
     ========================= */
  function syncTopbarAuthUI() {
    var guestBox =
      document.getElementById("authGuest") || document.querySelector(".auth-guest");
    var userBox =
      document.getElementById("authUser") || document.querySelector(".auth-user");
    var emailEl = document.getElementById("topUserEmail");
    var loggedIn = isLoggedIn();

    if (guestBox) guestBox.style.display = loggedIn ? "none" : "flex";
    if (userBox) userBox.style.display = loggedIn ? "flex" : "none";
    if (emailEl) {
      var em = "";
      try {
        em = loggedIn ? localStorage.getItem(EMAIL_KEY) || "" : "";
      } catch (_) {}
      emailEl.textContent = em;
    }
  }

  /* =========================
     LOGOUT (global)
     ========================= */
  window.AIVO_LOGOUT = function () {
    try {
      AUTH_KEYS_TO_CLEAR.forEach(function (k) {
        try {
          localStorage.removeItem(k);
        } catch (_) {}
      });
      SESSION_KEYS_TO_CLEAR.forEach(function (k) {
        try {
          sessionStorage.removeItem(k);
        } catch (_) {}
      });
    } catch (_) {}

    try {
      syncTopbarAuthUI();
    } catch (_) {}

    location.href = "/";
  };

  /* =========================
     DOM READY
     ========================= */
  document.addEventListener("DOMContentLoaded", function () {
    // ✅ Studio logout handshake
    try {
      if (sessionStorage.getItem("__AIVO_FORCE_LOGOUT__") === "1") {
        AUTH_KEYS_TO_CLEAR.forEach(function (k) {
          try {
            localStorage.removeItem(k);
          } catch (_) {}
        });
        try {
          sessionStorage.removeItem("__AIVO_FORCE_LOGOUT__");
        } catch (_) {}
      }
    } catch (_) {}

    try {
      syncTopbarAuthUI();
    } catch (_) {}
  });

  /* =========================
     CLICK ROUTER (tek yerden)
     ========================= */
  document.addEventListener("click", function (e) {
    var t = e.target;

    // Topbar: login/register
    var loginTop = t && t.closest ? t.closest("#btnLoginTop") : null;
    if (loginTop) {
      e.preventDefault();
      openModal("login");
      return;
    }

    var regTop = t && t.closest ? t.closest("#btnRegisterTop") : null;
    if (regTop) {
      e.preventDefault();
      openModal("register");
      return;
    }

    // Logout
    var logout = t && t.closest ? t.closest("#btnLogoutTop, [data-action='logout'], .logout") : null;
    if (logout) {
      e.preventDefault();
      window.AIVO_LOGOUT();
      return;
    }

    // Gate: data-auth required link
    var a = t && t.closest ? t.closest('a[data-auth="required"]') : null;
    if (a) {
      if (isLoggedIn()) return;
      e.preventDefault();
      rememberTargetFromAnchor(a);
      openModal("login");
      return;
    }

    // Modal close (X / backdrop / data-close)
    var m = getModalEl();
    if (m) {
      var isBackdrop =
        t === m ||
        (t && t.classList && t.classList.contains("login-backdrop")) ||
        (t && t.closest && t.closest(".login-backdrop"));

      var isClose =
        (t && t.closest && t.closest(".login-x")) ||
        (t && t.closest && t.closest(".modal-close")) ||
        (t && t.closest && t.closest("[data-close]"));

      if (isBackdrop || isClose) {
        e.preventDefault();
        closeModal();
        return;
      }
    }
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  /* =========================
     DEMO LOGIN
     ========================= */
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("#btnLogin") : null;
    if (!btn) return;

    var m = getModalEl();
    if (!m) return;

    e.preventDefault();

    var email =
      (document.getElementById("loginEmail") &&
        document.getElementById("loginEmail").value) ||
      (m.querySelector('input[type="email"]') &&
        m.querySelector('input[type="email"]').value) ||
      "";
    email = String(email).trim().toLowerCase();

    var pass =
      (document.getElementById("loginPass") &&
        document.getElementById("loginPass").value) ||
      (m.querySelector('input[type="password"]') &&
        m.querySelector('input[type="password"]').value) ||
      "";
    pass = String(pass).trim();

    if (email === DEMO_AUTH.email && pass === DEMO_AUTH.pass) {
      setLoggedIn(true);
      try {
        localStorage.setItem(EMAIL_KEY, email);
      } catch (_) {}
      syncTopbarAuthUI();
      closeModal();
      goAfterLogin();
      return;
    }

    alert("E-posta veya şifre hatalı (demo).");
  });

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("#btnGoogleLogin") : null;
    if (!btn) return;
    e.preventDefault();
    setLoggedIn(true);
    try {
      localStorage.setItem(EMAIL_KEY, "google-user@demo");
    } catch (_) {}
    syncTopbarAuthUI();
    closeModal();
    goAfterLogin();
  });

  /* =========================
     EXPORTS (studio.guard.js)
     ========================= */
  window.isLoggedIn = isLoggedIn;
  window.openLoginModal = function () {
    openModal("login");
  };
  window.rememberTarget = function (url) {
    rememberTarget(url);
  };
})();
