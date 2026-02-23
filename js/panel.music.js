/* =========================================================
   AIVO Right Panel — Music Panel (PRODUCTION)
   File: /js/panel.music.js
   Notes:
   - provider_job_id -> status -> outputs[] (2 track) => 2 ayrı kart
   - 206 (Range) normaldir, hata değildir
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.tracks.v1"; // <-- job değil track saklıyoruz

  let hostEl = null;
  let listEl = null;
  let tracks = loadTracks(); // [{track_id, provider_job_id, title, subtitle, src, ui_state, created_at}]

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

  function uiState(status){
    const s = String(status||"").toLowerCase();
    if (["ready","done","completed","success","complete"].includes(s)) return "ready";
    if (["error","failed"].includes(s)) return "error";
    return "processing";
  }

  function loadTracks(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  }

  function saveTracks(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(tracks.slice(0,50))); }
    catch {}
  }

  function upsertTrack(t){
    const id = t?.track_id;
    if (!id) return;
    const i = tracks.findIndex(x => x.track_id === id);
    if (i >= 0) tracks[i] = { ...tracks[i], ...t };
    else tracks.unshift(t);
    saveTracks();
  }

  function removeTrack(trackId){
    tracks = tracks.filter(t => t.track_id !== trackId);
    saveTracks();
    render();
  }

  function getProviderJobIdsNeedingPoll(){
    const set = new Set();
    for (const t of tracks){
      if (t?.provider_job_id && t.ui_state !== "ready" && t.ui_state !== "error"){
        set.add(t.provider_job_id);
      }
    }
    return Array.from(set);
  }

  /* ---------------- UI ---------------- */
  function renderCard(t){
    const ready = t.ui_state === "ready" && t.src;

    if (!ready){
      return `
<div class="aivo-player-card is-loadingState"
     data-track-id="${esc(t.track_id)}"
     data-provider-job-id="${esc(t.provider_job_id)}">

  <div class="aivo-player-left">
    <div class="aivo-player-spinner"></div>
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(t.title || "Müzik Üretimi")}</div>
      <div class="aivo-player-tags">
        <span class="aivo-tag is-loading">Hazırlanıyor</span>
      </div>
    </div>
    <div class="aivo-player-sub">${esc(t.subtitle || "")}</div>
  </div>

  <div class="aivo-player-actions">
    <button class="aivo-action is-danger" data-action="delete" data-track-id="${esc(t.track_id)}">Sil</button>
  </div>
</div>`;
    }

    return `
<div class="aivo-player-card is-ready"
     data-track-id="${esc(t.track_id)}"
     data-provider-job-id="${esc(t.provider_job_id)}"
     data-src="${esc(t.src)}">

  <div class="aivo-player-left">
    <span class="aivo-tag is-ready">Hazır</span>
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(t.title || "Müzik")}</div>
    </div>
    <div class="aivo-player-sub">${esc(t.subtitle || "")}</div>

    <audio class="aivo-audio"
           preload="metadata"
           controls
           src="${esc(t.src)}"></audio>
  </div>

  <div class="aivo-player-actions">
    <a class="aivo-action is-blue"
       href="${esc(t.src)}"
       download
       rel="noopener">İndir</a>
    <button class="aivo-action is-danger" data-action="delete" data-track-id="${esc(t.track_id)}">Sil</button>
  </div>
</div>`;
  }

  function render(){
    if (!ensureHost()) return;

    if (!listEl){
      listEl = hostEl.querySelector("#musicList");
      if (!listEl){
        listEl = document.createElement("div");
        listEl.className = "aivo-player-list";
        listEl.id = "musicList";
        hostEl.appendChild(listEl);
      }
    }

    if (!tracks.length){
      listEl.innerHTML = `
        <div class="aivo-empty">
          <div class="aivo-empty-title">Henüz müzik yok</div>
        </div>`;
      return;
    }

    listEl.innerHTML = tracks
      .filter(t => t?.track_id)
      .slice(0,8)
      .map(renderCard)
      .join("");
  }

  /* ---------------- polling ----------------
     Endpoint: /api/music/status?provider_job_id=XXXX
     Expected when ready:
       - ok:true
       - status/state: completed/ready
       - outputs: [{type:"audio", url:"...", meta:{trackId:"..."}} ...]
  ------------------------------------------ */
  async function pollProviderJob(providerJobId){
    if (!providerJobId) return;

    try{
      const r = await fetch(`/api/music/status?provider_job_id=${encodeURIComponent(providerJobId)}`, { cache:"no-store" });
      const j = await r.json();

      // ok:false => tekrar dene
      if (!j?.ok){
        setTimeout(()=>pollProviderJob(providerJobId), 1500);
        return;
      }

      const state = uiState(j.status || j.state);

      // outputs geldiyse: her output için ayrı track oluştur/upsert et
      if (Array.isArray(j.outputs) && j.outputs.length){
        j.outputs.forEach((out, idx) => {
          if (!out?.url) return;
          const trackId = out?.meta?.trackId || out?.meta?.song_id || out?.id || out.url;

          upsertTrack({
            track_id: String(trackId),
            provider_job_id: String(providerJobId),
            title: (j?.topmediai?.data?.[idx]?.title) || (idx === 0 ? "Versiyon 1" : `Versiyon ${idx+1}`),
            subtitle: (j?.topmediai?.data?.[idx]?.style) || "",
            src: out.url,
            ui_state: "ready",
            created_at: Date.now()
          });
        });

        render();
        window.toast?.success?.("Müzikler hazır 🎵");
        return;
      }

      // outputs yoksa (processing): providerJobId’ye bağlı track’leri processing tut
      // (Kart sayısı generate tarafında 2 adet seed’leniyor)
      tracks.forEach(t => {
        if (t.provider_job_id === String(providerJobId) && t.ui_state !== "ready"){
          t.ui_state = state;
        }
      });
      saveTracks();
      render();

      if (state !== "ready" && state !== "error"){
        setTimeout(()=>pollProviderJob(providerJobId), 1500);
      }
    }catch{
      setTimeout(()=>pollProviderJob(providerJobId), 2000);
    }
  }

  /* ---------------- events ----------------
     Beklenen event payload:
       { provider_job_id, provider_song_ids:[id1,id2], title?, subtitle? }
     Not: provider_song_ids varsa 2 kartı EN BAŞTA seed’liyoruz.
  ------------------------------------------ */
  function onJob(e){
    const job = e?.detail || e;

    const providerJobId = job?.provider_job_id || job?.job_id || job?.id;
    if (!providerJobId) return;

    const songIds = Array.isArray(job.provider_song_ids) ? job.provider_song_ids : [];

    // 2 kartı daha "processing" aşamasında oluştur (UI hemen 2 slot görsün)
    if (songIds.length){
      songIds.forEach((sid, idx) => {
        upsertTrack({
          track_id: String(sid),
          provider_job_id: String(providerJobId),
          title: job.title || (idx === 0 ? "Versiyon 1" : `Versiyon ${idx+1}`),
          subtitle: job.subtitle || "",
          src: "",
          ui_state: "processing",
          created_at: Date.now()
        });
      });
    } else {
      // songId gelmezse yine de tek placeholder oluştur
      upsertTrack({
        track_id: String(providerJobId) + ":v1",
        provider_job_id: String(providerJobId),
        title: job.title || "Müzik Üretimi",
        subtitle: job.subtitle || "",
        src: "",
        ui_state: "processing",
        created_at: Date.now()
      });
    }

    render();
    pollProviderJob(String(providerJobId));
  }

  function onClick(e){
    const btn = e.target?.closest?.("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    if (action === "delete"){
      const trackId = btn.getAttribute("data-track-id");
      if (trackId) removeTrack(trackId);
    }
  }

  /* ---------------- panel integration ---------------- */
  function mount(){
    if (!ensureHost()) return;

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

    // eski track’lerden poll gerektiren provider_job_id’leri devam ettir
    getProviderJobIdsNeedingPoll().forEach(pollProviderJob);

    window.addEventListener("aivo:job", onJob);
    hostEl.addEventListener("click", onClick);
  }

  function destroy(){
    window.removeEventListener("aivo:job", onJob);
    hostEl?.removeEventListener?.("click", onClick);
  }

  function register(){
    if (window.RightPanel?.register){
      window.RightPanel.register(PANEL_KEY, { mount, destroy });
      return true;
    }
    return false;
  }

  if (!register()){
    window.addEventListener("DOMContentLoaded", register, { once:true });
  }
})();
