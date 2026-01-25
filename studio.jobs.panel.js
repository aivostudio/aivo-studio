/* =========================================================
   JOBS PANEL (MVP) — RIGHT PANEL OWNER
   - Target: [data-jobs-panel]
   - Mode class: .is-jobs-open
   - Renders: empty state + list
   - Reactive: window.AIVO_JOBS.subscribe
========================================================= */
(function(){
  "use strict";

  if (window.__aivoJobsPanelBound) return;
  window.__aivoJobsPanelBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s){
    s = String(s == null ? "" : s);
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

function getJobsList(){
  try{
    var J = window.AIVO_JOBS;
    if (J){
      if (Array.isArray(J.list)) return J.list;
      if (typeof J.getAll === "function") return J.getAll() || [];
      if (typeof J.get === "function") return J.get() || [];
    }

    // ✅ fallback: store’dan oku (refresh sonrası)
    var S = window.AIVO_STORE_V1;
    if (S && typeof S.read === "function"){
      var st = S.read() || {};
      if (Array.isArray(st.jobs)) return st.jobs;
      if (Array.isArray(st.outputs)) return st.outputs;
    }

    return [];
  }catch(e){
    return [];
  }
}


  function fmtTime(ts){
    if (!ts) return "";
    try{
      var d = (ts instanceof Date) ? ts : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    }catch(e){
      return "";
    }
  }

  function render(panel){
    if (!panel) return;

    var jobs = getJobsList();
    var count = jobs.length;

    var html = ''
      + '<div class="card right-card">'
      + '  <div class="card-header">'
      + '    <div>'
      + '      <div class="card-title">Çıktılar</div>'
      + '      <div class="card-subtitle">Son işler ve indirme linkleri</div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="right-list">';

    if (!count){
      html += ''
        + '    <div class="right-empty" style="display:flex;">'
        + '      <div class="right-empty-icon">✨</div>'
        + '    </div>'
        + '    <div class="card" style="margin-top:10px;">'
        + '      <div style="font-weight:700; margin-bottom:6px;">Henüz çıktı yok</div>'
        + '      <div style="opacity:.85; line-height:1.6;">'
        + '        Üretim başlattığında burada görünecek. Tamamlanan işler indirme / paylaşım linkiyle listelenir.'
        + '      </div>'
        + '    </div>';
    } else {
      html += '    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:6px;">'
           + '      <div style="opacity:.85;">Toplam: <b>'+count+'</b></div>'
           + '      <button type="button" class="chip-btn" data-jobs-clear style="white-space:nowrap;">Temizle</button>'
           + '    </div>';

      html += '    <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">';

      // son 10
      for (var i=0; i<Math.min(10, count); i++){
        var j = jobs[i] || {};
        var title = j.title || j.name || j.type || "Çıktı";
        var kind  = j.kind  || j.media || j.output || "";
        var status= j.status|| j.state || "done";
        var time  = fmtTime(j.createdAt || j.ts || j.time);
        var url   = j.url || j.downloadUrl || j.link || "";

        html += ''
          + '<div class="card" data-job-item style="padding:12px;">'
          + '  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">'
          + '    <div style="min-width:0;">'
          + '      <div style="font-weight:800; line-height:1.2; margin-bottom:4px;">'+esc(title)+'</div>'
          + '      <div style="opacity:.78; font-size:12px; line-height:1.4;">'
          +         (kind ? esc(kind) + ' • ' : '')
          +         esc(status)
          +         (time ? ' • ' + esc(time) : '')
          + '      </div>'
          + '    </div>'
          + '    <div style="flex:0 0 auto; display:flex; gap:8px;">'
          + '      <button type="button" class="chip-btn" data-job-open '+(url?'':'disabled')+' data-job-url="'+esc(url)+'">Aç</button>'
          + '      <button type="button" class="chip-btn" data-job-copy '+(url?'':'disabled')+' data-job-url="'+esc(url)+'">Kopyala</button>'
          + '      <button type="button" class="chip-btn" data-job-dl '+(url?'':'disabled')+' data-job-url="'+esc(url)+'">İndir</button>'
          + '    </div>'
          + '  </div>'
          + '</div>';
      }

      html += '    </div>';
    }

    html += '  </div>'
         + '</div>';

    panel.innerHTML = html;
  }

  function openPanel(){
    var panel = qs('[data-jobs-panel]');
    if (!panel) return;
    panel.classList.add('is-jobs-open');
    render(panel);
  }

  // expose for action.js (opsiyonel)
  window.AIVO_JOBS_PANEL = window.AIVO_JOBS_PANEL || {};
  window.AIVO_JOBS_PANEL.open = openPanel;
  window.AIVO_JOBS_PANEL.render = function(){
    render(qs('[data-jobs-panel]'));
  };

  // clicks inside panel
  document.addEventListener('click', function(e){
    var panel = qs('[data-jobs-panel]');
    if (!panel) return;

    // clear
    var clearBtn = e.target.closest && e.target.closest('[data-jobs-clear]');
    if (clearBtn){
      e.preventDefault();
      try{
        if (window.AIVO_JOBS && typeof window.AIVO_JOBS.setAll === "function"){
          window.AIVO_JOBS.setAll([]);
        } else if (window.AIVO_JOBS && typeof window.AIVO_JOBS.clear === "function"){
          window.AIVO_JOBS.clear();
        } else {
          // fallback: sadece UI
          render(panel);
        }
      }catch(_){}
      render(panel);
      return;
    }

    // open/copy/download
    var act = e.target.closest && e.target.closest('[data-job-open],[data-job-copy],[data-job-dl]');
    if (!act) return;

    var url = act.getAttribute('data-job-url') || "";
    if (!url) return;

    e.preventDefault();

    if (act.hasAttribute('data-job-open')){
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (act.hasAttribute('data-job-copy')){
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).catch(function(){});
      } else {
        // fallback
        var ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try{ document.execCommand("copy"); } catch(_){}
        ta.remove();
      }
      return;
    }

    if (act.hasAttribute('data-job-dl')){
      // basit download: aynı url’e git
      window.location.href = url;
      return;
    }
  }, true);

  // reactive update
  try{
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function"){
      window.AIVO_JOBS.subscribe(function(){
        var panel = qs('[data-jobs-panel]');
        if (!panel) return;
        // sadece jobs modundaysa otomatik yenile
        if (panel.classList.contains('is-jobs-open')) render(panel);
      });
    }
  }catch(_){}

})();
