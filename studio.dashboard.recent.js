/* =========================================================
   DASHBOARD: SON İŞLER — AIVO_JOBS.list -> UI (HTML UYUMLU)
   - Sadece [data-dashboard-recent-jobs] içindeki:
       [data-recent-jobs-empty] + [data-recent-jobs-list] yönetir
   - studio.app.js bu alana ASLA dokunmayacak (Seçenek A)
   - Store geç gelirse retry
   - Manuel test: window.__AIVO_RECENT_RENDER()
   ========================================================= */
(function(){
  "use strict";

  if (window.__aivoRecentJobsBoundV6) return;
  window.__aivoRecentJobsBoundV6 = true;

  var MAX_ITEMS = 5;
  var RETRY_MS = 300;
  var RETRY_MAX = 25; // ~7.5sn

  function qs(sel, root){ try { return (root||document).querySelector(sel); } catch(e){ return null; } }
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function resolveUI(){
    var mount = qs('[data-dashboard-recent-jobs]');
    if (!mount) return null;

    var emptyEl = qs('[data-recent-jobs-empty]', mount);
    var listEl  = qs('[data-recent-jobs-list]', mount);

    if (!emptyEl || !listEl) return null;
    return { mount: mount, emptyEl: emptyEl, listEl: listEl };
  }

  function getList(){
    var s = window.AIVO_JOBS;
    if (!s || typeof s !== "object") return [];

    // öncelik: getList()
    try {
      if (typeof s.getList === "function") {
        var a = s.getList();
        if (Array.isArray(a)) return a;
      }
    } catch(_) {}

    // fallback: list
    try {
      if (Array.isArray(s.list)) return s.list;
    } catch(_) {}

    return [];
  }

  function iconFor(type){
    type = String(type || "").toLowerCase();
    if (type.indexOf("music") > -1 || type.indexOf("müzik") > -1) return "🎵";
    if (type.indexOf("cover") > -1 || type.indexOf("kapak") > -1) return "🖼️";
    if (type.indexOf("video") > -1) return "🎬";
    if (type.indexOf("sm") > -1) return "📦";
    if (type.indexOf("hook") > -1) return "⚡";
    return "⚙️";
  }

  function statusLabel(st){
    st = String(st || "").toLowerCase();
    if (st === "done" || st === "success" || st.indexOf("tamam") > -1) return { t:"Tamamlandı", k:"done" };
    if (st === "error" || st === "failed" || st.indexOf("hata") > -1) return { t:"Hata", k:"err" };
    if (st === "queued" || st.indexOf("kuyruk") > -1) return { t:"Kuyrukta", k:"wait" };
    return { t:"Hazırlanıyor", k:"run" };
  }

  function timeText(ts){
    try{
      var d = null;
      if (ts instanceof Date) d = ts;
      else if (typeof ts === "number") d = new Date(ts);
      else if (typeof ts === "string") d = new Date(ts);
      if (!d || isNaN(d.getTime())) return "az önce";
      var diff = Date.now() - d.getTime();
      if (diff < 60*1000) return "az önce";
      var min = Math.floor(diff/60000);
      if (min < 60) return min + " dk önce";
      var hr = Math.floor(min/60);
      if (hr < 24) return hr + " sa önce";
      var day = Math.floor(hr/24);
      return day + " gün önce";
    } catch(e){
      return "az önce";
    }
  }

  function normalize(job){
    job = job || {};
    var id = job.job_id || job.id || "";
    var type = job.type || job.kind || job.module || job.product || "job";
    var title = job.title || job.name || (String(type).toUpperCase());
    var status = job.status || job.state || "queued";
    var ts = job.created_at || job.createdAt || job.ts || job.time || job.updatedAt || Date.now();

    return {
      id: String(id),
      type: String(type),
      title: String(title),
      status: String(status),
      ts: ts
    };
  }

  function render(){
    var ui = resolveUI();
    if (!ui) return;

    var list = getList().map(normalize).slice(0, MAX_ITEMS);

    if (!list.length) {
      ui.emptyEl.hidden = false;
      ui.listEl.hidden = true;
      ui.listEl.innerHTML = "";
      return;
    }

    ui.emptyEl.hidden = true;
    ui.listEl.hidden = false;

    var html = "";
    for (var i=0; i<list.length; i++){
      var j = list[i];
      var st = statusLabel(j.status);
      var when = timeText(j.ts);

      html += ''
        + '<div class="aivo-recent-item" data-job-id="'+esc(j.id)+'">'
        + '  <div class="aivo-recent-left">'
        + '    <div class="aivo-recent-ico" aria-hidden="true">'+ esc(iconFor(j.type)) +'</div>'
        + '  </div>'
        + '  <div class="aivo-recent-mid">'
        + '    <div class="aivo-recent-title">'+ esc(j.title) +'</div>'
        + '    <div class="aivo-recent-meta">'
        + '      <span class="aivo-badge aivo-badge--'+ esc(st.k) +'">'+ esc(st.t) +'</span>'
        + '      <span class="aivo-recent-time">'+ esc(when) +'</span>'
        + '    </div>'
        + '  </div>'
        + '</div>';
    }

    ui.listEl.innerHTML = html;
  }

  // Manuel tetik (debug / test)
  window.__AIVO_RECENT_RENDER = function(){ try { render(); } catch(_) {} };

  // Store geç gelirse retry
  function bootRetry(){
    var n = 0;
    (function tick(){
      n++;
      render();
      if (n < RETRY_MAX){
        setTimeout(tick, RETRY_MS);
      }
    })();
  }

  // İlk yük
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootRetry);
  } else {
    bootRetry();
  }

  // subscribe varsa canlı güncelle
  try{
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function"){
      window.AIVO_JOBS.subscribe(function(){ render(); });
    }
  } catch(_) {}

})();
