// ✅ Sayfayı anında kilitle (render flicker + logout içerik sızıntısı engeli)
var __guardStyle = document.createElement("style");
__guardStyle.textContent = "html{visibility:hidden}";
document.documentElement.appendChild(__guardStyle);

function unlock() {
  try { document.documentElement.style.visibility = ""; } catch(_){}
  try { __guardStyle.remove(); } catch(_){}
}

(function () {
  "use strict";
  if (window.__AIVO_STUDIO_GUARD__) return;
  window.__AIVO_STUDIO_GUARD__ = true;

  function rememberTarget(url) {
    try {
      if (typeof window.rememberTarget === "function") {
        window.rememberTarget(url);
        return;
      }
      sessionStorage.setItem("aivo_after_login", url);
    } catch (_) {}
  }

  function redirectToIndex(params) {
    var target = "/studio.html" + (location.search || "") + (location.hash || "");
    rememberTarget(target);
    var url = "/?auth=1" + (params ? "&" + params : "");
    location.replace(url);
  }

  async function fetchJson(url, opts) {
    var r = await fetch(
      url,
      Object.assign(
        {
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
        opts || {}
      )
    );
    var j = {};
    try { j = await r.json(); } catch (_) {}
    return { r: r, j: j };
  }

  async function run() {
    // 1) gerçek session kontrolü
    var me = await fetchJson("/api/auth/me");
    if (!me.r.ok || !me.j || me.j.ok !== true) {
      redirectToIndex(""); // login yok -> çık
      return;
    }

    // 2) verified kontrolü (varsa)
    var v = await fetchJson("/api/auth/verified");
    if (v.r.ok && v.j && v.j.ok === true) {
      if (v.j.verified === false && v.j.unknown === false) {
        try { await fetchJson("/api/auth/logout", { method: "POST" }); } catch (_) {}
        try {
          localStorage.removeItem("aivo_logged_in");
          localStorage.removeItem("aivo_user_email");
          localStorage.removeItem("aivo_token");
        } catch (_) {}
        redirectToIndex("reason=email_not_verified");
        return;
      }
    }

    // ✅ buraya geldiysek giriş var -> görünür yap
    try {
      localStorage.setItem("aivo_logged_in", "1");
      if (me.j && me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
    } catch (_) {}

    unlock();
  }

  run().catch(function () {
    redirectToIndex("");
  });
})();
