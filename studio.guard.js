/* =========================================================
   AIVO — STUDIO GUARD (MINIMAL + VERIFIED GATE)
   - index.auth.js exportlarına dayanır:
       window.rememberTarget
   - Studio'da:
       1) /api/auth/me ile gerçek session var mı kontrol eder
       2) /api/auth/verified ile email verified mı kontrol eder
       3) yoksa / unverified ise: index'e gönderir, hedefi saklar
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
    // index.auth.js bu paramı okuyup uyarı gösterebilir
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
    try {
      j = await r.json();
    } catch (_) {}
    return { r: r, j: j };
  }

  async function run() {
    // 0) hızlı hint: localStorage yoksa bile yine de me() ile doğrulayacağız
    // (bazı senaryolarda localStorage senkron değil)
    // Ama localStorage yoksa ve me de yoksa hızlıca redirect.
    var hintLoggedIn = false;
    try {
      hintLoggedIn = localStorage.getItem("aivo_logged_in") === "1";
    } catch (_) {}

    // 1) gerçek session kontrolü
    var me = await fetchJson("/api/auth/me");
    if (!me.r.ok || !me.j || me.j.ok !== true) {
      // login yok
      // localStorage "1" olsa bile cookie yoksa içeri alma
      redirectToIndexAndLogin();
      return;
    }

    // 2) verified kontrolü (unknown ise burada bloklamıyoruz)
    var v = await fetchJson("/api/auth/verified");
    if (v.r.ok && v.j && v.j.ok === true) {
      if (v.j.verified === false && v.j.unknown === false) {
        // doğrulanmamış -> session'ı da temizleyelim
        try {
          await fetchJson("/api/auth/logout", { method: "POST" });
        } catch (_) {}
        try {
          localStorage.removeItem("aivo_logged_in");
          localStorage.removeItem("aivo_user_email");
          localStorage.removeItem("aivo_token");
        } catch (_) {}

        redirectToIndexNotVerified();
        return;
      }
    }

    // 3) buraya geldiysek session var + (verified true veya unknown)
    // hiçbir şey yapma, Studio devam etsin.
    // İstersen localStorage hint'i de düzelt:
    try {
      localStorage.setItem("aivo_logged_in", "1");
      if (me.j && me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
    } catch (_) {}

    return;
  }

  // Guard'ı ASAP çalıştır
  // (render flicker'ını azaltır)
  run().catch(function () {
    // beklenmedik hata -> güvenli tarafta kal
    redirectToIndexAndLogin();
  });
})();
