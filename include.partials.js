/* =========================================================
   PARTIALS INCLUDE (TOPBAR) — SIMPLE + SAFE
   - <div data-include="topbar"></div> yerine /partials/topbar.html basar
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
    } catch(e){
      console.warn("[partials] topbar inject error:", e);
    }
  }

  // DOM hazır olunca
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", injectTopbar);
  } else {
    injectTopbar();
  }
})();
