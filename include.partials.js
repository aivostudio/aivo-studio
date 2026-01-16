/* =========================================================
   PARTIALS INCLUDE (TOPBAR) — SIMPLE + SAFE (FINAL)
   - <div data-include="topbar"></div> yerine /partials/topbar.html basar
   - auth.unify.fix.js'yi GLOBAL olarak yükler
   - topbar inject sonrası auth refresh tetikler
   ========================================================= */
(function(){
  "use strict";

  function qs(sel, root){ return (root || document).querySelector(sel); }

  async function injectTopbar(){
    var mount = qs('[data-include="topbar"]');
    if (!mount) return;

    try{
      var res = await fetch("/partials/topbar.html", { cache: "no-store" });
      if (!res.ok) throw new Error("topbar fetch failed: " + res.status);
      var html = await res.text();
      mount.outerHTML = html;

      // 🔁 Topbar geldikten sonra auth UI yenile
      setTimeout(function(){
        if (typeof window.__AIVO_TOPBAR_REFRESH__ === "function") {
          window.__AIVO_TOPBAR_REFRESH__();
        }
      }, 0);

    } catch(e){
      console.warn("[partials] topbar inject error:", e);
    }
  }

  // ===============================
  // GLOBAL auth.unify.fix.js LOADER
  // ===============================
  function loadAuthUnifyFix(){
    try {
      var already = Array.from(document.scripts || []).some(function(s){
        return (s.src || "").includes("/auth.unify.fix.js");
      });
      if (already) return;

      var s = document.createElement("script");
      s.src = "/auth.unify.fix.js?v=2"; // 👈 versiyonu arttır (cache kırmak için)
      s.defer = true;
      document.head.appendChild(s);
    } catch (e) {
      console.warn("[partials] auth.unify.fix loader error:", e);
    }
  }

  // DOM hazır olunca
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){
      loadAuthUnifyFix();
      injectTopbar();
    });
  } else {
    loadAuthUnifyFix();
    injectTopbar();
  }
})();
