/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION)
   File: /js/panel.music.js
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL = "#rightPanelHost";
  const LS_KEY = "aivo.music.jobs.v1";

  let hostEl = null;
  let listEl = null;
  let jobs = loadJobs();

  // ---------- utils ----------
  function qs(sel, root=document){ return root.querySelector(sel); }
  function ensureHost(){ hostEl = qs(HOST_SEL); return hostEl; }
  function ensureList(){
    if (!hostEl) return null;
    listEl = hostEl.querySelector(".aivo-player-list");
    if (!listEl){
      listEl = document.createElement("div");
      listEl.className = "aivo-player-list";
      listEl.id = "musicList";
      hostEl.appendChild(listEl);
    }
    return listEl;
  }
  function loadJobs(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  }
  function saveJobs(next){
    try { localStorage.setItem(LS_KEY, JSON.stringify((next||[]).slice(0,50))); }
    catch {}
  }
  function upsertJob(job){
    if (!job) return;
    const id = job.job_id || job.jobId || job.id;
    if (!id) return;
    const i = jobs.findIndex(j => (j.job_id||j.jobId||j.id) === id);
    if (i >= 0) jobs[i] = { ...jobs[i], ...job };
    else jobs.unshift(job);
    saveJobs(jobs);
  }
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function statusToUI(status){
    const s = String(status||"").toLowerCase();
    if (s === "ready") return "ready";
    if (["error","failed","fail"].includes(s)) return "error";
    return "processing";
  }

  // ---------- render ----------
  function renderCard(job){
    const title = job?.title || job?.name || "Müzik Üretimi";
    const sub = job?.genre || job?.lang || "—";
    const dur = job?.duration || "—:—";
    const jobId = job?.job_id || job?.id || "";
    const outId = job?.output_id || "";
    const src = job?.__audio_src || "";
    const state = job?.__ui_state || "processing";
    const ready = state === "ready" && !!src;

    return `
<div class="aivo-player-card ${ready?"is-ready":"is-loadingState"}"
  data-job-id="${esc(jobId)}"
  data-output-id="${esc(outId)}"
  data-src="${esc(src)}">
  <div class="aivo-player-left">
    ${
      ready
        ? `<button class="aivo-player-btn" data-action="toggle-play" aria-label="Oynat"></button>`
        : `<div class="aivo-player-spinner"></div>`
    }
  </div>
  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(title)}</div>
      <div class="aivo-player-tags">
        <span class="aivo-tag ${ready?"is-ready":"is-loading"}">
          ${ready?"Hazır":"Hazırlanıyor"}
        </span>
      </div>
    </div>
    <div class="aivo-player-sub">${esc(sub)}</div>
    <div class="aivo-player-meta">
      <span>${esc(dur)}</span>
    </div>
    <div class="aivo-player-controls">
      <div class="aivo-progress"><i style="width:0%"></i></div>
      <span data-bind="time">0:00</span>
    </div>
  </div>
  <div class="aivo-player-actions">
    <button class="aivo-action is-blue" data-action="download"></button>
    <button class="aivo-action" data-action="delete"></button>
  </div>
</div>`;
  }

  function render(){
    if (!ensureHost() || !ensureList()) return;
    const a = jobs.slice(0,2);
    const s1 = a[0] || { __ui_state:"processing" };
    const s2 = a[1] || { __ui_state:"processing" };
    listEl.innerHTML = renderCard(s1) + renderCard(s2);
  }

  // ---------- polling ----------
  async function pollJob(job_id){
    try{
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, { cache:"no-store" });
      const j = await r.json().catch(()=>null);
      if (!j || !j.ok){ setTimeout(()=>pollJob(job_id),1500); return; }

      const job = j.job || {};
      const src =
        j?.audio?.src ||
        job?.audio?.src ||
        j?.output_url ||
        j?.play_url ||
        j?.audio_url ||
        j?.outputs?.[0]?.url ||
        job?.outputs?.[0]?.url ||
        j?.files?.[0]?.url ||
        job?.files?.[0]?.url ||
        j?.result?.url ||
        job?.result?.url ||
        "";

      job.job_id = job.job_id || job.id || job_id;
      job.__ui_state = statusToUI(j.status || job.status);
      job.__audio_src = String(src || "");

      upsertJob(job);
      render();

      if (job.__ui_state !== "ready" || !job.__audio_src){
        setTimeout(()=>pollJob(job.job_id),1500);
      }
    }catch{
      setTimeout(()=>pollJob(job_id),2000);
    }
  }

  // ---------- events ----------
  function onJobEvent(e){
    const job = e?.detail || e;
    if (!job || (job.type && String(job.type) !== "music")) return;
    const id = job.job_id || job.jobId || job.id;
    upsertJob({ ...job, job_id:id, __ui_state:"processing", __audio_src:"" });
    render();
    if (id) pollJob(id);
  }

  // ---------- panel integration ----------
  function mount(){
    if (!ensureHost()) return;
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Müzik</div>
          <div class="rp-body"></div>
        </div>
      </div>`;
    ensureList();
    render();
    jobs.forEach(j => j?.job_id && pollJob(j.job_id));
    window.addEventListener("aivo:job", onJobEvent);
  }
  function destroy(){
    window.removeEventListener("aivo:job", onJobEvent);
  }

  function register(){
    const RP = window.RightPanel;
    if (RP && typeof RP.register === "function"){
      RP.register(PANEL_KEY, { mount, destroy });
      return true;
    }
    return false;
  }

  if (!register()){
    window.addEventListener("DOMContentLoaded", () => register(), { once:true });
  }
})();
