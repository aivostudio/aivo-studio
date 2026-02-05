/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION)
   File: /js/panel.music.js
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.jobs.v1";

  let hostEl = null;
  let listEl = null;
  let jobs   = loadJobs();

  /* ---------------- utils ---------------- */
  const qs = (s,r=document)=>r.querySelector(s);

  function ensureHost(){
    hostEl = qs(HOST_SEL);
    return hostEl;
  }

  function ensureList(){
    if (!hostEl) return null;
    listEl = hostEl.querySelector("#musicList");
    if (!listEl){
      listEl = document.createElement("div");
      listEl.className = "aivo-player-list";
      listEl.id = "musicList";
      hostEl.appendChild(listEl);
    }
    return listEl;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function loadJobs(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  }

  function saveJobs(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0,50))); }
    catch {}
  }

  function upsertJob(job){
    const id = job?.job_id || job?.id;
    if (!id) return;
    const i = jobs.findIndex(j => (j.job_id||j.id) === id);
    if (i >= 0) jobs[i] = { ...jobs[i], ...job };
    else jobs.unshift(job);
    saveJobs();
  }

  function uiState(status){
    const s = String(status||"").toLowerCase();
    if (["ready","done","completed","success"].includes(s)) return "ready";
    if (["error","failed"].includes(s)) return "error";
    return "processing";
  }

  /* ---------------- REAL PLAYER CARD ---------------- */
  function renderMusicCard(job){
    const jobId = job.job_id || job.id;
    const ready = job.__ui_state === "ready" && job.__audio_src;

    if (!ready){
      return `
<div class="aivo-player-card is-loadingState"
     data-job-id="${esc(jobId)}">

  <div class="aivo-player-left">
    <div class="aivo-player-spinner"></div>
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(job.title || "Müzik Üretimi")}</div>
      <div class="aivo-player-tags">
        <span class="aivo-tag is-loading">Hazırlanıyor</span>
      </div>
    </div>
    <div class="aivo-player-sub">${esc(job.subtitle || "")}</div>
  </div>

  <div class="aivo-player-actions">
    <button class="aivo-action is-danger" data-action="delete">Sil</button>
  </div>
</div>`;
    }

    return `
<div class="aivo-player-card is-ready"
     data-job-id="${esc(jobId)}"
     data-output-id="${esc(job.output_id || "")}"
     data-src="${esc(job.__audio_src)}">

  <div class="aivo-player-left">
    <button class="aivo-player-btn" data-action="toggle-play">
      ▶
    </button>
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(job.title || "Müzik")}</div>
      <div class="aivo-player-tags">
        <span class="aivo-tag is-ready">Hazır</span>
      </div>
    </div>
    <div class="aivo-player-sub">${esc(job.subtitle || "")}</div>
  </div>

  <div class="aivo-player-actions">
    <button class="aivo-action is-blue" data-action="download">İndir</button>
    <button class="aivo-action is-danger" data-action="delete">Sil</button>
  </div>
</div>`;
  }

  /* ---------------- render ---------------- */
  function render(){
    if (!ensureHost() || !ensureList()) return;

    if (!jobs.length){
      listEl.innerHTML = `
        <div class="aivo-empty">
          <div class="aivo-empty-title">Henüz müzik yok</div>
        </div>`;
      return;
    }

    listEl.innerHTML = jobs
      .filter(j => j.job_id || j.id)
      .slice(0,6)
      .map(renderMusicCard)
      .join("");
  }

  /* ---------------- polling ---------------- */
  async function poll(jobId){
    try{
      const r = await fetch(`/api/jobs/status?job_id=${jobId}`, {cache:"no-store"});
      const j = await r.json();
      if (!j?.ok){
        return setTimeout(()=>poll(jobId),1500);
      }

      const job = j.job || {};
      job.job_id = job.job_id || jobId;
      job.__ui_state  = uiState(j.status || job.status);
      job.__audio_src = j?.audio?.src || "";

      upsertJob(job);
      render();

      if (job.__ui_state !== "ready"){
        setTimeout(()=>poll(jobId),1500);
      } else {
        window.toast?.success?.("Müzik hazır 🎵");
      }

    }catch{
      setTimeout(()=>poll(jobId),2000);
    }
  }

  /* ---------------- events ---------------- */
  function onJob(e){
    const job = e?.detail || e;
    if (!job?.job_id) return;

    upsertJob({
      job_id: job.job_id,
      title: job.title,
      subtitle: job.subtitle,
      __ui_state: "processing",
      __audio_src: ""
    });

    render();
    poll(job.job_id);
  }

  /* ---------------- panel integration ---------------- */
  function mount(){
    if (!ensureHost()) return;

    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Müzik</div>
          <div class="rp-body"></div>
        </div>
      </div>`;

    listEl = hostEl.querySelector(".rp-body");
    listEl.id = "musicList";
    listEl.className = "aivo-player-list";

    render();
    jobs.forEach(j => j?.job_id && poll(j.job_id));
    window.addEventListener("aivo:job", onJob);
  }

  function destroy(){
    window.removeEventListener("aivo:job", onJob);
  }

  function register(){
    if (window.RightPanel?.register){
      window.RightPanel.register(PANEL_KEY,{mount,destroy});
      return true;
    }
    return false;
  }

  if (!register()){
    window.addEventListener("DOMContentLoaded", register, {once:true});
  }
})();
