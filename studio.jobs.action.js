/* =========================================================
   JOBS ACTION (MVP) — OPEN JOBS PANEL RELIABLY
   - Captures click on [data-action="open-jobs"]
   - Forces right panel into "Çıktılar" UI (race-safe)
========================================================= */
(function(){
  "use strict";

  if (window.__aivoJobsActionBound) return;
  window.__aivoJobsActionBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }

  function forceRenderFallback(panel){
    panel.innerHTML =
      '<div class="card right-card">' +
      '  <div class="card-header">' +
      '    <div>' +
      '      <div class="card-title">Çıktılar</div>' +
      '      <div class="card-subtitle">Son işler ve indirme linkleri</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="right-list">' +
      '    <div class="card" style="margin-top:10px;">' +
      '      <div style="font-weight:700; margin-bottom:6px;">Henüz çıktı yok</div>' +
      '      <div style="opacity:.85; line-height:1.6;">' +
      '        Üretim başlattığında burada görünecek.' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function openJobsPanel(){
    var panel = qs('[data-jobs-panel]');
    if (!panel) {
      console.warn('[AIVO][JOBS] data-jobs-panel bulunamadı');
      return;
    }

    panel.classList.add('is-jobs-open');

    // 1) Eğer panel owner varsa onu kullan
    try{
      if (window.AIVO_JOBS_PANEL && typeof window.AIVO_JOBS_PANEL.open === "function") {
        window.AIVO_JOBS_PANEL.open();
      } else {
        forceRenderFallback(panel);
      }
    }catch(e){
      forceRenderFallback(panel);
    }

    // 2) Race fix: başka script geri eziyorsa 50ms sonra tekrar bas
    setTimeout(function(){
      var p = qs('[data-jobs-panel]');
      if (!p) return;
      if (!p.classList.contains('is-jobs-open')) p.classList.add('is-jobs-open');

      try{
        if (window.AIVO_JOBS_PANEL && typeof window.AIVO_JOBS_PANEL.open === "function") {
          window.AIVO_JOBS_PANEL.open();
        } else {
          forceRenderFallback(p);
        }
      }catch(e){
        forceRenderFallback(p);
      }
    }, 50);

    console.log('[AIVO][JOBS] open-jobs OK');
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-action="open-jobs"]') : null;
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    openJobsPanel();
  }, true);
})();
