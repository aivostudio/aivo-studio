/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION, NO FAKE CARDS)
   File: /js/panel.music.js
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL = "#rightPanelHost";
  const LS_KEY   = "aivo.music.jobs.v1";

  let hostEl = null;
  let listEl = null;
  let jobs   = loadJobs();

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

  // ---------- PLAYER INTEGRATION (NO FAKE PLAYER) ----------
  function tryAddToPlayer(job){
    const src = (job?.__audio_src || "").trim();
    if (!src) return false;

    const P = window.AIVO_PLAYER;
    if (!P || typeof P.add !== "function") return false;

    try {
      // Player contract is unknown; keep it minimal.
      P.add({ src, title: job?.title || job?.name || "Müzik Üretimi", type: "audio" });
      return true;
    } catch (e) {
      console.warn("[panel.music] AIVO_PLAYER.add failed:", e);
      return false;
    }
  }

  // ---------- render (NO PLACEHOLDER CARDS) ----------
  function renderRow(job){
    const title = job?.title || job?.name || "Müzik Üretimi";
    const sub   = job?.genre || job?.lang || "—";
    const dur   = job?.duration || "—:—";
    const jobId = job?.job_id || job?.id || "";
    const state = job?.__ui_state || "processing";
    const ready = state === "ready" && !!(job?.__audio_src);

    return `
      <div class="aivo-row ${ready ? "is-ready" : "is-loading"}" data-job-id="${esc(jobId)}">
        <div class="aivo-row-main">
          <div class="aivo-row-title">${esc(title)}</div>
          <div class="aivo-row-sub">${esc(sub)} • ${esc(dur)}</div>
        </div>
        <div class="aivo-row-tag">
          <span class="aivo-tag ${ready ? "is-ready" : "is-loading"}">${ready ? "Hazır" : "Hazırlanıyor"}</span>
        </div>
      </div>
    `;
  }

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMusicCard(job) {
  const jobId = job?.job_id || job?.id || "";
  const status = job?.status || job?.state || "unknown";

  const title =
    job?.title ||
    job?.meta?.title ||
    job?.prompt?.title ||
    job?.prompt ||
    `Müzik (${String(jobId).slice(0, 6)})`;

  return `
    <div class="aivo-music-card" data-job-id="${esc(jobId)}">
      <div class="aivo-music-card__top">
        <div class="aivo-music-card__title">${esc(title)}</div>
        <div class="aivo-music-card__status">${esc(status)}</div>
      </div>

      <div class="aivo-music-card__player">
        <div class="aivo-player-mount" data-job-id="${esc(jobId)}"></div>
      </div>
    </div>
  `;
}

function render(){
  if (!ensureHost() || !ensureList()) return;

  // ❌ No fake cards: show only real jobs
  const real = jobs.filter(j => j && (j.job_id || j.id));

  if (real.length === 0){
    listEl.innerHTML = `
      <div class="aivo-empty">
        <div class="aivo-empty-title">Henüz müzik yok</div>
        <div class="aivo-empty-sub">“Müzik Üret” ile başlayınca burada görünecek.</div>
      </div>
    `;
    return;
  }

  // ✅ CSS uyumlu: eski kart template (player.css bunu biliyor)
  listEl.innerHTML = real.slice(0,5).map(renderMusicCard).join("\n");
}

  // ---------- polling ----------
  async function pollJob(job_id){
    try{
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, { cache:"no-store" });
      const j = await r.json().catch(()=>null);
      if (!j || !j.ok){ setTimeout(()=>pollJob(job_id),1500); return; }

      const job = j.job || {};
      const src = (j?.audio?.src || "").trim(); // ✅ tek kaynak: backend normalize ediyor

      job.job_id     = job.job_id || job.id || job_id;
      job.__ui_state = statusToUI(j.status || job.status);
      job.__audio_src= String(src || "");

      upsertJob(job);
      render();

      // ready olduysa player'a ekle (bir kere)
      if (job.__ui_state === "ready" && job.__audio_src){
        if (!job.__player_added){
          job.__player_added = true;
          upsertJob(job);
          tryAddToPlayer(job);
          if (window.toast?.success) window.toast.success("Müzik hazır 🎵");
        }
        return;
      }

      // devam
      if (job.__ui_state !== "error"){
        setTimeout(()=>pollJob(job.job_id),1500);
      } else {
        if (window.toast?.error) window.toast.error("Müzik üretiminde hata oluştu.");
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
    if (!id) return;

    upsertJob({ ...job, job_id:id, __ui_state:"processing", __audio_src:"", __player_added:false });
    render();
    pollJob(id);
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
      </div>
    `;

    // put list into rp-body (not directly under host)
    const body = hostEl.querySelector(".rp-body") || hostEl;
    listEl = body.querySelector(".aivo-player-list");
    if (!listEl){
      listEl = document.createElement("div");
      listEl.className = "aivo-player-list";
      listEl.id = "musicList";
      body.appendChild(listEl);
    }

    render();

    // resume polling existing jobs
    jobs.forEach(j => (j?.job_id || j?.id) && pollJob(j.job_id || j.id));

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
