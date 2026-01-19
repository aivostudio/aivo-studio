/* =========================================================
   AUTH UNIFY FIX — aivo_auth_unified_v3.1 (TEK OTORİTE)
   - Tek otorite: window.__AIVO_SESSION__?.ok (boolean)
   - ok false ise de TEK OTORİTE kabul edilir (fallback'a kaçmaz)
   - Session geç set edilirse: aivo:session:ready ile refresh
   - Partial topbar geç gelirse: event + retry
   - Menü toggle + logout click garanti (capture + direct bind)
   - html class: aivoAuthPreload -> (kaldır) + is-auth / is-guest
   ========================================================= */
(function () {
  "use strict";

  // legacy fallback (sadece __AIVO_SESSION__ yoksa)
  var KEY_LOGGED_IN  = "aivo_logged_in";   // "1"
  var KEY_USER_EMAIL = "aivo_user_email"; // "mail@..."
  var KEY_AUTH       = "aivo_auth";       // "1"

  function qs(id) { return document.getElementById(id); }

  function getSessionState() {
    // 1) TEK OTORITE: ok boolean ise (true/false) HER ZAMAN bunu kullan
    try {
      var s = window.__AIVO_SESSION__;
      if (s && typeof s.ok === "boolean") {
        return {
          loggedIn: !!s.ok,
          email: String(s.email || s.userEmail || s.user_email || "").trim()
        };
      }
    } catch (e) {}

    // 2) Fallback: legacy localStorage (SADECE __AIVO_SESSION__ yoksa)
    try {
      var li = localStorage.getItem(KEY_LOGGED_IN);
      var au = localStorage.getItem(KEY_AUTH);
      var em = localStorage.getItem(KEY_USER_EMAIL);
      return {
        loggedIn: (li === "1") || (au === "1"),
        email: String(em || "").trim()
      };
    } catch (e2) {
      return { loggedIn: false, email: "" };
    }
  }

  function applyRootClass(isLoggedIn) {
    var root = document.documentElement;
    if (!root) return;

    // preload kalksın (topbar gelsin/gelmesin)
    root.classList.remove("aivoAuthPreload");

    root.classList.toggle("is-auth", !!isLoggedIn);
    root.classList.toggle("is-guest", !isLoggedIn);
  }

  function fillEmailUI(email) {
    var val = String(email || "").trim() || "Hesap";
    var ids = ["topUserEmail", "topMenuEmail", "umEmail", "topUserName", "umName"];
    for (var i = 0; i < ids.length; i++) {
      var el = qs(ids[i]);
      if (el) el.textContent = val;
    }
  }

  // ✅ authUser açıldığında kredi alanı DOM’da varsa dokunma; yoksa “varmış gibi” bırakma.
  // (HTML’de zaten var, bu sadece yanlışlıkla silinirse UI dağılmasın diye)
  function ensureTopCreditsArea() {
    var user = qs("authUser");
    if (!user) return;
    var exists = qs("topCredits");
    if (exists) return;

    // minimal safe inject
    var wrap = document.createElement("div");
    wrap.id = "topCredits";
    wrap.className = "top-credits";
    wrap.innerHTML =
      '<div class="credit-pill credit-pill--static" title="Kredi bakiyesi">Kredi <strong id="topCreditCount">0</strong></div>' +
      '<a href="/fiyatlandirma.html#packs" class="btn btn-ghost btn-credit-buy">Kredi Al</a>';
    user.insertBefore(wrap, user.firstChild);
  }

  function updateTopbarUI() {
    // ✅ root state her zaman uygula
    var st0 = getSessionState();
    applyRootClass(st0.loggedIn);

    var guest = qs("authGuest");
    var user  = qs("authUser");

    // Topbar henüz yoksa burada dur
    if (!guest || !user) return false;

    var st = st0;

    // hidden attribute güvenliği
    guest.hidden = !!st.loggedIn;
    user.hidden  = !st.loggedIn;

    if (st.loggedIn) ensureTopCreditsArea();
    fillEmailUI(st.email);

    return true;
  }

  // ===== MENU TOGGLE (garanti) =====
  function setupUserMenu() {
    var btn = qs("btnUserMenuTop");
    var panel = qs("userMenuPanel");

    if (!btn || !panel) return false;
    if (btn.__aivoBound) return true;
    btn.__aivoBound = true;

    function isOpen() {
      return panel.style.display === "block" || panel.getAttribute("aria-hidden") === "false";
    }
    function open() {
      panel.style.display = "block";
      panel.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
    }
    function close() {
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
    }
    function toggle() { isOpen() ? close() : open(); }

    if (!panel.getAttribute("aria-hidden")) panel.setAttribute("aria-hidden", "true");

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }, true);

    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      var t = e.target;
      if (!t) return;
      if (t.closest && (t.closest("#userMenuPanel") || t.closest("#btnUserMenuTop"))) return;
      close();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e && e.key === "Escape") close();
    }, true);

    return true;
  }

  // ===== LOGOUT (garanti) =====
  function setupLogoutHandler() {
    if (document.__aivoLogoutBound) return true;
    document.__aivoLogoutBound = true;

    document.addEventListener("click", function (e) {
      var t = e && e.target;
      if (!t || !t.closest) return;

      var btn = t.closest("#btnLogoutTop, #btnLogoutUnified, [data-action='logout']");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      var redirectTo = btn.getAttribute("data-redirect") || btn.getAttribute("data-redirect-to") || "/";

      if (typeof window.doLogout === "function") {
        window.doLogout(redirectTo);
        return;
      }

      (async function(){
        try {
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch (err) {}

        try { window.__AIVO_SESSION__ = { ok:false }; } catch(e2){}
        try { localStorage.removeItem(KEY_LOGGED_IN); } catch(e3){}
        try { localStorage.removeItem(KEY_USER_EMAIL); } catch(e4){}
        try { localStorage.removeItem(KEY_AUTH); } catch(e5){}

        try { updateTopbarUI(); } catch(e6){}
        location.replace(redirectTo);
      })();
    }, true);

    return true;
  }

  // ===== BOOT + RETRY =====
  function boot() {
    setupLogoutHandler();

    // ilk anda state uygula
    updateTopbarUI();

    // topbar inject gecikirse yakala (maks 4sn)
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ok = updateTopbarUI();
      setupUserMenu();
      if (ok || tries >= 40) clearInterval(t);
    }, 100);

    setTimeout(function(){ try{ updateTopbarUI(); setupUserMenu(); }catch(e){} }, 300);
    setTimeout(function(){ try{ updateTopbarUI(); setupUserMenu(); }catch(e){} }, 900);
  }

  // ✅ include.partials vs. async session: ikisini de dinle
  document.addEventListener("aivo:topbar:ready", function () {
    try { updateTopbarUI(); } catch(e){}
    try { setupUserMenu(); } catch(e2){}
  });

  // ✅ HARD GATE 200’de session set edince bunu atacağız:
  // document.dispatchEvent(new Event("aivo:session:ready"))
  document.addEventListener("aivo:session:ready", function () {
    try { updateTopbarUI(); } catch(e){}
    try { setupUserMenu(); } catch(e2){}
  });

  window.addEventListener("load", function(){
    try { updateTopbarUI(); } catch(e){}
    try { setupUserMenu(); } catch(e2){}
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__AIVO_TOPBAR_REFRESH__ = function () {
    try { updateTopbarUI(); } catch(e){}
    try { setupUserMenu(); } catch(e2){}
  };

  window.addEventListener("storage", function (ev) {
    var k = String((ev && ev.key) || "");
    if (k === KEY_LOGGED_IN || k === KEY_USER_EMAIL || k === KEY_AUTH) {
      updateTopbarUI();
    }
  });
})();
// ===============================
// USER MENU — HOVER AUTO OPEN (REVIZE)
// ===============================
(function () {
  const OPEN_DELAY  = 80;
  const CLOSE_DELAY = 180;

  let openTimer = null;
  let closeTimer = null;

  function clearTimers() {
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  }

  function getWrap()  { return document.getElementById("userMenuWrap"); }
  function getBtn(w)  { return w ? w.querySelector("#btnUserMenuTop") : null; }
  function getPanel(w){ return w ? w.querySelector("#userMenuPanel") : null; }

  // ✅ Senin FINAL bloğunla aynı davranış: hidden + aria + class
  function setOpen(wrap, open) {
    const btn = getBtn(wrap);
    const panel = getPanel(wrap);
    if (!btn || !panel) return;

    if (open) {
      panel.hidden = false;
      panel.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      panel.classList.add("is-open");
    } else {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
      panel.classList.remove("is-open");
    }
  }

  // ✅ Touch cihazlarda hover açılmasın (iPad’de mouse varsa yine çalışır)
  const canHover = (() => {
    try { return window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches; }
    catch (e) { return true; }
  })();
  if (!canHover) return;

  const wrap = getWrap();
  if (!wrap) return;

  // Hover ile aç/kapat
  wrap.addEventListener("mouseenter", () => {
    clearTimers();
    openTimer = setTimeout(() => setOpen(wrap, true), OPEN_DELAY);
  }, true);

  wrap.addEventListener("mouseleave", () => {
    clearTimers();
    closeTimer = setTimeout(() => setOpen(wrap, false), CLOSE_DELAY);
  }, true);

  // Güvenlik: panel içindeyken kapanmasın
  const panel = getPanel(wrap);
  if (panel) {
    panel.addEventListener("mouseenter", () => {
      clearTimers();
      setOpen(wrap, true);
    }, true);
  }

  // Sayfada click/escape/outside close varsa hover timer’ları bozmasın
  document.addEventListener("pointerdown", (e) => {
    if (!wrap.contains(e.target)) clearTimers();
  }, true);

})();
