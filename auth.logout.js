/* =========================================================
   AIVO — LOGOUT (GLOBAL) v2 (ROBUST)
   - /api/logout çağırır (cookie varsa temizler)
   - localStorage/sessionStorage auth izlerini temizler (asıl çıkış)
   - Event delegation + CAPTURE: include ile gelen DOM’da da çalışır
   - Double-trigger guard
========================================================= */
(function () {
  "use strict";

  // Dosya 2 kez yüklense bile tek kez bağla
  if (window.__AIVO_LOGOUT_BOUND__) return;
  window.__AIVO_LOGOUT_BOUND__ = true;

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  function clearAuthStorage() {
    // Bilinen anahtarlar (MVP + geçmiş denemeler)
    var knownKeys = [
      "aivo_user",
      "aivo_user_v1",
      "aivo_auth",
      "aivo_auth_v1",
      "aivo_session",
      "aivo_session_v1",
      "aivo_after_login",
      "aivo_after_login_v1",
      "aivo_profile_stats_v1",
      "aivo_profile_stats_bk_v1",
      "aivo_settings_v1",
      "aivo_settings_active_tab_v1",
      "aivo_jobs_v1",
      "aivo_jobs_bk_v1"
    ];

    // 1) Önce bilinenleri sil
    safe(function () {
      knownKeys.forEach(function (k) {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    });

    // 2) aivo_* / AIVO_* prefix’li her şeyi sil (asıl garanti)
    function wipeByPrefix(storage, re) {
      safe(function () {
        var keys = [];
        for (var i = 0; i < storage.length; i++) {
          var k = storage.key(i);
          if (k && re.test(k)) keys.push(k);
        }
        keys.forEach(function (k) { storage.removeItem(k); });
      });
    }

    wipeByPrefix(localStorage, /^aivo_/i);
    wipeByPrefix(sessionStorage, /^aivo_/i);

    // 3) Bazı olası auth kalıntıları (çok sık görülen pattern’ler)
    // Not: Çok agresif davranmamak için "contains" ile seçici gidiyoruz.
    safe(function () {
      var extraMatch = function (k) {
        var lk = String(k || "").toLowerCase();
        return (
          lk.includes("auth") ||
          lk.includes("session") ||
          lk.includes("user_email") ||
          lk.includes("after_login") ||
          lk.includes("logged") ||
          lk.includes("token")
        );
      };

      // localStorage
      var ls = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && extraMatch(k)) ls.push(k);
      }
      ls.forEach(function (k) { localStorage.removeItem(k); });

      // sessionStorage
      var ss = [];
      for (var j = 0; j < sessionStorage.length; j++) {
        var kk = sessionStorage.key(j);
        if (kk && extraMatch(kk)) ss.push(kk);
      }
      ss.forEach(function (k) { sessionStorage.removeItem(k); });
    });
  }

  async function callLogoutApi() {
    // Cookie temizliği için credentials şart
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
    } catch (e) {
      // API fail olsa bile local logout çalışmalı
    }
  }

  function hardResetAuthRuntime() {
    safe(function () { window.isLoggedIn = false; });
    safe(function () {
      if (window.AIVO_AUTH && typeof window.AIVO_AUTH.logout === "function") {
        window.AIVO_AUTH.logout();
      }
    });
  }

  function redirectHome() {
    // URL state’i temizle (SPA sync vs. varsa)
    safe(function () { history.replaceState(null, "", "/"); });

    // Cache kırmak istersen:
    // location.assign("/?logout=1&ts=" + Date.now());
    location.assign("/");
  }

  async function doLogout() {
    if (window.__AIVO_LOGOUT_IN_PROGRESS__) return;
    window.__AIVO_LOGOUT_IN_PROGRESS__ = true;

    // 1) server cookie temizliği
    await callLogoutApi();

    // 2) local auth temizliği
    clearAuthStorage();

    // 3) runtime auth reset
    hardResetAuthRuntime();

    // 4) garanti redirect
    redirectHome();
  }

  function findLogoutTarget(ev) {
    if (!ev || !ev.target || !ev.target.closest) return null;

    // Öncelikli ve kesin selector’lar
    var t = ev.target.closest(
      '#btnLogoutTop,' +
      ' [data-action="logout"],' +
      ' [data-auth-action="logout"],' +
      ' [data-logout="1"],' +
      ' button[data-logout],' +
      ' a[data-logout]'
    );
    if (t) return t;

    // Eğer <a href="/"> gibi bir logout linki kullanıldıysa ve metin "Çıkış Yap" ise yakala
    var a = ev.target.closest("a");
    if (a) {
      var txtA = (a.textContent || "").trim();
      if (txtA === "Çıkış Yap") return a;
    }

    // Son çare: buton metni kontrolü
    var b = ev.target.closest("button");
    if (b) {
      var txtB = (b.textContent || "").trim();
      if (txtB === "Çıkış Yap") return b;
    }

    return null;
  }

  // CAPTURE = true: başka script navigation yapmadan önce yakala
  document.addEventListener("click", function (ev) {
    var target = findLogoutTarget(ev);
    if (!target) return;

    ev.preventDefault();
    ev.stopPropagation();
    // Bazı handler’lar stopPropagation’a rağmen çalışabiliyor; capture’da yakaladık.
    doLogout();
  }, true);

})();
