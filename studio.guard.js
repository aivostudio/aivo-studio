// ✅ Sayfayı anında kilitle (render flicker engeli)
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

  var redirected = false;
  var unlocked = false;

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
    if (redirected) return;
    redirected = true;

    var target = "/studio.html" + (location.search || "") + (location.hash || "");
    rememberTarget(target);

    var url = "/?auth=1" + (params ? "&" + params : "");
    // Redirect varsa UNLOCK YOK (flicker/sızıntı istemiyoruz)
    location.replace(url);
  }

  async function fetchJson(url, opts) {
    var r = await fetch(
      url,
      Object.assign(
        {
          cache: "no-store",
          credentials: "include"
          // Content-Type header GET'te şart değil; CORS/caching edge-case azaltır
        },
        opts || {}
      )
    );
    var j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    return { r: r, j: j };
  }

  function safeUnlock() {
    if (unlocked || redirected) return;
    unlocked = true;
    unlock();
  }

  async function run() {
    // 1) gerçek session kontrolü (TEK OTORİTE)
    var me = await fetchJson("/api/auth/me");
    if (!me.r.ok || !me.j || me.j.ok !== true) {
      redirectToIndex(""); // logged-out
      return;
    }

    // 2) verified kontrolü (FAIL-OPEN)
    // 401 / invalid_session / parse error -> kesinlikle logout/redirect yok
    try {
      var v = await fetchJson("/api/auth/verified");

      // Sadece "200 + ok:true + verified:false + unknown:false" ise engelle
      if (v.r.ok && v.j && v.j.ok === true) {
        if (v.j.verified === false && v.j.unknown === false) {
          // burada logout YOK (race yapıyor). Sadece index'e reason ile gönder.
          redirectToIndex("reason=email_not_verified");
          return;
        }
      }
    } catch (_) {
      // verified kontrolü patlarsa: fail-open
    }

    // 3) Studio'da kal -> kilidi aç (tek sefer)
    try {
      localStorage.setItem("aivo_logged_in", "1");
      if (me.j && me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
    } catch (_) {}

    safeUnlock();
  }

  run().catch(function () {
    // beklenmedik hata -> login'e gönder
    redirectToIndex("");
  });
})();
