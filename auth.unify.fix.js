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
