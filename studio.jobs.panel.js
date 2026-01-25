/* =========================================================
   JOBS PANEL (FINAL) — RIGHT PANEL OWNER (PERSIST SOURCE)
   - Source of truth: __AIVO_JOBS_PERSIST_DEBUG__() -> ram/ls
   - Target: #studioRightPanel
   - Expose: window.AIVO_JOBS_PANEL.open/render
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoJobsPanelBoundV3) return;
  window.__aivoJobsPanelBoundV3 = true;

  function getPanel(){
    return document.querySelector('#studioRightPanel');
  }

  function esc(s){
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function getJobsList(){
    try{
      if (typeof window.__AIVO_JOBS_PERSIST_DEBUG__ === "function") {
        var d = window.__AIVO_JOBS_PERSIST_DEBUG__() || {};
        if (Array.isArray(d.ram) && d.ram.length) return d.ram;
        if (Array.isArray(d.ls)  && d.ls.length)  return d.ls;
      }
    }catch(_){}

    try{
      var J = window.AIVO_JOBS;
      if (J){
        if (Array.isArray(J.list)) return J.list;
        if (typeof J.getAll === "function") return J.getAll() || [];
        if (typeof J.get === "function") return J.get() || [];
        if (typeof J.dump === "function") return J.dump() || [];
      }
    }catch(_){}

    return [];
  }

  function fmtTime(ts){
    if (!ts) return "";
    try{
      var d = (ts instanceof Date) ? ts : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("tr-TR", {
        day:"2-digit", month:"2-digit",
        hour:"2-digit", minute:"2-digit"
      });
    }catch(_){
      return "";
    }
  }

  function render(panel){
    if (!panel) return;

    var jobs = getJobsList() || [];
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
        + '<div class="right-empty" style="display:flex;">'
        + '  <div class="right-empty-icon">✨</div>'
        + '</div>'
        + '<div class="card" style="margin-top:10px;">'
        + '  <div style="font-weight:700; margin-bottom:6px;">Henüz çıktı yok</div>'
        + '  <div style="opacity:.85; line-height:1.6;">'
        + '    Üretim başlattığında burada görünecek.'
        + '  </div>'
        + '</div>';
    } else {
      html += ''
        + '<div style="display:flex; justify-content:space-between; margin-top:6px;">'
        + '  <div style="opacity:.85;">Toplam: <b>'+count+'</b></div>'
        + '  <button type="button" class="chip-btn" data-jobs-clear>Temizle</button>'
        + '</div>'
        + '<div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">';

      for (var i=0; i<Math.min(10, count); i++){
        var j = jobs[i] || {};
        var title  = j.title || j.name || j.type || "Çıktı";
        var kind   = j.kind  || j.media || "";
        var status = j.status|| j.state || "done";
        var time   = fmtTime(j.createdAt || j.ts);
        var url    = j.url || j.downloadUrl || "";

        html += ''
          + '<div class="card" style="padding:12px;">'
          + '  <div style="display:flex; justify-content:space-between; gap:10px;">'
          + '    <div style="min-width:0;">'
          + '      <div style="font-weight:800;">'+esc(title)+'</div>'
          + '      <div style="opacity:.75; font-size:12px;">'
          +        esc(kind)+' • '+esc(status)+(time?' • '+esc(time):'')
          + '      </div>'
          + '    </div>'
          + '    <div style="display:flex; gap:6px;">'
          + '      <button class="chip-btn" data-open="'+esc(url)+'">Aç</button>'
          + '      <button class="chip-btn" data-copy="'+esc(url)+'">Kopyala</button>'
          + '      <button class="chip-btn" data-dl="'+esc(url)+'">İndir</button>'
          + '    </div>'
          + '  </div>'
          + '</div>';
      }

      html += '</div>';
    }

    html += '</div></div>';
    panel.innerHTML = html;
  }

  function open(){
    var panel = getPanel();
    if (!panel) return;
    panel.classList.add('is-jobs-open');
    render(panel);
  }

  // expose
  window.AIVO_JOBS_PANEL = {
    open,
    render: function(){ render(getPanel()); }
  };

  // actions
  document.addEventListener('click', function(e){
    var panel = getPanel();
    if (!panel) return;

    var t = e.target;

    if (t.closest('[data-jobs-clear]')){
      e.preventDefault();
      render(panel);
      return;
    }

    var openBtn = t.closest('[data-open]');
    var copyBtn = t.closest('[data-copy]');
    var dlBtn   = t.closest('[data-dl]');

    var url = openBtn?.dataset.open || copyBtn?.dataset.copy || dlBtn?.dataset.dl;
    if (!url) return;

    e.preventDefault();

    if (openBtn) window.open(url, "_blank", "noopener");
    if (copyBtn && navigator.clipboard) navigator.clipboard.writeText(url).catch(()=>{});
    if (dlBtn) window.location.href = url;
  }, true);

  // auto render (hydrate delay)
  function boot(){
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      render(getPanel());
      if (tries > 40) clearInterval(t);
    }, 100);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
