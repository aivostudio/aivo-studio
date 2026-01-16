/* =========================================================
   AUTH UNIFY FIX — aivo_auth_unified_FINAL
   ========================================================= */
(function () {
  "use strict";

  var KEY_LOGGED_IN = "aivo_logged_in";
  var KEY_USER_EMAIL = "aivo_user_email";
  var KEY_AUTH = "aivo_auth";

  function qs(id){ return document.getElementById(id); }

  function getState(){
    try {
      if (window.__AIVO_SESSION__ && typeof window.__AIVO_SESSION__.ok === "boolean") {
        return {
          loggedIn: window.__AIVO_SESSION__.ok,
          email: String(window.__AIVO_SESSION__.email || "").trim()
        };
      }
    } catch(e){}

    try {
      return {
        loggedIn:
          localStorage.getItem(KEY_LOGGED_IN) === "1" ||
          localStorage.getItem(KEY_AUTH) === "1",
        email: String(localStorage.getItem(KEY_USER_EMAIL) || "").trim()
      };
    } catch(e){
      return { loggedIn:false, email:"" };
    }
  }

  function applyRoot(loggedIn){
    var root = document.documentElement;
    if (!root) return;

    root.classList.remove("aivoAuthPreload");
    root.classList.toggle("is-auth", loggedIn);
    root.classList.toggle("is-guest", !loggedIn);
  }

  function fillEmail(email){
    var v = email || "Hesap";
    ["topUserEmail","topMenuEmail","umEmail"].forEach(function(id){
      var el = qs(id);
      if (el) el.textContent = v;
    });
  }

  function update(){
    var guest = qs("authGuest");
    var user  = qs("authUser");
    if (!guest || !user) return false;

    var st = getState();

    applyRoot(st.loggedIn);
    guest.hidden = st.loggedIn;
    user.hidden  = !st.loggedIn;
    fillEmail(st.email);

    return true;
  }

  function boot(){
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if (update() || tries > 40) clearInterval(t);
    }, 100);
    update();
  }

  document.addEventListener("DOMContentLoaded", boot);
  document.addEventListener("aivo:topbar:ready", update);

  window.__AIVO_TOPBAR_REFRESH__ = function(){
    try { update(); } catch(e){}
  };

})();
// ===============================
// USER MENU TOGGLE (CAPTURE, tek otorite)
// ===============================
(function bindUserMenuGlobal(){
  function getEls(){
    return {
      btn: document.getElementById("btnUserMenuTop"),
      panel: document.getElementById("userMenuPanel")
    };
  }

  function open(panel, btn){
    if (!panel) return;
    panel.setAttribute("aria-hidden", "false");
    panel.style.display = "block";
    if (btn) btn.setAttribute("aria-expanded", "true");
  }

  function close(panel, btn){
    if (!panel) return;
    panel.setAttribute("aria-hidden", "true");
    panel.style.display = "";
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function toggle(){
    var els = getEls();
    if (!els.btn || !els.panel) return false;
    var isHidden = els.panel.getAttribute("aria-hidden") !== "false";
    if (isHidden) open(els.panel, els.btn);
    else close(els.panel, els.btn);
    return true;
  }

  // capture: başka script stopPropagation yapsa bile önce biz yakalayalım
  document.addEventListener("click", function(e){
    var t = e.target;
    if (!t) return;

    // btn click
    if (t.closest && t.closest("#btnUserMenuTop")) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }

    // panel dışına tıkla -> kapat
    var els = getEls();
    if (!els.panel || !els.btn) return;
    var isOpen = els.panel.getAttribute("aria-hidden") === "false";
    if (!isOpen) return;

    var clickedInside = t.closest && (t.closest("#userMenuPanel") || t.closest("#btnUserMenuTop"));
    if (!clickedInside) close(els.panel, els.btn);
  }, true);

  // ESC -> kapat
  document.addEventListener("keydown", function(e){
    if (e.key !== "Escape") return;
    var els = getEls();
    if (!els.panel) return;
    close(els.panel, els.btn);
  });

  // logout delegation (capture)
  document.addEventListener("click", function(e){
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest("#btnLogoutTop, [data-action='logout']");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    var redirectTo = btn.getAttribute("data-redirect") || "/";
    if (typeof window.doLogout === "function") {
      window.doLogout(redirectTo);
      return;
    }

    // fallback
    (async function(){
      try { await fetch("/api/auth/logout", { method:"POST", credentials:"include" }); } catch(e){}
      try { window.__AIVO_SESSION__ = { ok:false }; } catch(e){}
      try { localStorage.removeItem("aivo_logged_in"); } catch(e){}
      try { localStorage.removeItem("aivo_user_email"); } catch(e){}
      try { localStorage.removeItem("aivo_auth"); } catch(e){}
      location.replace(redirectTo);
    })();
  }, true);
})();
