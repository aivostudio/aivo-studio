/* =========================================================
   JOBS ACTION — LOCK + OPEN (MVP)
   - Jobs tıklanınca sağ panel "Jobs moduna" geçer
   - Lock açılır: diğer renderer'lar sağ paneli ezemez
========================================================= */
(function(){
  "use strict";

  if (window.__aivoJobsActionBound) return;
  window.__aivoJobsActionBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }

  // Global lock flag
  window.__AIVO_RIGHT_PANEL_MODE = window.__AIVO_RIGHT_PANEL_MODE || "music";

  function renderJobs(panel){
    panel.innerHTML =
      '<div class="card right-card">' +
      '  <div class="card-header">' +
      '    <div>' +
      '      <div class="card-title">Çıktılar</div>' +
      '      <div class="card-subtitle">Jobs / kuyruk / tamamlanan çıktılar</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="right-list">' +
      '    <div class="card" style="margin-top:10px;">' +
      '      <div style="font-weight:700; margin-bottom:6px;">Henüz çıktı yok</div>' +
      '      <div style="opacity:.85; line-height:1.6;">' +
      '        Üretim başlattığında burada görünecek. Tamamlanan işler “indir / kopyala link” ile listelenir.' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function openJobs(){
    var panel = qs('[data-jobs-panel]');
    if (!panel){
      console.warn('[AIVO][JOBS] data-jobs-panel yok');
      return;
    }

    // 1) mode + lock
    window.__AIVO_RIGHT_PANEL_MODE = "jobs";
    panel.classList.add('is-jobs-open');

    // 2) render (panel owner varsa onu kullan)
    try{
      if (window.AIVO_JOBS_PANEL && typeof window.AIVO_JOBS_PANEL.open === "function"){
        window.AIVO_JOBS_PANEL.open();
      } else {
        renderJobs(panel);
      }
    }catch(e){
      renderJobs(panel);
    }

    // 3) race fix: müzik renderer geri eziyorsa tekrar bas
    setTimeout(function(){
      var p = qs('[data-jobs-panel]');
      if (!p) return;
      if (window.__AIVO_RIGHT_PANEL_MODE !== "jobs") return;
      try{
        if (window.AIVO_JOBS_PANEL && typeof window.AIVO_JOBS_PANEL.open === "function"){
          window.AIVO_JOBS_PANEL.open();
        } else {
          renderJobs(p);
        }
      }catch(e){
        renderJobs(p);
      }
    }, 50);

    console.log('[AIVO][JOBS] OPEN OK');
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-action="open-jobs"]') : null;
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    openJobs();
  }, true);

})();
