/* =========================================================
   AIVO Right Panel — Music Panel (CUSTOM PLAYER UI)
   File: /js/panel.music.js

   ✅ FIX (DB source-of-truth):
   - DBJobs.create(...) artık togglePlayFromCard içinde DEĞİL.
   - Controller panel açılır açılmaz mount() içinde başlar.
   - destroy() içinde düzgün kapanır.

   - UI: "aivo-player-card" (CUSTOM)
   - Job kaynağı: studio.music.generate.js -> "aivo:job" event
   - DB kaynağı: /api/jobs/list?app=music + (varsa) DBJobs controller
   - Status: /api/music/status?provider_job_id=...
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const LS_KEY    = "aivo.music.jobs.v3"; // opsiyonel cache

  // ✅ DB controller
  let dbCtrl = null;

  // panel state
  let hostEl = null;
  let listEl = null;
  let alive  = true;
  let jobs   = [];

  // audio engine
  let audioEl = null;
  let rafId = 0;
  let currentJobId = null;

  /* ---------------- utils ---------------- */
  const qs  = (s, r=document)=>r.querySelector(s);

  function toast(type, msg){
    try{
      const t = window.toast;
      if (!t) return;
      if (type === "info" && t.info) return t.info(msg);
      if (type === "success" && t.success) return t.success(msg);
      if (type === "error" && t.error) return t.error(msg);
      if (t.show) return t.show(msg);
    } catch {}
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function safeId(x){
    return String(x || "").trim();
  }

  function norm(s){
    return String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  function isMusicApp(x){
    const a = norm(x);
    return a === "music" || a.includes("music");
  }

  function toMs(v){
    if (v == null) return 0;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }
    // Safari "YYYY-MM-DD HH:mm:ss" fix
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s) && !s.includes("T")) {
      const iso = s.replace(" ", "T") + "Z";
      const tIso = Date.parse(iso);
      if (Number.isFinite(tIso)) return tIso;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function uiState(status){
    const s = String(status||"").toLowerCase();
    if (["ready","done","completed","success","succeeded"].includes(s)) return "ready";
    if (["error","failed","fail"].includes(s)) return "error";
    return "processing";
  }

  function fmtTime(sec){
    sec = Number(sec || 0);
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  /* ---------------- audio ---------------- */
  function ensureAudio(){
    if (audioEl) return audioEl;

    audioEl = document.getElementById("aivoAudio");

    if (!audioEl){
      audioEl = document.createElement("audio");
      audioEl.id = "aivoAudio";
      audioEl.preload = "metadata";
      audioEl.crossOrigin = "anonymous"; // eq
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
    }

    initEqEngine();

    audioEl.onended = () => {
      setCardPlaying(currentJobId, false);
      currentJobId = null;
      stopRaf();
      stopEqLoop();
    };

    audioEl.onpause = () => {
      if (currentJobId) setCardPlaying(currentJobId, false);
      stopRaf();
      stopEqLoop();
    };

    audioEl.onplay = () => {
      if (currentJobId) setCardPlaying(currentJobId, true);
      startRaf();
      startEqLoop();
    };

    return audioEl;
  }

  /* ---------------- EQ engine (beat-reactive) ---------------- */
  let eqRaf = 0;

  function initEqEngine(){
    if(!audioEl) return;
    if(audioEl.__eqInited) return;
    audioEl.__eqInited = true;

    let ctx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e){
      console.warn("[music:eq] AudioContext not available", e);
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;

    let srcNode = null;
    try {
      srcNode = ctx.createMediaElementSource(audioEl);
    } catch (e){
      console.warn("[music:eq] createMediaElementSource failed (already?)", e);
      return;
    }

    srcNode.connect(analyser);
    analyser.connect(ctx.destination);

    const freq = new Uint8Array(analyser.frequencyBinCount);
    audioEl.__eq = { ctx, analyser, freq };

    audioEl.addEventListener("play", () => {
      try { ctx.resume?.(); } catch {}
      startEqLoop();
    }, { passive:true });

    audioEl.addEventListener("pause", () => stopEqLoop(), { passive:true });
    audioEl.addEventListener("ended", () => stopEqLoop(), { passive:true });
  }

  function startEqLoop(){
    if(eqRaf) return;
    eqTick();
  }

  function stopEqLoop(){
    if(eqRaf){
      cancelAnimationFrame(eqRaf);
      eqRaf = 0;
    }
    setEqBars(0.08, 0.06, 0.04);
  }

  function eqTick(){
    eqRaf = requestAnimationFrame(eqTick);
    if(!audioEl || audioEl.paused) return;

    const pack = audioEl.__eq;
    if(!pack) return;

    const { analyser, freq } = pack;
    analyser.getByteFrequencyData(freq);

    const low  = bandAvg(freq, 2, 10);
    const mid  = bandAvg(freq, 10, 28);
    const high = bandAvg(freq, 28, 60);

    const L = clamp01(low  / 255);
    const M = clamp01(mid  / 255);
    const H = clamp01(high / 255);

    setEqBars(L, M, H);
  }

  function bandAvg(arr, a, b){
    let sum = 0, n = 0;
    const end = Math.min(arr.length, b);
    for(let i = Math.max(0,a); i < end; i++){
      sum += arr[i];
      n++;
    }
    return n ? (sum / n) : 0;
  }

  function clamp01(x){
    if(x < 0) return 0;
    if(x > 1) return 1;
    return x;
  }

  function setEqBars(L, M, H){
    if(!currentJobId) return;
    const card = hostEl?.querySelector?.(`.aivo-player-card[data-job-id="${CSS.escape(String(currentJobId))}"]`);
    if(!card) return;

    const bars = card.querySelectorAll(".aivo-player-btn .aivo-eq i");
    if(!bars || !bars.length) return;

    const v = [
      0.20 + H*0.70,
      0.25 + M*0.85,
      0.30 + L*1.00,
      0.25 + L*1.15,
      0.30 + L*1.00,
      0.25 + M*0.85,
      0.20 + H*0.70,
    ];

    for(let i=0;i<bars.length;i++){
      const k = v[i] ?? 0.2;
      const s = clamp01(k);
      bars[i].style.transform = `scaleY(${0.15 + s*1.15})`;
    }
  }

  /* ---------------- jobs storage ---------------- */
  function loadJobs(){
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveJobs(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0, 200))); } catch {}
  }

  function upsertJob(job){
    const id = job?.job_id || job?.id;
    if (!id) return;

    const i = jobs.findIndex(j => (j.job_id || j.id) === id);
    if (i >= 0) jobs[i] = { ...jobs[i], ...job };
    else jobs.unshift(job);

    saveJobs();
  }

  function removeJob(jobId){
    jobId = safeId(jobId);
    if (!jobId) return;

    if (currentJobId === jobId && audioEl){
      try { audioEl.pause(); } catch {}
      setCardPlaying(jobId, false);
      currentJobId = null;
      stopRaf();
    }

    clearPoll(jobId);
    jobs = jobs.filter(j => (j.job_id || j.id) !== jobId);
    saveJobs();
    render();
  }

  /* ---------------- DB row -> 2 cards ---------------- */
  function mapDbJobToCards(j){
    const meta = j?.meta || {};
    const appGuess = String(j?.app || meta?.app || meta?.module || meta?.routeKey || "").trim();
    if (appGuess && !isMusicApp(appGuess)) return [];

    const provider_job_id = String(
      meta?.provider_job_id ||
      meta?.providerJobId ||
      j?.provider_job_id ||
      j?.providerJobId ||
      ""
    ).trim();

    const baseId = provider_job_id || String(j?.job_id || j?.id || "").trim();
    if (!baseId) return [];

    const songIds = Array.isArray(meta?.provider_song_ids)
      ? meta.provider_song_ids
      : (Array.isArray(j?.provider_song_ids) ? j.provider_song_ids : []);

    const songIdOrig = String(songIds[0] || provider_job_id || baseId).trim();
    const songIdRev  = String(songIds[1] || songIds[0] || provider_job_id || baseId).trim();

    const createdMs =
      toMs(j?.created_at) || toMs(j?.createdAt) || toMs(meta?.created_at) || Date.now();

    const rawStatus = norm(j?.db_status || j?.status || j?.state || "");
    const ui =
      ["ready","done","completed","success","succeeded"].includes(rawStatus) ? "ready"
      : ["error","failed","fail"].includes(rawStatus) ? "error"
      : "processing";

    const baseCommon = {
      type: "music",
      provider_job_id: provider_job_id || baseId,
      __real_job_id: String(meta?.internal_job_id || meta?.job_id || j?.job_id || "").trim() || null,
      __ui_state: ui,
      __audio_src: "",
      __createdAt: (j?.created_at || meta?.created_at || ""),
      created_at: (j?.created_at || meta?.created_at || ""),
      createdAt: createdMs,
      title: String(meta?.title || "").trim(),
      lyrics: String(meta?.lyrics || "").trim(),
      prompt: String(meta?.prompt || j?.prompt || "").trim(),
      subtitle: String(meta?.subtitle || "").trim(),
      lang: String(meta?.lang || meta?.language || "").trim(),
      __duration: String(meta?.duration || "").trim(),
    };

    return [
      { ...baseCommon, job_id: `${baseId}::orig`, id: `${baseId}::orig`, __provider_song_id: songIdOrig },
      { ...baseCommon, job_id: `${baseId}::rev1`, id: `${baseId}::rev1`, __provider_song_id: songIdRev  },
    ];
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
    if (st === "processing" && !job.__loading_startedAt) {
      job.__loading_startedAt = Date.now();
    }

    const title =
      (String(job?.title || "").trim()) ||
      (String(job?.lyrics || "").replace(/\r/g,"").split("\n").map(s=>s.trim()).find(Boolean) || "") ||
      (String(job?.prompt || "").trim().split(/\s+/).slice(0,2).join(" ") || "");

    const sub   = job.subtitle || "";
    const dur   = job.duration || job.__duration || "";
    const date  = job.created_at || job.createdAt || job.__createdAt || "";

    const tagReady = `<span class="aivo-tag is-ready">Hazır</span>`;
    const tagProc  = `<span class="aivo-tag is-loading">Hazırlanıyor…</span>`;
    const tagErr   = `<span class="aivo-tag is-error">Hata</span>`;

    const isReady = (job.__ui_state === "ready") && !!job.__audio_src;

    const leftBtn = `
      <button class="aivo-player-btn"
        data-action="toggle-play"
        aria-label="Oynat/Durdur"
        title="Oynat/Durdur"
        ${isReady ? "" : "disabled"}
        style="${isReady ? "" : "opacity:.45; cursor:not-allowed;"}">

        <svg class="icon-play" viewBox="0 0 24 24" fill="none">
          <path d="M8 5v14l11-7z" fill="currentColor"></path>
        </svg>

        <svg class="icon-pause" viewBox="0 0 24 24" fill="none" style="display:none">
          <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"></path>
        </svg>

        <span class="aivo-eq" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </span>
      </button>`;

    const tags =
      isReady ? `${tagReady}` :
      st === "error" ? `${tagErr}` :
      `${tagProc}`;

    const metaLeft = dur ? esc(dur) : "0:00";
    const metaRight = date ? esc(date) : "";

    const disabled = (!job.__audio_src) ? 'data-disabled="1"' : "";

    return `
<div class="aivo-player-card ${isReady ? "is-ready" : st === "error" ? "is-error" : "is-loading is-processing"}"
  data-job-id="${esc(jobId)}"
  data-output-id="${esc(job.output_id || "")}"
  data-loading-started-at="${esc(job.__loading_startedAt || "")}"
  data-src="${esc(job.__audio_src || "")}"
  ${disabled}>

  <div class="aivo-player-left">
    ${leftBtn}
  </div>

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

    <div class="aivo-progress" title="İlerleme">
      <i style="width:${esc(job.__progress || 0)}%"></i>
    </div>

    <div class="aivo-player-controls"></div>
  </div>

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
    // panel aktif değilse DOM'a dokunma
    if (window.RightPanel?.getCurrentKey?.() !== "music") return;
    if (!hostEl) return;

    listEl = hostEl.querySelector("#musicList");
    if (!listEl) return;

    const view = jobs.filter(j => j?.job_id || j?.id);

    // base bazlı sıralama: yeni base üstte, base içinde orig önce
    view.sort((a, b) => {
      const aid = String(a.job_id || a.id || "");
      const bid = String(b.job_id || b.id || "");

      const abase = aid.split("::")[0];
      const bbase = bid.split("::")[0];

      const ta = toMs(a?.updated_at) || toMs(a?.created_at) || toMs(a?.createdAt) || toMs(a?.__createdAt) || 0;
      const tb = toMs(b?.updated_at) || toMs(b?.created_at) || toMs(b?.createdAt) || toMs(b?.__createdAt) || 0;

      if (tb !== ta) return tb - ta;
      if (abase !== bbase) return bbase.localeCompare(abase);

      const ar = aid.endsWith("::orig") ? 0 : aid.endsWith("::rev1") ? 1 : 9;
      const br = bid.endsWith("::orig") ? 0 : bid.endsWith("::rev1") ? 1 : 9;
      return ar - br;
    });

    if (!view.length){
      listEl.innerHTML = `
        <div class="aivo-empty">
          <div class="aivo-empty-sub">Player kartları hazır olunca burada görünecek.</div>
        </div>`;
      applyMusicSearchFilter();
      return;
    }

    listEl.innerHTML = view.map(renderCard).join("");
    applyMusicSearchFilter();
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

  /* ---------------- actions ---------------- */
  function actionDownload(card){
    const src = card?.dataset?.src || "";
    if (!src) { toast("error","İndirilecek dosya yok"); return; }
    const a = document.createElement("a");
    a.href = src;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("success","İndirme başlatıldı");
  }

  function actionDelete(card){
    const jobId = card?.getAttribute("data-job-id") || "";
    if (!jobId) return;
    removeJob(jobId);
    toast("success","Silindi");
  }

  function actionStems(){ toast("info","Stems: event gönderildi"); }
  function actionExtend(){ toast("info","Extend: event gönderildi"); }
  function actionRevise(){ toast("info","Revise: event gönderildi"); }

  function onCardClick(e){
    const btn  = e.target.closest("[data-action]");
    const card = e.target.closest(".aivo-player-card");
    if (!card) return;

    const act = btn?.dataset?.action || null;

    if (act){
      e.preventDefault();
      e.stopPropagation();

      if (act === "toggle-play") return togglePlayFromCard(card);
      if (act === "download") return actionDownload(card);
      if (act === "delete")   return actionDelete(card);
      if (act === "stems")    return actionStems(card);
      if (act === "extend")   return actionExtend(card);
      if (act === "revise")   return actionRevise(card);
      return;
    }

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

  /* ---------------- toggle play (✅ DB controller burada YOK) ---------------- */
  async function togglePlayFromCard(card){
    if (!card) return;

    let src = card.dataset.src || card.getAttribute("data-src") || "";
    const jobId = card.getAttribute("data-job-id") || "";
    if (!jobId) return;

    const baseId = String(jobId).split("::")[0];
    const existing = jobs.find(x => (x.job_id || x.id) === jobId) || {};
    const realJobId = existing.__real_job_id || baseId;

    const looksWrong =
      !src ||
      src.includes("output_id=test") ||
      src.includes("/files/play?job_id=prov_music_");

    if (looksWrong || card.dataset.disabled === "1" || card.getAttribute("data-disabled") === "1"){
      try{
        const d = await fetch(`/api/music/status?job_id=${encodeURIComponent(realJobId)}`, {
          cache: "no-store",
          credentials: "include",
        }).then(r => r.json());

        const outputId =
          d?.audio?.output_id ||
          d?.output_id ||
          d?.job?.output_id ||
          "";

        const realSrc =
          d?.audio?.src ||
          d?.audio_src ||
          "";

        const WORKER_ORIGIN = "https://aivo-archive-worker.aivostudioapp.workers.dev";
        const playUrl = (realJobId && outputId)
          ? `${WORKER_ORIGIN}/files/play?job_id=${encodeURIComponent(realJobId)}&output_id=${encodeURIComponent(outputId)}`
          : "";

        src = realSrc || playUrl || "";
        if (!src){
          toast("info", "Henüz hazır değil (audio src yok)");
          return;
        }

        card.dataset.src = src;
        card.setAttribute("data-src", src);
        card.dataset.disabled = "0";
        card.setAttribute("data-disabled", "0");
        card.classList.add("is-ready");

        const btn = card.querySelector("button[data-action='toggle-play']");
        if (btn){
          btn.disabled = false;
          btn.removeAttribute("disabled");
          btn.style.opacity = "";
          btn.style.cursor = "";
        }
      } catch(e){
        console.warn("[panel.music] status self-heal failed", e);
        toast("error", "Status okunamadı");
        return;
      }
    }

    if (!src){
      toast("info", "Henüz hazır değil");
      return;
    }

    const A = ensureAudio();

    if (currentJobId && currentJobId !== jobId){
      setCardPlaying(currentJobId, false);
      try { A.pause(); } catch {}
    }

    if (currentJobId === jobId && !A.paused){
      try { A.pause(); } catch {}
      setCardPlaying(jobId, false);
      return;
    }

    currentJobId = jobId;
    setCardPlaying(jobId, true);

    try{
      if (A.src !== src) A.src = src;
      await A.play();
    } catch(e){
      console.warn("[panel.music] play failed:", e);
      setCardPlaying(jobId, false);
      toast("error", "Play başarısız (src açılamadı)");
    }
  }

  /* ---------------- polling ---------------- */
  const POLL_BUSY = new Set();   // key: cardId
  const POLL_LAST = new Map();   // key: cardId -> timestamp(ms)

  async function poll(jobId){
    if (!alive || !jobId) return;

    const cardId = String(jobId);        // 133..::orig / ::rev1
    const baseId = cardId.split("::")[0];

    if (POLL_BUSY.has(cardId)) return;

    const now = Date.now();
    const last = POLL_LAST.get(cardId) || 0;
    if (now - last < 1500) return;
    POLL_LAST.set(cardId, now);

    POLL_BUSY.add(cardId);

    const existing = jobs.find(x => (x.job_id || x.id) === cardId) || {};
    const songIdForThisCard = String(existing.__provider_song_id || baseId).trim();

    try{
      clearPoll(cardId);

      const r = await fetch(`/api/music/status?provider_job_id=${encodeURIComponent(songIdForThisCard)}`, {
        cache: "no-store",
        credentials: "include",
      });

      let j = null;
      try { j = await r.json(); } catch { j = null; }

      if (!r.ok || !j){
        schedulePoll(cardId, 1500);
        return;
      }

      if (j.ok === false && (j.error === "proxy_error" || j.error === "worker_non_json")){
        schedulePoll(cardId, 2000);
        return;
      }

      const job = j.job || {};
      job.job_id = cardId;
      job.id = cardId;

      const realJobId =
        j?.internal_job_id ||
        job?.internal_job_id ||
        job?.job_id ||
        j?.job_id ||
        null;

      if (realJobId && existing.__real_job_id !== realJobId) {
        upsertJob({ job_id: cardId, id: cardId, __real_job_id: realJobId });
      }

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

      const playUrl = (realJobId && outputId)
        ? `/files/play?job_id=${encodeURIComponent(realJobId)}&output_id=${encodeURIComponent(outputId)}`
        : "";

      job.__audio_src = src || playUrl || "";
      job.output_id = outputId || job.output_id || "";

      const state = uiState(j.state || j.status || job.status);

      // iki kart birlikte unlock (audio gelene kadar processing)
      if (job.__audio_src) {
        job.__ui_state = "processing";
        job.__pending_ready = true;
      } else {
        job.__ui_state = state;
        job.__pending_ready = false;
      }

      try {
        const base = baseId;
        const aId = `${base}::orig`;
        const bId = `${base}::rev1`;

        const a = jobs.find(x => (x.job_id || x.id) === aId);
        const b = jobs.find(x => (x.job_id || x.id) === bId);

        const bothHaveAudio = !!(a?.__audio_src) && !!(b?.__audio_src);
        if (bothHaveAudio) {
          upsertJob({ job_id: aId, id: aId, __ui_state: "ready", __pending_ready: false });
          upsertJob({ job_id: bId, id: bId, __ui_state: "ready", __pending_ready: false });
          job.__ui_state = "ready";
          job.__pending_ready = false;
        }
      } catch {}

      // title boş geldiyse eskisini ezme
      const incomingTitle =
        (String(job.title || "").trim()) ||
        (String(j?.title || "").trim());
      if (incomingTitle) job.title = incomingTitle;
      else delete job.title;

      if (j?.duration) job.__duration = j.duration;
      if (j?.created_at) job.__createdAt = j.created_at;

      upsertJob(job);
      render();

      if (job.__ui_state === "ready") return;
      if (job.__ui_state === "error") return;

      schedulePoll(cardId, 1500);
    } catch (e){
      schedulePoll(cardId, 2000);
    } finally {
      POLL_BUSY.delete(cardId);
    }
  }

  /* ---------------- onJob (event -> 2 cards) ---------------- */
  function onJob(e){
    const payload = e?.detail || e || {};
    const baseId = payload.job_id || payload.id;
    if (!baseId) return;

    const origId = `${baseId}::orig`;
    const revId  = `${baseId}::rev1`;

    const providerJobId = String(payload.provider_job_id || "").trim();
    const rawSongIds = Array.isArray(payload.provider_song_ids) ? payload.provider_song_ids : [];

    const songIdOrig = String(rawSongIds[0] || providerJobId || baseId).trim();
    const songIdRev  = String(rawSongIds[1] || rawSongIds[0] || providerJobId || baseId).trim();

    const safeTitle = String(payload.title || "").trim();

    const common = {
      type: payload.type || "music",
      subtitle: payload.subtitle || "",
      __ui_state: payload.__ui_state || "processing",
      __audio_src: payload.__audio_src || "",
      __real_job_id: payload.__real_job_id || null,
      provider_job_id: providerJobId,
      title: safeTitle,
      lyrics: String(payload.lyrics || "").trim(),
      prompt: String(payload.prompt || "").trim(),
      __createdAt: payload.created_at || payload.__createdAt || "",
    };

    upsertJob({ ...common, job_id: origId, id: origId, __provider_song_id: songIdOrig });
    upsertJob({ ...common, job_id: revId,  id: revId,  __provider_song_id: songIdRev  });

    render();
    poll(origId);
    poll(revId);
  }

  /* ---------------- manager search integration ---------------- */
  let __searchQ = "";

  function onSearch(q){
    __searchQ = String(q || "").trim().toLowerCase();
    applyMusicSearchFilter();
  }

  function applyMusicSearchFilter(){
    const q = (__searchQ || "").trim();
    const cards = (listEl || document).querySelectorAll(".aivo-player-card");
    cards.forEach(card => {
      const text = (card.textContent || "").toLowerCase();
      card.style.display = (!q || text.includes(q)) ? "" : "none";
    });
  }

  function getHeader(){
    return {
      title: "Müziklerim",
      meta: "",
      searchPlaceholder: "Müziklerde ara...",
      searchEnabled: true,
      resetSearch: false
    };
  }

  /* ---------------- DB controller start (✅ burada) ---------------- */
  function startDbController(){
    // controller zaten varsa tekrar başlatma
    if (dbCtrl) return;

    if (!(window.DBJobs && typeof window.DBJobs.create === "function")){
      return;
    }

    try {
      dbCtrl = window.DBJobs.create({
        app: "music",
        debug: false,
        pollIntervalMs: 4000,
        hydrateEveryMs: 15000,

        acceptJob: (job) => {
          const a = String(job?.app || job?.meta?.app || job?.meta?.module || job?.meta?.routeKey || "").trim();
          return !a || isMusicApp(a);
        },

        acceptOutput: (o) => {
          const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind || "");
          return !t || t === "audio";
        },

        onChange: (items) => {
          if (!alive) return;

          const safe = Array.isArray(items) ? items : [];

          // 1) DB -> cards
          const dbCards = [];
          for (const j of safe) {
            const cards = mapDbJobToCards(j);
            if (cards && cards.length) dbCards.push(...cards);
          }

          // 2) merge: DB truth + mevcut optimistic
          const byId = new Map();
          for (const c of dbCards) {
            const id = String(c?.job_id || c?.id || "").trim();
            if (!id) continue;
            byId.set(id, c);
          }

          for (const old of (jobs || [])) {
            const oid = String(old?.job_id || old?.id || "").trim();
            if (!oid) continue;
            if (!byId.has(oid)) byId.set(oid, old);
          }

          jobs = Array.from(byId.values());
          saveJobs();

          render();

          // poll başlat (orig/rev ayrı)
          jobs.slice(0, 60).forEach(j => (j?.job_id || j?.id) && poll(j.job_id || j.id));
        },
      });
    } catch (e){
      console.warn("[panel.music] DBJobs.create failed", e);
      dbCtrl = null;
    }
  }

  async function hydrateFromDBOnce(){
    try {
      const r = await fetch("/api/jobs/list?app=music", {
        method: "GET",
        credentials: "include",
        headers: { "accept": "application/json" },
        cache: "no-store",
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) {
        console.warn("[panel.music] hydrate failed", r.status, j);
        return;
      }

      const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.jobs) ? j.jobs : []);
      const incoming = Array.isArray(items) ? items : [];

      const dbCards = [];
      for (const row of incoming) {
        const cards = mapDbJobToCards(row);
        if (cards && cards.length) dbCards.push(...cards);
      }

      // merge
      const byId = new Map();
      for (const c of dbCards) {
        const id = String(c?.job_id || c?.id || "").trim();
        if (!id) continue;
        byId.set(id, c);
      }

      for (const old of (jobs || [])) {
        const oid = String(old?.job_id || old?.id || "").trim();
        if (!oid) continue;
        if (!byId.has(oid)) byId.set(oid, old);
      }

      jobs = Array.from(byId.values());
      saveJobs();
      render();
    } catch (e) {
      console.warn("[panel.music] hydrate exception", e);
    }
  }

  /* ---------------- panel mount/destroy ---------------- */
  function mount(contentEl){
    hostEl = contentEl;
    alive = true;

    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-body" id="musicList"></div>
        </div>
      </div>
    `;

    listEl = hostEl.querySelector("#musicList");
    if (listEl) listEl.className = "aivo-player-list";

    // bind events (tek sefer)
    if (!hostEl.__musicBound){
      hostEl.__musicBound = true;
      hostEl.addEventListener("click", onCardClick, true);
      hostEl.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".aivo-progress")) onProgressSeek(e);
      }, true);
    }

    ensureAudio();

    // mainAudio bar'ı kapat
    const mainAudio = document.getElementById("mainAudio");
    if (mainAudio) {
      try { mainAudio.pause?.(); } catch {}
      mainAudio.removeAttribute("src");
      try { mainAudio.load?.(); } catch {}
      mainAudio.style.display = "none";
    }

    // ✅ başlangıç: cache (opsiyonel) -> render
    jobs = []; // DB truth öncelikli
    render();
    applyMusicSearchFilter();

    // ✅ DB controller panel açılır açılmaz başlar
    startDbController();

    // ✅ controller yoksa bile en az 1 kez DB’den hydrate et
    hydrateFromDBOnce();

    // poll (hydrate sonrası jobs dolarsa)
    setTimeout(() => {
      if (!alive) return;
      jobs.slice(0, 60).forEach(j => (j?.job_id || j?.id) && poll(j.job_id || j.id));
    }, 200);

    window.addEventListener("aivo:job", onJob, true);

    console.log("[panel.music] mounted OK (DB controller in mount)");

    return () => destroy();
  }

  function destroy(){
    alive = false;

    window.removeEventListener("aivo:job", onJob, true);

    clearAllPolls();
    stopRaf();
    stopEqLoop();

    try { if (audioEl) audioEl.pause(); } catch {}
    currentJobId = null;

    try { dbCtrl?.destroy?.(); } catch {}
    dbCtrl = null;

    audioEl = null;
  }

  function register(){
    window.RightPanel.register(PANEL_KEY, { getHeader, mount, destroy, onSearch });
  }

  function waitForRightPanel(cb){
    const t0 = Date.now();
    const T = setInterval(() => {
      if (window.RightPanel && typeof window.RightPanel.register === "function"){
        clearInterval(T);
        cb();
      } else if (Date.now() - t0 > 8000){
        clearInterval(T);
        console.warn("[panel.music] RightPanel not ready after 8s");
      }
    }, 50);
  }

  waitForRightPanel(register);

})();
