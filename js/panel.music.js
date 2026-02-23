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

  function getBaseJobId(x){
    const raw = String(x || "").trim();
    if (!raw) return "";
    return raw.includes("::") ? raw.split("::")[0] : raw;
  }

  function ensureVersionCards(baseJobId, title, subtitle){
    const v1Id = `${baseJobId}::v1`;
    const v2Id = `${baseJobId}::v2`;

    upsertJob({
      job_id: v2Id,
      parent_job_id: baseJobId,
      version: 2,
      title: (title || "Müzik Üretimi") + " (Version 2)",
      subtitle: subtitle || "",
      __ui_state: "processing",
      __audio_src: "",
      output_id: ""
    });

    upsertJob({
      job_id: v1Id,
      parent_job_id: baseJobId,
      version: 1,
      title: (title || "Müzik Üretimi") + " (Version 1)",
      subtitle: subtitle || "",
      __ui_state: "processing",
      __audio_src: "",
      output_id: ""
    });
  }

  function setCardReady(baseJobId, version, src, outputId){
    const vid = `${baseJobId}::v${version}`;
    const i = jobs.findIndex(j => (j.job_id||j.id) === vid);
    if (i < 0) return;

    jobs[i] = {
      ...jobs[i],
      __ui_state: src ? "ready" : "processing",
      __audio_src: src || "",
      output_id: outputId || jobs[i].output_id || ""
    };
    saveJobs();
  }

  function setCardProcessing(baseJobId){
    for (const v of [1,2]){
      const vid = `${baseJobId}::v${v}`;
      const i = jobs.findIndex(j => (j.job_id||j.id) === vid);
      if (i < 0) continue;
      jobs[i] = { ...jobs[i], __ui_state: "processing" };
    }
    saveJobs();
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
    <button class="aivo-player-btn" data-action="toggle-play">▶</button>
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
    const baseJobId = getBaseJobId(jobId);
    if (!baseJobId) return;

    try{
      const r = await fetch(`/api/music/status?job_id=${encodeURIComponent(baseJobId)}`, { cache:"no-store" });
      const j = await r.json();

      if (!j?.ok){
        setCardProcessing(baseJobId);
        render();
        return setTimeout(()=>poll(baseJobId), 1500);
      }

      const outs = Array.isArray(j.outputs) ? j.outputs : [];
      // Backward compat: bazen sadece audio.src gelebilir
      if (outs.length === 0 && j?.audio?.src) {
        outs.push({ type:"audio", url:j.audio.src, meta:{ trackId: j.audio.output_id || "" } });
      }

      // 1) en az 1 çıktı
      if (outs[0]?.url) {
        setCardReady(baseJobId, 1, outs[0].url, outs[0]?.meta?.trackId || "");
      }

      // 2) ikinci versiyon
      if (outs[1]?.url) {
        setCardReady(baseJobId, 2, outs[1].url, outs[1]?.meta?.trackId || "");
      }

      render();

      const done = String(j.status || j.state || "").toLowerCase();
      const completed = ["completed","complete","ready","done","success"].includes(done);

      // İki parça da hazırsa toast + dur
      const v1 = jobs.find(x => (x.job_id||x.id) === `${baseJobId}::v1`);
      const v2 = jobs.find(x => (x.job_id||x.id) === `${baseJobId}::v2`);
      const bothReady = !!(v1?.__audio_src && v2?.__audio_src);

      if (bothReady || (completed && outs.length >= 1)) {
        if (bothReady) window.toast?.success?.("Müzikler hazır 🎵 (2 Version)");
        return;
      }

      setTimeout(()=>poll(baseJobId), 1500);
    }catch{
      setTimeout(()=>poll(baseJobId), 2000);
    }
  }

  /* ---------------- events ---------------- */
  function onJob(e){
    const job = e?.detail || e;
    if (!job?.job_id) return;

    const baseJobId = getBaseJobId(job.job_id);

    ensureVersionCards(baseJobId, job.title, job.subtitle);
    render();
    poll(baseJobId);
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

    // LocalStorage’dan gelen job’larda parent/base id’leri tekilleştirip poll et
    const bases = new Set();
    for (const j of jobs){
      const base = j?.parent_job_id || getBaseJobId(j?.job_id || j?.id);
      if (base) bases.add(base);
    }
    for (const base of bases) poll(base);

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

/* panel.music.js içine ekle (bir kere) */
function addToPlayerSafe({ jobId, outputId, src, title }) {
  const P = window.AIVO_PLAYER || window.AIVO_PLAYER_V1 || window.__AIVO_PLAYER_V1__;
  if (!P || typeof P.add !== "function") {
    console.warn("[panel.music] AIVO_PLAYER.add yok");
    return false;
  }

  const payload = {
    type: "audio",
    job_id: jobId,
    output_id: outputId,
    src,
    title: title || "Müzik Üretimi",
  };

  try {
    const r = P.add(payload);
    console.log("[panel.music] player.add(payload) ok", r);
    return true;
  } catch (e1) {
    console.warn("[panel.music] player.add(payload) fail, element denenecek", e1);
  }

  try {
    const el = document.createElement("div");
    el.className = "aivo-player-card";
    el.dataset.jobId = jobId;
    el.dataset.outputId = outputId;
    el.dataset.src = src;
    el.innerHTML = `
      <div class="aivo-player-title">${title || "Müzik Üretimi"}</div>
      <button class="toggle-play" type="button">Play</button>
      <div class="progress"><div class="bar"></div></div>
    `;
    const r2 = P.add(el);
    console.log("[panel.music] player.add(el) ok", r2);
    return true;
  } catch (e2) {
    console.error("[panel.music] player.add(el) fail", e2);
    return false;
  }
}
