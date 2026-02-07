/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION)
   File: /js/panel.music.js
   - Panel listesi = job list (player değil)
   - Gerçek player entegrasyonu = SADECE AIVO_PLAYER.add(payloadObject)
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
      listEl.className = "aivo-job-list";
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

  /* ---------------- REAL PLAYER integration ---------------- */
  function addToRealPlayer({ jobId, outputId, src, title }){
    const P = window.AIVO_PLAYER;
    if (!P || typeof P.add !== "function") {
      console.warn("[panel.music] AIVO_PLAYER.add yok (player.js yüklenmedi?)");
      return false;
    }

    // ✅ Sadece payload object (gerçek player bunu kart olarak basıyor)
    const ok = P.add({
      type: "audio",
      job_id: jobId,
      output_id: outputId || "",
      src,
      title: title || "Müzik Üretimi",
    });

    if (!ok) console.warn("[panel.music] AIVO_PLAYER.add(payload) false döndü");
    else console.log("[panel.music] AIVO_PLAYER.add(payload) OK", jobId);

    return !!ok;
  }

  /* ---------------- poll timer guard (ANTI SPAM) ---------------- */
  if (!window.__AIVO_MUSIC_POLL_TIMERS__) {
    window.__AIVO_MUSIC_POLL_TIMERS__ = new Map(); // jobId -> timeoutId
  }

  function schedulePoll(jobId, ms){
    if (!alive) return;
    if (!jobId) return;

    const T = window.__AIVO_MUSIC_POLL_TIMERS__;
    if (T.has(jobId)) return;

    const tid = setTimeout(() => {
      T.delete(jobId);
      poll(jobId);
    }, ms);

    T.set(jobId, tid);
  }

  function clearPoll(jobId){
    const T = window.__AIVO_MUSIC_POLL_TIMERS__;
    const tid = T.get(jobId);
    if (tid) clearTimeout(tid);
    T.delete(jobId);
  }

  function clearAllPolls(){
    const T = window.__AIVO_MUSIC_POLL_TIMERS__;
    for (const tid of T.values()) clearTimeout(tid);
    T.clear();
  }

  /* ---------------- UI cards (panel job list) ---------------- */
  function renderCard(job){
    const jobId = job.job_id || job.id;
    const st = job.__ui_state || "processing";

    if (st === "ready") {
      return `
<div class="aivo-job-card is-ready" data-job-id="${esc(jobId)}">
  <div class="aivo-job-row">
    <div class="aivo-job-title">${esc(job.title || "Müzik")}</div>
    <span class="aivo-tag is-ready">Hazır</span>
  </div>
  <div class="aivo-job-sub">${esc(job.subtitle || "")}</div>
</div>`;
    }

    if (st === "error") {
      return `
<div class="aivo-job-card is-error" data-job-id="${esc(jobId)}">
  <div class="aivo-job-row">
    <div class="aivo-job-title">${esc(job.title || "Müzik Üretimi")}</div>
    <span class="aivo-tag is-error">Hata</span>
  </div>
  <div class="aivo-job-sub">${esc(job.error || "Üretim başarısız.")}</div>
</div>`;
    }

    return `
<div class="aivo-job-card is-loading" data-job-id="${esc(jobId)}">
  <div class="aivo-job-row">
    <div class="aivo-job-title">${esc(job.title || "Müzik Üretimi")}</div>
    <span class="aivo-tag is-loading">Hazırlanıyor</span>
  </div>
  <div class="aivo-job-sub">${esc(job.subtitle || "")}</div>
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
    if (!jobId) return;

    clearPoll(jobId);

    try{
      const r = await fetch(`/api/music/status?job_id=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
        credentials: "include",
      });

      let j = null;
      try { j = await r.json(); } catch { j = null; }

      if (!r.ok || !j){
        schedulePoll(jobId, 1500);
        return;
      }

      const job = j.job || {};
      job.job_id = job.job_id || j.job_id || jobId;

     const state = uiState(j.state || j.status || job.status);

      job.__ui_state = state;

      const src =
        j?.audio?.src ||
        j?.audio_src ||
        j?.result?.audio?.src ||
        j?.result?.src ||
        job?.audio?.src ||
        job?.result?.audio?.src ||
        job?.result?.src ||
        "";

      const outputId =
        j?.audio?.output_id ||
        j?.output_id ||
        j?.result?.output_id ||
        job?.output_id ||
        job?.result?.output_id ||
        "";

      job.__audio_src = src || "";
      job.output_id = job.output_id || outputId || "";
      job.title = job.title || j?.title || "Müzik Üretimi";

      upsertJob(job);
      render();

      if (state === "ready" && src){
        addToRealPlayer({
          jobId: job.job_id,
          outputId: job.output_id,
          src,
          title: job.title || "Müzik Üretimi",
        });

        window.toast?.success?.("Müzik hazır 🎵");
        return;
      }

      if (state === "error") return;

      schedulePoll(jobId, 1500);

    } catch(e){
      schedulePoll(jobId, 2000);
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

    // Panel shell (job list)
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Üretilenler</div>
          <div class="rp-body" id="musicList"></div>
        </div>
      </div>`;

    listEl = hostEl.querySelector("#musicList");
    listEl.className = "aivo-job-list";

    render();

    // existing jobs
    jobs.forEach(j => j?.job_id && poll(j.job_id));

    window.addEventListener("aivo:job", onJob, true);

    console.log("[panel.music] mounted OK");
  }

  function destroy(){
    alive = false;
    window.removeEventListener("aivo:job", onJob, true);
    clearAllPolls();
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
