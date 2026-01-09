/* =========================================================
   AIVO — SINGLE LOGOUT (ONE SOURCE OF TRUTH)
   - Clears client auth (localStorage/sessionStorage)
   - Calls /api/logout (cookie/session cleanup for future backend)
   - Updates UI if your auth script exposes a refresh() / rem() function
   - Redirects to "/"
   ========================================================= */
(function AIVO_SingleLogout(){
  "use strict";

  if (window.__AIVO_SINGLE_LOGOUT_BOUND__) return;
  window.__AIVO_SINGLE_LOGOUT_BOUND__ = true;

  // ✅ Buraya, senin projede login state’i tuttuğun gerçek key’leri yaz.
  // (Aşağıdakiler “güvenli geniş temizlik” — zarar vermez, sadece auth state’i sıfırlar.)
  var LS_KEYS = [
    "aivo_user",
    "aivo_user_v1",
    "aivo_auth",
    "aivo_auth_v1",
    "aivo_session",
    "aivo_session_v1",
    "aivo_after_login",
    "aivo_after_login_v1",
    "aivo_remember_me",
    "aivo_remember_me_v1"
  ];

  function safeRemoveStorage(){
    try {
      LS_KEYS.forEach(function(k){
        try { localStorage.removeItem(k); } catch(e){}
        try { sessionStorage.removeItem(k); } catch(e){}
      });

      // Bazı sistemlerde “token/email” ayrı tutulur — bunlar varsa temizler:
      try { localStorage.removeItem("token"); } catch(e){}
      try { sessionStorage.removeItem("token"); } catch(e){}
      try { localStorage.removeItem("user"); } catch(e){}
      try { sessionStorage.removeItem("user"); } catch(e){}
      try { localStorage.removeItem("email"); } catch(e){}
      try { sessionStorage.removeItem("email"); } catch(e){}
    } catch(e){}
  }

  async function hitBackendLogout(){
    // Cookie temizliği için: credentials: "include" şart
    // Bazı ortamlarda GET de çalışır; önce POST deniyoruz.
    try {
      var res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
      // POST route yoksa 405/404 alabilirsin; GET’e düş.
      if (!res || (res.status >= 400 && res.status !== 404)) return;
    } catch(e) {}

    try {
      await fetch("/api/logout", { method: "GET", credentials: "include" });
    } catch(e) {}
  }

  async function doLogout(){
    // 1) client auth state’i kesin temizle
    safeRemoveStorage();

    // 2) backend logout (şu an cookie için; ileride gerçek session’a geçince kritik)
    await hitBackendLogout();

    // 3) UI refresh: projende varsa çağır
    try {
      if (typeof window.rem === "function") window.rem(); // senin notlarında vardı
    } catch(e) {}
    try {
      if (typeof window.refreshAuthUI === "function") window.refreshAuthUI();
    } catch(e) {}

    // 4) Menü açık kaldıysa kapatmak için (varsa)
    try {
      document.documentElement.classList.remove("menu-open");
      var p = document.getElementById("userMenuPanel");
      if (p) { p.style.display = "none"; p.classList.remove("is-open"); p.setAttribute("aria-hidden","true"); }
      var w = document.getElementById("userMenuWrap");
      if (w) w.classList.remove("is-open");
    } catch(e) {}

    // 5) Ana sayfaya dön
    try { window.location.href = "/"; } catch(e) { window.location.reload(); }
  }

  // ✅ Tek bir yakalama: ID’ler farklı olsa bile çalışsın diye
  // - #btnLogoutTop (senin DOM’da görünüyor)
  // - [data-action="logout"] (ileride temiz kullanım)
  // - .um-logout (dropdown item)
  document.addEventListener("click", function(ev){
    var t = ev.target;

    // span’a tıklanınca parent button’u bulmak için:
    var btn =
      (t && t.closest) ? t.closest('#btnLogoutTop, #btnLogout, #btnLogoutPricing, [data-action="logout"], .um-logout') : null;

    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();
    doLogout();
  }, true);

})();
