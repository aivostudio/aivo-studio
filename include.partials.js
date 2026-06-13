/* =========================================================
   PARTIALS INCLUDE (TOPBAR + AUTH MODAL) — SIMPLE + SAFE
   ========================================================= */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function loadIndexAuth() {
    try {
      var already = Array.from(document.scripts || []).some(function (s) {
        return (s.src || "").includes("/index.auth.js");
      });
      if (already) return;

      var s = document.createElement("script");
      s.src = "/index.auth.js?v=20260423_1";
      s.defer = true;
      document.head.appendChild(s);
    } catch (e) {
      console.warn("[partials] index.auth loader error:", e);
    }
  }

  function loadAuthUnifyFix() {
    try {
      var already = Array.from(document.scripts || []).some(function (s) {
        return (s.src || "").includes("/auth.unify.fix.js");
      });
      if (already) return;

      var s = document.createElement("script");
      s.src = "/auth.unify.fix.js?v=2";
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
        try {
          window.__AIVO_TOPBAR_REFRESH__();
        } catch (_) {}
        clearInterval(t);
      }

      if (tries >= 40) clearInterval(t);
    }, 100);
  }

  async function injectTopbar() {
    var mount = qs('[data-include="topbar"]');
    if (!mount) return;

    try {
      var res = await fetch("/partials/topbar.html", { cache: "no-store" });
      if (!res.ok) throw new Error("topbar fetch failed: " + res.status);

      var html = await res.text();
      mount.outerHTML = html;

      loadAuthUnifyFix();

      document.dispatchEvent(new CustomEvent("aivo:topbar:ready"));

      refreshAuthUIWithRetry();
    } catch (e) {
      console.warn("[partials] topbar inject error:", e);
    }
  }

  async function injectAuthModal() {
    if (document.getElementById("loginModal")) return;

    try {
      var res = await fetch("/partials/auth-modal.html", { cache: "no-store" });
      if (!res.ok) throw new Error("auth modal fetch failed: " + res.status);

      var html = await res.text();
      var wrap = document.createElement("div");
      wrap.innerHTML = html;
      document.body.appendChild(wrap);

      document.dispatchEvent(new CustomEvent("aivo:auth-modal:ready"));
    } catch (e) {
      console.warn("[partials] auth modal inject error:", e);
    }
  }

  function boot() {
    loadIndexAuth();
    loadAuthUnifyFix();

    injectTopbar();
    injectAuthModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
