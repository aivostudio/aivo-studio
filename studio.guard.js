/* =========================================================
   AIVO — STUDIO GUARD (BROWSER SAFE)
   - Browser-only. NO import/require.
   - Tek otorite: /api/auth/me
   - Logged-out ise: index'e gönder + login açtır
   - Logged-in ise: sayfayı aç
   ========================================================= */

(function () {
  "use strict";

  if (window.__AIVO_STUDIO_GUARD__) return;
  window.__AIVO_STUDIO_GUARD__ = true;

  // lock (flicker engeli)
  var style = document.createElement("style");
  style.textContent = "html{visibility:hidden}";
  document.documentElement.appendChild(style);

  function unlock() {
    try { document.documentElement.style.visibility = ""; } catch (_) {}
    try { style.remove(); } catch (_) {}
  }

  var redirected = false;

  function rememberTarget(url) {
    try { sessionStorage.setItem("aivo_after_login", url); } catch (_) {}
  }

  function goIndex(reason) {
    if (redirected) return;
    redirected = true;

    var target = "/studio.html" + (location.search || "") + (location.hash || "");
    rememberTarget(target);

    try {
      if (window.toast) {
        toast.warning(
          "Giriş gerekli",
          "AIVO Studio’ya devam etmek için giriş yapmalısın."
        );
      }
    } catch (_) {}

    var url = "/?auth=1";
    if (reason) url += "&reason=" + encodeURIComponent(reason);

    location.replace(url);
  }

  function fetchMe() {
    return fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (_) {}
        return { r: r, j: j, raw: t };
      });
    });
  }

  fetchMe().then(function (me) {
    // Session yok -> index/login
    if (!me.r.ok || !me.j || me.j.ok !== true) {
      goIndex("login_required");
      return;
    }

    // Session var -> studio aç
    try {
      localStorage.setItem("aivo_logged_in", "1");
      if (me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
    } catch (_) {}

    unlock();
  }).catch(function () {
    // Her hata -> güvenli tarafta login'e
    goIndex("login_required");
  });
})();
