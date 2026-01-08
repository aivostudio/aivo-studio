/* =========================================================
   OPEN-JOBS ACTION (MVP) — CAPTURE + STOP LEGACY FALLTHROUGH v2
   - data-action="open-jobs" tıklamasını legacy switchPage'den ÖNCE yakalar
   - stopImmediatePropagation ile studio.js switchPage('jobs') akışını keser
   - Jobs panel render tetikler (event)
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoOpenJobsBound) return;
  window.__aivoOpenJobsBound = true;

  function fireOpen(){
    try { window.dispatchEvent(new CustomEvent("aivo:jobs:open")); } catch(e){}
    // İstersen burada sağ paneli görünür yapacak ek adım da eklenebilir (panel.js içinde de yapılabilir)
  }

  // CAPTURE: legacy handler'lardan önce çalışsın
  document.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-action="open-jobs"]') : null;
    if (!btn) return;

    // legacy click delegation'u kesin kes
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    fireOpen();
  }, true);

})();
