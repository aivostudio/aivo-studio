/* =========================================================
   JOBS PANEL (MVP + PERSIST) — SINGLE SOURCE
   - RAM: window.AIVO_JOBS
   - PERSIST: localStorage ("aivo_jobs_v1")
========================================================= */
(function(){
  "use strict";

  if (window.__aivoJobsPanelBound) return;
  window.__aivoJobsPanelBound = true;

  const LS_KEY = "aivo_jobs_v1";

  /* ---------------- utils ---------------- */
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function esc(s){
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function safeReadLS(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }

  function safeWriteLS(list){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 50)));
    }catch(_){}
  }

  /* ---------------- DATA SOURCE ---------------- */
  function getJobsList(){
    try{
      const J = window.AIVO_JOBS;
      if (J){
        if (Array.isArray(J.list)) return J.list;
        if (typeof J.getAll === "function") return J.getAll() || [];
        if (typeof J.get === "function") return J.get() || [];
      }
      return safeReadLS();
    }catch(_){
      return safeReadLS();
    }
  }

  /* ---------------- HYDRATE ---------------- */
  (function hydrate(){
    try{
      const J = window.AIVO_JOBS;
      if (!J || typeof J.setAll !== "function") return;
      const saved = safeReadLS();
      if (saved.length) J.setAll(saved);
    }catch(_){}
  })();

  /* ---------------- RENDER ---------------- */
  function fmtTime(ts){
    try{
      const d = new Date(ts);
      return isNaN(d) ? "" : d.toLocaleString("tr-TR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
    }catch(_){ return ""; }
  }

  function render(panel){
    if (!panel) return;

    const jobs = getJobsList();
    const count = jobs.length;

    let html =
      '<div class="card right-card">' +
      ' <div class="card-header">' +
      '  <div>' +
      '   <div class="card-title">Çıktılar</div>' +
      '   <div class="card-subtitle">Son işler ve indirme linkleri</div>' +
      '  </div>' +
      ' </div>' +
      ' <div class="right-list">';

    if (!count){
      html +=
        '<div class="right-empty"><div class="right-empty-icon">✨</div></div>' +
        '<div class="card" style="margin-top:10px;">Henüz çıktı yok</div>';
    } else {
      html += '<div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">';
      for (let i=0;i<Math.min(10,count);i++){
        const j = jobs[i] || {};
        html +=
          '<div class="card" style="padding:12px">' +
          ' <div style="font-weight:800">'+esc(j.title||j.type||"Çıktı")+'</div>' +
          ' <div style="opacity:.75;font-size:12px">'+esc(j.status||"done")+' • '+fmtTime(j.ts||j.createdAt)+'</div>' +
          '</div>';
      }
      html += '</div>';
    }

    html += '</div></div>';
    panel.innerHTML = html;
  }

  /* ---------------- PANEL API ---------------- */
  window.AIVO_JOBS_PANEL = {
    open(){
      const p = qs('[data-jobs-panel]');
      if (!p) return;
      p.classList.add('is-jobs-open');
      render(p);
    },
    render(){
      render(qs('[data-jobs-panel]'));
    }
  };

  /* ---------------- SUBSCRIBE (PERSIST HERE) ---------------- */
  try{
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function"){
      window.AIVO_JOBS.subscribe(function(){
        const jobs = getJobsList();
        safeWriteLS(jobs); // 🔑 TEK KRİTİK SATIR
        const panel = qs('[data-jobs-panel]');
        if (panel && panel.classList.contains('is-jobs-open')) render(panel);
      });
    }
  }catch(_){}
})();
