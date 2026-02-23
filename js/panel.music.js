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
    try { localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0,80))); }
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

  function isVersionEntry(j){
    return typeof j?.parent_job_id === "string" && j.parent_job_id.length > 0;
  }

  function getParentJob(parentId){
    return jobs.find(x => (x?.job_id || x?.id) === parentId) || null;
  }

  function pruneParentIfHasVersions(parentId){
    // Parent card: sadece processing/error durumunda görünsün.
    // Eğer ready olduysa ve version kartları varsa, parent'ı listeden düşür (UI'da "tek kart" kalabalığı yapmasın).
    const parent = getParentJob(parentId);
    if (!parent) return;

    const hasVersions = jobs.some(j => isVersionEntry(j) && j.parent_job_id === parentId);
    if (!hasVersions) return;

    const st = String(parent.__ui_state || "").toLowerCase();
    if (st === "ready") {
      // parent'ı tamamen silmek yerine "hidden" işaretleyelim (geri debug için).
      upsertJob({ ...parent, __hidden: true });
    }
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
        <span class="aivo-tag is-loading">${esc(job.__ui_state === "error" ? "Hata" : "Hazırlanıyor")}</span>
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

    // Görünen liste:
    // - Version kartları (jobId::trackId) her zaman görünsün
    // - Parent kartlar sadece processing/error ise görünsün
    const visible = jobs
      .filter(j => (j?.job_id || j?.id))
      .filter(j => !j.__hidden)
      .filter(j => {
        if (isVersionEntry(j)) return true;
        // parent
        const st = String(j.__ui_state || "").toLowerCase();
        return st !== "ready"; // ready parent'ı saklıyoruz (version varsa)
      })
      .slice(0, 8);

    if (!visible.length){
      listEl.innerHTML = `
        <div class="aivo-empty">
          <div class="aivo-empty-title">Henüz müzik yok</div>
        </div>`;
      return;
    }

    listEl.innerHTML = visible.map(renderMusicCard).join("");
  }

  /* ---------------- polling ---------------- */
  async function poll(jobId){
    try{
      const r = await fetch(`/api/music/status?job_id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const j = await r.json();

      if (!j?.ok){
        // upstream/redis geçici olabilir, polling devam
        return setTimeout(()=>poll(jobId), 1500);
      }

      const parentId = jobId;

      // Parent job kaydı (durum için)
      const parentJob = (j.job && typeof j.job === "object") ? j.job : {};
      parentJob.job_id = parentJob.job_id || parentId;
      parentJob.__ui_state = uiState(j.status || parentJob.status);

      // MULTI-VERSION: outputs[] içindeki her audio => ayrı kart
      if (Array.isArray(j.outputs) && j.outputs.length) {
        upsertJob({
          ...parentJob,
          __audio_src: "",
          output_id: "",
        });

        const titleBase = parentJob.title || "Müzik Üretimi";
        const subtitle  = parentJob.subtitle || "";

        let audioCount = 0;

        for (let idx = 0; idx < j.outputs.length; idx++) {
          const out = j.outputs[idx];
          if (!out || out.type !== "audio" || !out.url) continue;

          audioCount++;

          const trackId =
            String(out?.meta?.trackId || out?.meta?.track_id || out?.id || "").trim() || String(audioCount);

          const versionJobId = `${parentId}::${trackId}`;

          upsertJob({
            job_id: versionJobId,
            parent_job_id: parentId,
            title: `${titleBase} • V${audioCount}`,
            subtitle,
            __ui_state: parentJob.__ui_state,
            __audio_src: out.url,
            output_id: trackId,
            __outputs_count: j.outputs.length,
          });
        }

        // parent ready ise ve versiyonlar basıldıysa parent'ı gizle
        pruneParentIfHasVersions(parentId);

        render();

        if (parentJob.__ui_state !== "ready"){
          setTimeout(()=>poll(parentId), 1500);
        } else {
          window.toast?.success?.("Müzik hazır 🎵");
        }

        return;
      }

      // outputs yoksa: sadece parent processing/error kartı
      upsertJob({
        ...parentJob,
        __audio_src: "",
        output_id: "",
      });

      render();

      if (parentJob.__ui_state !== "ready"){
        setTimeout(()=>poll(parentId), 1500);
      }

    } catch {
      setTimeout(()=>poll(jobId), 2000);
    }
  }

  /* ---------------- events ---------------- */
  function onJob(e){
    const job = e?.detail || e;
    const jobId = job?.job_id;
    if (!jobId) return;

    upsertJob({
      job_id: jobId,
      title: job.title,
      subtitle: job.subtitle,
      __ui_state: "processing",
      __audio_src: "",
      output_id: "",
      __hidden: false,
    });

    render();
    poll(jobId);
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

    // sadece parent job id'leri poll et (version id'leri poll edilmez)
    jobs
      .filter(j => (j?.job_id || j?.id))
      .filter(j => !isVersionEntry(j))
      .filter(j => !String(j.job_id || j.id).includes("::"))
      .forEach(j => j?.job_id && poll(j.job_id));

    window.addEventListener("aivo:job", onJob);
  }

  function destroy(){
    window.removeEventListener("aivo:job", onJob);
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
