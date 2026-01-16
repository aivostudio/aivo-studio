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

  function redirectToIndexAndLogin() {
    redirectToIndex("");
  }

  function redirectToIndexNotVerified() {
    redirectToIndex("reason=email_not_verified");
  }

  function fetchWithTimeout(url, opts, ms) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { try { ctrl.abort(); } catch(_){} }, ms || 4000);
    return fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}))
      .finally(function () { clearTimeout(t); });
  }

  async function fetchJson(url, opts) {
    var r = await fetchWithTimeout(
      url,
      Object.assign(
        {
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
        opts || {}
      ),
      4000
    );

    var j = {};
    try { j = await r.json(); } catch (_) {}
    return { r: r, j: j };
  }

  async function run() {
    // 1) gerçek session kontrolü (fail-closed: hata/timeout/401 => redirect)
    var me;
    try {
      me = await fetchJson("/api/auth/me");
    } catch (_) {
      redirectToIndexAndLogin();
      return;
    }

    if (!me.r.ok || !me.j || me.j.ok !== true) {
      redirectToIndexAndLogin();
      return;
    }

    // 2) verified kontrolü (endpoint varsa)
    try {
      var v = await fetchJson("/api/auth/verified");
      if (v.r.ok && v.j && v.j.ok === true) {
        if (v.j.verified === false && v.j.unknown === false) {
          // doğrulanmamış -> session'ı da temizle
          try { await fetchJson("/api/auth/logout", { method: "POST" }); } catch (_) {}
          try {
            localStorage.removeItem("aivo_logged_in");
            localStorage.removeItem("aivo_user_email");
            localStorage.removeItem("aivo_token");
          } catch (_) {}
          redirectToIndexNotVerified();
          return;
        }
      }
    } catch (_) {
      // verified endpoint patlarsa studioyu kilitlemeyelim;
      // me zaten OK.
    }

    // 3) OK → unlock + local hint düzelt
    try {
      localStorage.setItem("aivo_logged_in", "1");
      if (me.j && me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
    } catch (_) {}

    unlock(); // ✅ KRİTİK
  }

  run().catch(function () {
    redirectToIndexAndLogin();
  });
})();
