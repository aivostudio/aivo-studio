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
    location.replace(url);
  }

  async function fetchJson(url) {
    var r = await fetch(url, { cache: "no-store", credentials: "include" });
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
    var me = await fetchJson("/api/auth/me");

    // ✅ HARD RULE:
    // Studio'ya girmek için sadece ok:true yetmez.
    // ok:true + email dolu olmalı. (Safari cookie/UI mismatch’i keser)
    var ok = !!(me.r && me.r.ok && me.j && me.j.ok === true);
    var email = me.j && typeof me.j.email === "string" ? me.j.email.trim() : "";

    if (!ok || !email) {
      redirectToIndex(""); // logged-out gibi davran
      return;
    }

    // verified gate (varsa)
    if (me.j.verified === false) {
      redirectToIndex("reason=email_not_verified");
      return;
    }

    // localStorage hint (opsiyonel)
    try {
      localStorage.setItem("aivo_logged_in", "1");
      localStorage.setItem("aivo_user_email", email);
    } catch (_) {}

    safeUnlock();
  }

  run().catch(function () {
    redirectToIndex("");
  });
})();
