/* =========================================================
   SIDEBAR SYNC (SAFE)
   - Aktif .page (is-active) hangisiyse body[data-active-page] ayarlar
   - Hiçbir click'i engellemez
   ========================================================= */
(function () {
  "use strict";

  function getActivePageName() {
    var active = document.querySelector('.page.is-active[data-page]');
    return active ? (active.getAttribute("data-page") || "") : "";
  }

  function sync() {
    var page = getActivePageName() || "dashboard";
    document.body.setAttribute("data-active-page", page);
  }

  document.addEventListener("DOMContentLoaded", function () {
    sync();

    // .is-active değişimlerini yakala
    var pages = document.querySelectorAll(".page[data-page]");
    var mo = new MutationObserver(function () { sync(); });

    pages.forEach(function (p) {
      mo.observe(p, { attributes: true, attributeFilter: ["class"] });
    });

    // tıklamadan sonra da bir kez sync (bazı legacy akışlar için)
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-page-link]") : null;
      if (btn) setTimeout(sync, 0);
    }, true);
  });
})();
