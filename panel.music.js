/* =========================================================
   AIVO Right Panel — Music Panel (CUSTOM PLAYER UI)
   File: /js/panel.music.js
   - UI: senin "aivo-player-card" tasarımın (STATIC CARD v1 ile uyumlu)
   - Davranış: panel.music.js yönetir (play/pause/progress/actions)
   - Job kaynağı: studio.music.generate.js -> "aivo:job" event
   - Status: /api/music/status?job_id=...
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.jobs.v3";
  const MAX_UI    = 2;

  let hostEl = null;
  let listEl = null;
  let alive  = true;
  let jobs   = loadJobs();

  // single shared audio engine (custom UI controls this)
  let audioEl = null;
  let rafId = 0;
  let currentJobId = null;

  /* ---------------- utils ---------------- */
  const qs  = (s, r=document)=>r.querySelector(s);
  const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

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

  function ensureAudio(){
    if (audioEl) return audioEl;
    audioEl = document.getElementById("aivoAudio");
    if (!audioEl){
      audioEl = document.createElement("audio");
      audioEl.id = "aivoAudio";
      audioEl.preload = "metadata";
      audioEl.crossOrigin = "anonymous";
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
    }
    // when ended -> reset play state
    audioEl.onended = () => {
      setCardPlaying(currentJobId, false);
      currentJobId = null;
      stopRaf();
    };
    audioEl.onpause = () => {
      // user paused
      if (currentJobId) setCardPlaying(currentJobId, false);
      stopRaf();
    };
    audioEl.onplay = () => {
      if (currentJobId) setCardPlaying(currentJobId, true);
      startRaf();
    };
    return audioEl;
  }

  function loadJobs(){
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveJobs(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0, 50))); } catch {}
  }

  function upsertJob(job){
    const id = job?.job_id || job?.id;
    if (!id) return;
    const i = jobs.findIndex(j => (j.job_id || j.id) === id);
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

  function fmtTime(sec){
    sec = Number(sec || 0);
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  /* ---------------- polling timers ---------------- */
  if (!window.__AIVO_MUSIC_POLL_TIMERS__) window.__AIVO_MUSIC_POLL_TIMERS__ = new Map();
  const TMAP = window.__AIVO_MUSIC_POLL_TIMERS__;

  function schedulePoll(jobId, ms){
    if (!alive || !jobId) return;
    if (TMAP.has(jobId)) return;
    const tid = setTimeout(() => {
      TMAP.delete(jobId);
      poll(jobId);
    }, ms);
    TMAP.set(jobId, tid);
  }

  function clearPoll(jobId){
    const tid = TMAP.get(jobId);
    if (tid) clearTimeout(tid);
    TMAP.delete(jobId);
  }

  function clearAllPolls(){
    for (const tid of TMAP.values()) clearTimeout(tid);
    TMAP.clear();
  }

  /* ---------------- UI render ---------------- */
  function renderCard(job){
    const jobId = job.job_id || job.id;
    const st = job.__ui_state || "processing";

    const title = job.title || "Müzik Üretimi";
    const sub   = job.subtitle || "";
    const lang  = job.lang || "Türkçe";
    const dur   = job.duration || job.__duration || "";
    const date  = job.created_at || job.createdAt || job.__createdAt || "";

    const tagReady = `<span class="aivo-tag is-ready">Hazır</span>`;
    const tagProc  = `<span class="aivo-tag is-loading">Hazırlanıyor</span>`;
    const tagErr   = `<span class="aivo-tag is-error">Hata</span>`;

    const leftBtn = (st === "ready" && job.__audio_src)
      ? `
        <button class="aivo-player-btn" data-action="toggle-play" aria-label="Oynat/Durdur" title="Oynat/Durdur">
          <svg class="icon-play" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 5v14l11-7-11-7z" fill="currentColor"></path>
          </svg>
          <svg class="icon-pause" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:none">
            <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"></path>
          </svg>
        </button>`
      : `<div class="aivo-player-spinner" title="İşleniyor"></div>`;

    const tags =
      st === "ready" ? `${tagReady}<span class="aivo-tag">${esc(lang)}</span>` :
      st === "error" ? `${tagErr}` :
      `${tagProc}`;

    const metaLeft = dur ? esc(dur) : "0:00";
    const metaRight = date ? esc(date) : "";

    const disabled = (st !== "ready" || !job.__audio_src) ? 'data-disabled="1"' : "";

    return `
<div class="aivo-player-card ${st === "ready" ? "is-ready" : st === "error" ? "is-error" : "is-loading"}"
  data-job-id="${esc(jobId)}"
  data-output-id="${esc(job.output_id || "")}"
  data-src="${esc(job.__audio_src || "")}"
  ${disabled}>

  <!-- LEFT -->
  <div class="aivo-player-left">
    ${leftBtn}
  </div>

  <!-- MID -->
  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(title)}</div>
      <div class="aivo-player-tags">${tags}</div>
    </div>

    <div class="aivo-player-sub">${esc(sub)}</div>

    <div class="aivo-player-meta">
      <span class="meta-dur">${metaLeft}</span>
      <span class="aivo-player-dot"></span>
      <span class="meta-date">${metaRight}</span>
    </div>

    <div class="aivo-player-controls">
      <div class="aivo-progress" title="İlerleme">
        <i style="width:${esc(job.__progress || 0)}%"></i>
      </div>
    </div>
  </div>

  <!-- RIGHT ACTIONS -->
  <div class="aivo-player-actions">
    <button class="aivo-action" data-action="stems" title="Parçaları Ayır" aria-label="Parçaları Ayır">⋯</button>
    <button class="aivo-action is-blue" data-action="download" title="Dosyayı İndir" aria-label="Dosyayı İndir">⬇</button>
    <button class="aivo-action is-accent" data-action="extend" title="Süreyi Uzat" aria-label="Süreyi Uzat">⟲</button>
    <button class="aivo-action" data-action="revise" title="Yeniden Yorumla" aria-label="Yeniden Yorumla">✎</button>
    <button class="aivo-action is-danger" data-action="delete" title="Müziği Sil" aria-label="Müziği Sil">🗑</button>
  </div>
</div>`;
  }

  function render(){
    if (!ensureHost() || !ensureList()) return;

    const view = jobs
      .filter(j => j?.job_id || j?.id)
      .slice(0, MAX_UI);

    if (!view.length){
      listEl.innerHTML = `
        <div class="aivo-empty">
          <div class="aivo-empty-title">Üretilenler</div>
          <div class="aivo-empty-sub">Player kartları hazır olunca burada görünecek.</div>
        </div>`;
      return;
    }

    listEl.innerHTML = view.map(renderCard).join("");
  }

  /* ---------------- play / pause / progress ---------------- */
  function getCard(jobId){
    return qs(`.aivo-player-card[data-job-id="${CSS.escape(String(jobId))}"]`, hostEl || document);
  }

  function setCardPlaying(jobId, isPlaying){
    if (!jobId) return;
    const card = getCard(jobId);
    if (!card) return;

    const playIcon = qs(".icon-play", card);
    const pauseIcon = qs(".icon-pause", card);
    if (playIcon && pauseIcon){
      playIcon.style.display = isPlaying ? "none" : "";
      pauseIcon.style.display = isPlaying ? "" : "none";
    }
    card.classList.toggle("is-playing", !!isPlaying);
  }

  function updateProgressUI(){
    if (!audioEl || !currentJobId) return;
    const card = getCard(currentJobId);
    if (!card) return;

    const dur = audioEl.duration || 0;
    const cur = audioEl.currentTime || 0;
    const pct = dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;

    const bar = qs(".aivo-progress i", card);
    if (bar) bar.style.width = pct.toFixed(2) + "%";

    const durEl = qs(".meta-dur", card);
    // meta-dur'u kalan/ilerleyen gibi güncelleyebilirsin; şimdilik current/duration:
    if (durEl && dur > 0) durEl.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
  }

  function startRaf(){
    stopRaf();
    const tick = () => {
      updateProgressUI();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopRaf(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  async function togglePlayFromCard(card){
    const src = card?.dataset?.src || "";
    const jobId = card?.dataset?.jobId || card?.getAttribute("data-job-id") || "";
    if (!src || card?.dataset?.disabled === "1") return;

    const A = ensureAudio();

    // if switching track
    if (currentJobId && currentJobId !== jobId){
      setCardPlaying(currentJobId, false);
      try { A.pause(); } catch {}
    }

    // same track: toggle
    if (currentJobId === jobId && !A.paused){
      try { A.pause(); } catch {}
      return;
    }

    currentJobId = jobId;

    // if src changed or not set
    if (A.src !== src){
      A.src = src;
      try { await A.play(); } catch (e) {
        console.warn("[panel.music] play failed:", e);
        setCardPlaying(jobId, false);
      }
      return;
    }

    try { await A.play(); } catch (e) {
      console.warn("[panel.music] play failed:", e);
      setCardPlaying(jobId, false);
    }
  }

  function onCardClick(e){
    const btn = e.target.closest("[data-action]");
    const card = e.target.closest(".aivo-player-card");
    if (!card) return;

    const act = btn?.dataset?.action || null;

    // actions
    if (act){
      e.preventDefault();
      e.stopPropagation();

      if (act === "toggle-play") return togglePlayFromCard(card);

      // placeholder actions (şimdilik sadece log)
      const jobId = card.getAttribute("data-job-id");
      console.log("[panel.music] action:", act, "job:", jobId);
      if (window.toast?.info) window.toast.info(`Action: ${act}`);
      return;
    }

    // click anywhere on card -> toggle if ready
    if (card.classList.contains("is-ready")) togglePlayFromCard(card);
  }

  function onProgressSeek(e){
    const wrap = e.target.closest(".aivo-progress");
    if (!wrap) return;
    const card = e.target.closest(".aivo-player-card");
    if (!card) return;

    const jobId = card.getAttribute("data-job-id");
    if (!jobId || jobId !== currentJobId) return;
    if (!audioEl || !isFinite(audioEl.duration) || audioEl.duration <= 0) return;

    const rect = wrap.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const ratio = rect.width > 0 ? (x / rect.width) : 0;
    audioEl.currentTime = ratio * audioEl.duration;
    updateProgressUI();
  }

  /* ---------------- polling ---------------- */
  async function poll(jobId){
    if (!alive || !jobId) return;
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

      // normalize
      const job = j.job || {};
      job.job_id = job.job_id || j.job_id || jobId;

      const state = uiState(j.state || j.status || job.status);
      job.__ui_state = state;

      // src normalize
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

      // optional meta
      job.title = job.title || j?.title || "Müzik Üretimi";
      if (j?.duration) job.__duration = j.duration;
      if (j?.created_at) job.__createdAt = j.created_at;

      upsertJob(job);
      render();

      if (state === "ready"){
        // ready but src missing -> keep polling slower
        if (!src){
          schedulePoll(jobId, 2000);
          return;
        }
        // ready + src -> enable play
        // (kullanıcı tıklayınca çalacak)
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
      type: payload.type || "music",
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

    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Üretilenler</div>
          <div class="rp-body" id="musicList"></div>
        </div>
      </div>
    `;

    listEl = hostEl.querySelector("#musicList");
    listEl.className = "aivo-player-list";

    // bind events
    hostEl.addEventListener("click", onCardClick, true);
    hostEl.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".aivo-progress")) onProgressSeek(e);
    }, true);

    ensureAudio();
    render();

    // existing jobs -> poll
    jobs.slice(0, 10).forEach(j => (j?.job_id || j?.id) && poll(j.job_id || j.id));

    // listen new jobs
    window.addEventListener("aivo:job", onJob, true);

    console.log("[panel.music] mounted OK (custom player)");
  }

  function destroy(){
    alive = false;
    window.removeEventListener("aivo:job", onJob, true);
    clearAllPolls();
    stopRaf();
    try { if (audioEl) audioEl.pause(); } catch {}
    currentJobId = null;
    audioEl = null;
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
