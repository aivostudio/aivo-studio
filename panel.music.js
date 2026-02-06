/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION)
   File: /js/panel.music.js
   - Player integration: uses ONLY AIVO_PLAYER.add()
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.jobs.v2";

  let hostEl = null;
  let listEl = null;
  let jobs   = loadJobs();
  let alive  = true;

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
      listEl.id = "musicList";
      listEl.className = "aivo-player-list";
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

  function getPlayer(){
    return window.AIVO_PLAYER || window.AIVO_PLAYER_V1 || window.__AIVO_PLAYER_V1__ || null;
  }

  // Player only has add(). We'll try:
  // 1) add(payloadObject)
  // 2) add(domElement)
  function addToPlayerSafe({ jobId, outputId, src, title }){
    const P = getPlayer();
    if (!P || typeof P.add !== "function") {
      console.warn("[panel.music] AIVO_PLAYER.add yok");
      return false;
    }

    const payload = {
      type: "audio",
      job_id: jobId,
      output_id: outputId || "",
      src,
      title: title || "Müzik Üretimi",
    };

    try {
      P.add(payload);
      console.log("[panel.music] player.add(payload) OK", payload);
      return true;
    } catch (e1) {
      console.warn("[panel.music] player.add(payload) FAIL -> element denenecek", e1);
    }

    try {
      const el = document.createElement("div");
      el.className = "aivo-player-card";
      el.dataset.jobId = jobId;
      if (outputId) el.dataset.outputId = outputId;
      el.dataset.src = src;
      el.innerHTML = `
        <div class="aivo-player-title">${esc(title || "Müzik Üretimi")}</div>
        <button class="toggle-play" type="button">Play</button>
        <div class="progress"><div class="bar"></div></div>
      `;
      P.add(el);
      console.log("[panel.music] player.add(el) OK");
      return true;
    } catch (e2) {
      console.error("[panel.music] player.add(el) FAIL", e2);
      return false;
    }
  }

  /* ---------------- UI cards (panel list) ---------------- */
  function renderCard(job){
    const jobId = job.job_id || job.id;
    const st = job.__ui_state || "processing";

    if (st === "ready" && job.__audio_src) {
      return `
<div class="aivo-player-card is-ready" data-job-id="${esc(jobId)}">
  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(job.title || "Müzik")}</div>
      <div class="aivo-player-tags"><span class="aivo-tag is-ready">Hazır</span></div>
    </div>
    <div class="aivo-player-sub">${esc(job.subtitle || "")}</div>
  </div>
</div>`;
    }

    if (st === "error") {
      return `
<div class="aivo-player-card is-error" data-job-id="${esc(jobId)}">
  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(job.title || "Müzik Üretimi")}</div>
      <div class="aivo-player-tags"><span class="aivo-tag is-error">Hata</span></div>
    </div>
    <div class="aivo-player-sub">${esc(job.error || "Üretim başarısız.")}</div>
  </div>
</div>`;
    }

    return `
<div class="aivo-player-card is-loadingState" data-job-id="${esc(jobId)}">
  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(job.title || "Müzik Üretimi")}</div>
      <div class="aivo-player-tags"><span class="aivo-tag is-loading">Hazırlanıyor</span></div>
    </div>
    <div class="aivo-player-sub">${esc(job.subtitle || "")}</div>
  </div>
</div>`;
  }

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
      .slice(0, 8)
      .map(renderCard)
      .join("");
  }

/* ---------------- polling ---------------- */
async function poll(jobId){
  if (!alive) return;

  try{
    // ✅ DOĞRU ENDPOINT (music jobs)
    const r = await fetch(
      `/api/music/status?job_id=${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        credentials: "include",
      }
    );

    let j = null;
    try { j = await r.json(); } catch { j = null; }

    if (!r.ok || !j){
      return setTimeout(() => poll(jobId), 1500);
    }

    const state = uiState(j.status);
    const job = {
      job_id: jobId,
      id: jobId,
      title: "Müzik Üretimi",
      __ui_state: state,
    };

    // 🎵 audio normalize
    const src =
      j?.audio?.src ||
      j?.result?.audio?.src ||
      j?.result?.src ||
      "";

    const outputId =
      j?.audio?.output_id ||
      j?.result?.output_id ||
      "";

    job.__audio_src = src || "";
    job.output_id = outputId || "";

    upsertJob(job);
    render();

    if (state === "ready" && src){
      addToPlayerSafe({
        jobId,
        outputId,
        src,
        title: "Müzik Üretimi",
      });

      window.toast?.success?.("Müzik hazır 🎵");
      return;
    }

    if (state === "error"){
      window.toast?.error?.("Müzik üretimi başarısız.");
      return;
    }

    setTimeout(() => poll(jobId), 1500);

  } catch(e){
    console.warn("[panel.music] poll error", e);
    setTimeout(() => poll(jobId), 2000);
  }
}


  /* ---------------- events ---------------- */
  function onJob(e){
    const payload = e?.detail || e || {};
    const job_id = payload.job_id || payload.id;
    if (!job_id) return;

    upsertJob({
      job_id,
      id: job_id,
      type: "music",
      title: payload.title || "Müzik Üretimi",
      subtitle: payload.subtitle || "",
      __ui_state: "processing",
      __audio_src: ""
    });

    render();
    poll(job_id);
  }

  /* ---------------- panel integration ---------------- */
  function mount(){
    if (!ensureHost()) return;

    // panel shell
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Müzik</div>
          <div class="rp-body" id="musicList"></div>
        </div>
      </div>`;

    listEl = hostEl.querySelector("#musicList");
    listEl.className = "aivo-player-list";

    render();

    // existing jobs
    jobs.forEach(j => j?.job_id && poll(j.job_id));

    // listen for new job from studio.music.generate.js
    window.addEventListener("aivo:job", onJob, true);

    console.log("[panel.music] mounted OK");
  }

  function destroy(){
    alive = false;
    window.removeEventListener("aivo:job", onJob, true);
  }

  function register(){
    if (window.RightPanel?.register){
      window.RightPanel.register(PANEL_KEY, { mount, destroy });
      return true;
    }
    return false;
  }

  if (!register()){
    window.addEventListener("DOMContentLoaded", register, { once: true });
  }
})();
