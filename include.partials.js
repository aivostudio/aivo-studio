/* =========================================================
   PARTIALS INCLUDE (TOPBAR) — SIMPLE + SAFE (FINAL)
   ========================================================= */
(function () {
  "use strict";

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function loadAuthUnifyFix() {
    try {
      var already = Array.from(document.scripts || []).some(function (s) {
        return (s.src || "").includes("/auth.unify.fix.js");
      });
      if (already) return;

      var s = document.createElement("script");
      s.src = "/auth.unify.fix.js?v=2"; // cache break
      s.defer = true;
      document.head.appendChild(s);
    } catch (e) {
      console.warn("[partials] auth.unify.fix loader error:", e);
    }
  }

  function refreshAuthUIWithRetry() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (typeof window.__AIVO_TOPBAR_REFRESH__ === "function") {
        try { window.__AIVO_TOPBAR_REFRESH__(); } catch (_) {}
        clearInterval(t);
      }
      if (tries >= 40) clearInterval(t); // max 4s
    }, 100);
  }

  function isIndexPage() {
    var path = window.location.pathname || "/";
    return path === "/" || path === "/index.html";
  }

  function loadIndexProductsExperience() {
    if (!isIndexPage()) return;

    try {
      if (!document.getElementById("aivoIndexProductsPremiumCss")) {
        var link = document.createElement("link");
        link.id = "aivoIndexProductsPremiumCss";
        link.rel = "stylesheet";
        link.href = "/index.products.premium.css?v=20260806_1";
        document.head.appendChild(link);
      }

      var already = Array.from(document.scripts || []).some(function (script) {
        return (script.src || "").includes("/js/index.products.premium.js");
      });

      if (!already) {
        var s = document.createElement("script");
        s.src = "/js/index.products.premium.js?v=20260806_1";
        s.defer = true;
        document.head.appendChild(s);
      }
    } catch (e) {
      console.warn("[partials] index products loader error:", e);
    }
  }

  async function injectTopbar() {
    var mount = qs('[data-include="topbar"]');
    if (!mount) return;

    try {
      var res = await fetch("/partials/topbar.html", { cache: "no-store" });
      if (!res.ok) throw new Error("topbar fetch failed: " + res.status);
      var html = await res.text();
      mount.outerHTML = html;

      // ✅ unify yoksa yükle (gecikmeli gelebilir)
      loadAuthUnifyFix();

      // ✅ topbar geldi sinyali
      document.dispatchEvent(new CustomEvent("aivo:topbar:ready"));

      // ✅ unify hazır olunca refresh (retry ile)
      refreshAuthUIWithRetry();

    } catch (e) {
      console.warn("[partials] topbar inject error:", e);
    }
  }

  function boot() {
    // önce unify’yi çağır (ekler, yüklenmesi async)
    loadAuthUnifyFix();
    // sadece index için premium ürün menüsünü yükle
    loadIndexProductsExperience();
    // sonra topbar’ı bas
    injectTopbar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
