// ✅ Sayfayı anında kilitle (render flicker + logout içerik sızıntısı engeli)
var __guardStyle = document.createElement("style");
__guardStyle.textContent = "html{visibility:hidden}";
document.documentElement.appendChild(__guardStyle);

function unlock() {
  try { document.documentElement.style.visibility = ""; } catch(_){}
  try { __guardStyle.remove(); } catch(_){}
}

/* =========================================================
   AIVO — STUDIO GUARD (MINIMAL + VERIFIED GATE)  ✅ REVIZE
   - Studio'da:
       1) /api/auth/me ile gerçek session var mı kontrol eder
       2) /api/auth/verified ile email verified mı kontrol eder
       3) yoksa / unverified ise: index'e gönderir, hedefi saklar
   - ✅ En kritik düzeltme: Studio'da kalınırsa unlock() mutlaka çağrılır
   ========================================================= */
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

    // index'e gidince modal açsın + mesaj türü taşıyalım
    var url = "/?auth=1" + (params ? "&" + params : "");
    location.replace(url);
  }

  function redirectToIndexAndLogin() {
    redirectToIndex("");
  }

  function redirectToIndexNotVerified() {
    redirectToIndex("reason=email_not_verified");
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
      // login yok
      redirectToIndexAndLogin();
      return;
    }

    // 2) verified kontrolü (unknown ise bloklama yok)
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

    // 3) session var + (verified true veya unknown)
    // localStorage hint'i düzelt (opsiyonel)
    try {
      localStorage.setItem("aivo_logged_in", "1");
      if (me.j && me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
    } catch (_) {}

    // ✅ Studio'da kalıyoruz -> kilidi aç
    unlock();
  }

  // Guard'ı ASAP çalıştır
  run()
    .catch(function () {
      // beklenmedik hata -> güvenli tarafta kal
      redirectToIndexAndLogin();
    })
    .finally(function () {
      // ✅ Redirect başlamadıysa ve herhangi bir nedenle unlock kaçtıysa
      // (ör: unlock içinde hata, ya da run() erken return etmediği halde)
      // güvenli şekilde tekrar dene.
      try { unlock(); } catch (_) {}
    });
})();
