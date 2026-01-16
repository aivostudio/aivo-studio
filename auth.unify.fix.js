/* =========================================================
   AUTH UNIFY FIX — aivo_auth_unified_v2 (FINAL)
   - Tek otorite: window.__AIVO_SESSION__?.ok
   - Partial/topbar geç gelirse retry ile yakalar
   - User menu toggle (H / profil chip) burada tek yerden yönetilir
   - Legacy localStorage: sadece FALLBACK
   - Public refresh: window.__AIVO_TOPBAR_REFRESH__()
   ========================================================= */
(function () {
  "use strict";

  // legacy fallback anahtarlar (sadece fallback)
  var KEY_LOGGED_IN = "aivo_logged_in";   // "1" / null
  var KEY_USER_EMAIL = "aivo_user_email"; // "mail@..."
  var KEY_AUTH = "aivo_auth";             // "1" / null

  function qs(id) { return document.getElementById(id); }

  function readState() {
    // 1) TEK OTORITE
    try {
      if (window.__AIVO_SESSION__ && typeof window.__AIVO_SESSION__.ok === "boolean") {
        return {
          loggedIn: !!window.__AIVO_SESSION__.ok,
          email: String(
            window.__AIVO_SESSION__.email ||
            window.__AIVO_SESSION__.userEmail ||
            window.__AIVO_SESSION__.user_email ||
            ""
          ).trim()
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

    // senin markup'larda gördüğümüz ID'ler
    var email1 = qs("topUserEmail");
    var email2 = qs("topMenuEmail");
    var email3 = qs("umEmail");

    if (email1) email1.textContent = val;
    if (email2) email2.textContent = val;
    if (email3) email3.textContent = val;
  }

  // -------------------------------
  // USER MENU (H) TOGGLE — minimal
  // -------------------------------
  function setupUserMenu() {
    var btn = qs("btnUserMenuTop");
    var panel = qs("userMenuPanel");
    if (!btn || !panel) return false;

    if (btn.__aivoBound) return true;
    btn.__aivoBound = true;

    function isOpen() {
      return panel.getAttribute("aria-hidden") === "false";
    }

    function open() {
      panel.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      panel.style.display = "block";
    }

    function close() {
      panel.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
      panel.style.display = "none";
    }

    function toggle(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      isOpen() ? close() : open();
    }

    // başlangıç: kapalı garanti
    if (!panel.hasAttribute("aria-hidden")) panel.setAttribute("aria-hidden", "true");
    if (panel.getAttribute("aria-hidden") !== "false") panel.style.display = "none";

    btn.addEventListener("click", toggle);

    // panel dışına tıklayınca kapat
    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    // ESC ile kapat
    document.addEventListener("keydown", function (e) {
      if (e && e.key === "Escape") close();
    });

    return true;
  }

  // -------------------------------
  // TOPBAR UI APPLY
  // -------------------------------
  function updateTopbarUI() {
    var guest = qs("authGuest");
    var user  = qs("authUser");

    // topbar henüz inject edilmediyse
    if (!guest || !user) return false;

    var st = readState();
    applyRootClass(!!st.loggedIn);

    // hidden attribute'ü de yönet (senin markup'ta authUser default hidden)
    guest.hidden = !!st.loggedIn;
    user.hidden  = !st.loggedIn;

    fillEmails(st.email);

    // login değilken açık panel kalmasın
    if (!st.loggedIn) {
      var p = qs("userMenuPanel");
      var b = qs("btnUserMenuTop");
      if (p) { p.setAttribute("aria-hidden", "true"); p.style.display = "none"; }
      if (b) { b.setAttribute("aria-expanded", "false"); }
    }

    // menu handler her sayfada garanti
    setupUserMenu();

    return true;
  }

  // -------------------------------
  // BOOT (partial async için retry)
  // -------------------------------
  function boot() {
    var tries = 0;
    var maxTries = 50;   // 50 * 100ms = 5sn
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

  // dışarıdan elle çağırmak için (test / login/logout sonrası)
  window.__AIVO_TOPBAR_REFRESH__ = function () {
    try { updateTopbarUI(); } catch (e) {}
  };

  // başka tab/sayfada legacy key değişirse (fallback) güncelle
  window.addEventListener("storage", function (ev) {
    var k = String((ev && ev.key) || "");
    if (k === KEY_LOGGED_IN || k === KEY_USER_EMAIL || k === KEY_AUTH) {
      updateTopbarUI();
    }
  });
})();
