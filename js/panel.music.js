/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION)
   File: /js/panel.music.js
   - Multi-track (TopMediai v3): internal_job_id ile poll eder
   - outputs[] içindeki her track’i ayrı kart olarak render eder
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.jobs.v1";

  let hostEl = null;
  let listEl = null;
  let jobs   = loadJobs(); // burada artık "track job" listesi tutuyoruz

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
    const id = job?.id || job?.job_id;
    if (!id) return;
    const i = jobs.findIndex(j => (j.id||j.job_id) === id);
    if (i >= 0) jobs[i] = { ...jobs[i], ...job };
    else jobs.unshift(job);
    saveJobs();
  }

  function removeByPrefix(prefix){
    const p = String(prefix||"");
    if (!p) return;
    jobs = jobs.filter(j => {
      const id = String(j.id || j.job_id || "");
      return !(id === p || id.startsWith(p + ":"));
    });
    saveJobs();
  }

  function uiState(status){
    const s = String(status||"").toLowerCase();
    if (["ready","done","completed","success"].includes(s)) return "ready";
    if (["error","failed"].includes(s)) return "error";
    return "processing";
  }

  /* ---------------- cards ---------------- */
  function renderMusicCard(job){
    const id = job.id || job.job_id;
    const ready = job.__ui_state === "ready" && job.__audio_src;

    if (!ready){
      return `
<div class="aivo-player-card is-loadingState" data-job-id="${esc(id)}">
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
    <button class="aivo-action is-danger" data-action="delete" data-id="${esc(id)}">Sil</button>
  </div>
</div>`;
    }

    return `
<div class="aivo-player-card is-ready"
     data-job-id="${esc(id)}"
     data-src="${esc(job.__audio_src)}"
     data-output-id="${esc(job.output_id || "")}">
  <div class="aivo-player-left">
    <button class="aivo-player-btn" data-action="toggle-play" data-id="${esc(id)}">▶</button>
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(job.title || "Müzik")}</div>
      <div class="aivo-player-tags">
        <span class="aivo-tag is-ready">Hazır</span>
      </div>
    </div>
    <div class="aivo-player-sub">${esc(job.subtitle || "")}</div>
    <audio preload="none" style="display:none" src="${esc(job.__audio_src)}"></audio>
  </div>

  <div class="aivo-player-actions">
    <a class="aivo-action is-blue" data-action="download" href="${esc(job.__audio_src)}" download>İndir</a>
    <button class="aivo-action is-danger" data-action="delete" data-id="${esc(id)}">Sil</button>
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
      .filter(j => (j.id || j.job_id))
      .slice(0,6)
      .map(renderMusicCard)
      .join("");
  }

  /* ---------------- playback (no player.js dependency) ---------------- */
  function stopAll(){
    if (!listEl) return;
    listEl.querySelectorAll("audio").forEach(a => {
      try { a.pause(); a.currentTime = 0; } catch {}
    });
    listEl.querySelectorAll('[data-action="toggle-play"]').forEach(btn => { btn.textContent = "▶"; });
  }

  function togglePlayById(id){
    const card = listEl?.querySelector(`.aivo-player-card[data-job-id="${CSS.escape(String(id))}"]`);
    if (!card) return;
    const audio = card.querySelector("audio");
    const btn = card.querySelector('[data-action="toggle-play"]');
    if (!audio || !btn) return;

    // başka bir şey çalıyorsa kapat
    const isPlaying = !audio.paused && !audio.ended;
    stopAll();

    if (isPlaying) return; // zaten çalıyordu; stopAll kapattı

    // yeniden play
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(()=>{});
      btn.textContent = "⏸";
    } catch {}
  }

  /* ---------------- polling (MULTI-TRACK via internal_job_id) ---------------- */
  async function pollInternal(internalJobId, meta){
    const jid = String(internalJobId || "").trim();
    if (!jid) return;

    try{
      const r = await fetch(`/api/music/status?job_id=${encodeURIComponent(jid)}`, {cache:"no-store"});
      const j = await r.json();

      // ok:false bile olsa processing kabul edip tekrar dene
      if (!j || (j.ok === false && String(j.error||"") === "missing_provider_song_ids")){
        return setTimeout(()=>pollInternal(jid, meta),1500);
      }

      const state = uiState(j.status || j.state);
      const outs = Array.isArray(j.outputs) ? j.outputs : [];

      if (outs.length){
        // Aynı internal job’a ait eski track kartlarını temizle (yeniden yazacağız)
        removeByPrefix(jid);

        outs.forEach((o, idx) => {
          const trackId = o?.meta?.trackId || o?.meta?.track_id || o?.trackId || o?.id || String(idx+1);
          const url = o?.url || "";
          const titleBase = (meta?.title || "Müzik Üretimi").trim();

          upsertJob({
            id: `${jid}:${trackId}`,
            parent_job_id: jid,
            output_id: trackId,
            title: `${titleBase} • V${idx+1}`,
            subtitle: meta?.subtitle || "",
            __ui_state: (state === "ready" ? "ready" : "processing"),
            __audio_src: url
          });
        });

        render();

        if (state !== "ready"){
          setTimeout(()=>pollInternal(jid, meta),1500);
        } else {
          window.toast?.success?.("Müzik hazır 🎵");
        }
        return;
      }

      // outputs yoksa processing kartı tut
      upsertJob({
        id: jid,
        title: meta?.title || "Müzik Üretimi",
        subtitle: meta?.subtitle || "",
        __ui_state: state,
        __audio_src: ""
      });
      render();

      if (state !== "ready"){
        setTimeout(()=>pollInternal(jid, meta),1500);
      }

    }catch{
      setTimeout(()=>pollInternal(jid, meta),2000);
    }
  }

  /* ---------------- events ---------------- */
  function onJob(e){
    const raw = e?.detail || e || {};
    // KRİTİK: internal_job_id varsa onu kullan (2 versiyon ancak böyle gelir)
    const internalId = String(raw.internal_job_id || raw.internalJobId || "").trim();
    const fallbackId = String(raw.job_id || raw.id || "").trim();
    const jid = internalId || fallbackId;
    if (!jid) return;

    // processing placeholder
    upsertJob({
      id: jid,
      title: raw.title || "Müzik Üretimi",
      subtitle: raw.subtitle || "",
      __ui_state: "processing",
      __audio_src: ""
    });

    render();
    pollInternal(jid, { title: raw.title, subtitle: raw.subtitle });
  }

  /* ---------------- actions ---------------- */
  function onClick(ev){
    const el = ev.target?.closest?.("[data-action]");
    if (!el) return;

    const act = el.getAttribute("data-action");
    const id  = el.getAttribute("data-id") || el.closest(".aivo-player-card")?.getAttribute("data-job-id");
    if (!act || !id) return;

    if (act === "toggle-play"){
      ev.preventDefault();
      togglePlayById(id);
      return;
    }

    if (act === "delete"){
      ev.preventDefault();
      stopAll();
      const parent = String(id).includes(":") ? String(id).split(":")[0] : String(id);
      // tek track silinse de listeden kalksın
      jobs = jobs.filter(j => (j.id||j.job_id) !== id);
      // parent tek başınaysa onu da kaldır
      jobs = jobs.filter(j => (j.id||j.job_id) !== parent);
      saveJobs();
      render();
      return;
    }
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

    // Stored jobs: parent_job_id varsa parent poll et; yoksa id parent kabul et
    const parents = new Set();
    jobs.forEach(j => {
      const p = j.parent_job_id || (String(j.id||j.job_id||"").includes(":") ? String(j.id||j.job_id).split(":")[0] : (j.id||j.job_id));
      if (p) parents.add(String(p));
    });
    parents.forEach(pid => pollInternal(pid, { title: "Müzik Üretimi", subtitle: "" }));

    listEl.addEventListener("click", onClick);
    window.addEventListener("aivo:job", onJob);
  }

  function destroy(){
    stopAll();
    try { listEl?.removeEventListener?.("click", onClick); } catch {}
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
