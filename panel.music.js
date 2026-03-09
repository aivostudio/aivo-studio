(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  function waitForReady(cb){
    const t0 = Date.now();
    const T = setInterval(() => {
      if (
        window.RightPanel &&
        typeof window.RightPanel.register === "function" &&
        window.DBJobs &&
        typeof window.DBJobs.create === "function"
      ) {
        clearInterval(T);
        cb();
      } else if (Date.now() - t0 > 8000) {
        clearInterval(T);
        console.warn("[panel.music] RightPanel/DBJobs not ready after 8s");
      }
    }, 50);
  }

  const PANEL_KEY = "music";
  const LS_KEY = "aivo.music.jobs.v4";
  const WORKER_ORIGIN = "https://aivo-archive-worker.aivostudioapp.workers.dev";

  let dbCtrl = null;
  let hostEl = null;
  let listEl = null;
  let alive = false;
  let jobs = [];

  const hiddenDeletedIds = new Set();
  const hiddenDeletedBaseIds = new Set();
  const hiddenDeletedDbIds = new Set();

  let audioEl = null;
  let rafId = 0;
  let currentJobId = null;

  const qs = (s, r = document) => r.querySelector(s);

  function toast(type, msg){
    try {
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
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
    if (!s) return 0;
    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    }
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s) && !s.includes("T")) {
      const iso = s.replace(" ", "T") + "Z";
      const tIso = Date.parse(iso);
      if (Number.isFinite(tIso)) return tIso;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function uiState(status){
    const s = String(status || "").toLowerCase();
    if (["ready", "done", "completed", "success", "succeeded"].includes(s)) return "ready";
    if (["error", "failed", "fail"].includes(s)) return "error";
    return "processing";
  }

  function fmtTime(sec){
    sec = Number(sec || 0);
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function getJobId(v){
    return String(v?.job_id || v?.id || "").trim();
  }

  function getBaseIdFromJobId(jobId){
    return String(jobId || "").trim().split("::")[0].trim();
  }

  function getVariantOfJobId(jobId){
    const s = String(jobId || "").trim();
    if (s.endsWith("::orig")) return "orig";
    if (s.endsWith("::rev1")) return "rev1";
    return "";
  }

  function buildFamilyIds(baseId){
    const b = String(baseId || "").trim();
    if (!b) return [];
    return [`${b}::orig`, `${b}::rev1`];
  }

  function isUuid(v){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || "").trim());
  }

  function isRowDeleted(row){
    return !!(
      row?.deleted_at ||
      row?.deletedAt ||
      row?.meta?.deleted_at ||
      row?.meta?.deletedAt
    );
  }

  function getRowDbId(row){
    return String(row?.id || row?.job_id || row?.uuid || "").trim();
  }

  function getRowProviderJobId(row){
    return String(
      row?.meta?.provider_job_id ||
      row?.meta?.providerJobId ||
      row?.provider_job_id ||
      row?.providerJobId ||
      ""
    ).trim();
  }

  function getRowBaseId(row){
    const mapped = mapDbJobToCards(row);
    if (mapped.length) return getBaseIdFromJobId(getJobId(mapped[0]));

    const provider = getRowProviderJobId(row);
    if (provider) return provider;

    const raw = String(row?.job_id || row?.id || "").trim();
    return raw;
  }

  function isHiddenJobId(jobId){
    const id = String(jobId || "").trim();
    if (!id) return false;
    if (hiddenDeletedIds.has(id)) return true;
    const baseId = getBaseIdFromJobId(id);
    if (baseId && hiddenDeletedBaseIds.has(baseId)) return true;
    return false;
  }

  function isHiddenRow(row){
    const dbId = getRowDbId(row);
    if (dbId && hiddenDeletedDbIds.has(dbId)) return true;
    const baseId = getRowBaseId(row);
    if (baseId && hiddenDeletedBaseIds.has(baseId)) return true;
    return false;
  }

  function clearHiddenDeleteMarksForBase(baseId){
    const b = String(baseId || "").trim();
    if (!b) return;
    hiddenDeletedBaseIds.delete(b);
    hiddenDeletedIds.delete(`${b}::orig`);
    hiddenDeletedIds.delete(`${b}::rev1`);
  }

  function saveJobs(){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify((jobs || []).slice(0, 200)));
    } catch {}
  }

  function loadJobs(){
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function mergePreferDbButKeepReady(oldItem, dbItem){
    const out = { ...oldItem, ...dbItem };

    const oldSrc = String(oldItem?.__audio_src || "").trim();
    const dbSrc = String(dbItem?.__audio_src || "").trim();
    if (!dbSrc && oldSrc) out.__audio_src = oldSrc;

    const oldState = String(oldItem?.__ui_state || "").trim();
    const dbState = String(dbItem?.__ui_state || "").trim();
    if (oldState === "ready" && dbState !== "ready" && out.__audio_src) {
      out.__ui_state = "ready";
    }

    const oldDur = String(oldItem?.__duration || "").trim();
    const dbDur = String(dbItem?.__duration || "").trim();
    if (!dbDur && oldDur) out.__duration = oldDur;

    const oldDb = String(oldItem?.__db_job_id || "").trim();
    const newDb = String(out?.__db_job_id || "").trim();
    if (!newDb && oldDb) out.__db_job_id = oldDb;

    const oldProv = String(oldItem?.provider_job_id || "").trim();
    const newProv = String(out?.provider_job_id || "").trim();
    if (!newProv && oldProv) out.provider_job_id = oldProv;

    const oldSong = String(oldItem?.__provider_song_id || "").trim();
    const newSong = String(out?.__provider_song_id || "").trim();
    if (!newSong && oldSong) out.__provider_song_id = oldSong;

    return out;
  }

  function upsertJob(job){
    const id = getJobId(job);
    if (!id) return;
    if (isHiddenJobId(id)) return;

    const baseId = getBaseIdFromJobId(id);
    if (baseId && hiddenDeletedBaseIds.has(baseId)) return;

    const i = jobs.findIndex((j) => getJobId(j) === id);
    if (i >= 0) jobs[i] = mergePreferDbButKeepReady(jobs[i], job);
    else jobs.unshift(job);

    saveJobs();
  }

  function removeJob(jobId){
    const id = String(jobId || "").trim();
    if (!id) return;

    hiddenDeletedIds.add(id);
    const baseId = getBaseIdFromJobId(id);
    if (baseId) hiddenDeletedBaseIds.add(baseId);

    if (currentJobId === id && audioEl) {
      try { audioEl.pause(); } catch {}
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    }

    clearPoll(id);
    POLL_BUSY.delete(id);
    POLL_LAST.delete(id);

    jobs = jobs.filter((j) => getJobId(j) !== id);
    saveJobs();
    render();
  }

  let eqRaf = 0;
  let __eqLastTs = 0;
  const eqBarsCache = { jobId: null, bars: null };

  function bindEqBarsForCurrentJob(){
    if (!currentJobId || !hostEl) {
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      return null;
    }

    const jid = String(currentJobId);
    if (eqBarsCache.jobId === jid && eqBarsCache.bars && eqBarsCache.bars.length) {
      return eqBarsCache.bars;
    }

    const card = hostEl.querySelector(`.aivo-player-card[data-job-id="${CSS.escape(jid)}"]`);
    if (!card) {
      eqBarsCache.jobId = jid;
      eqBarsCache.bars = null;
      return null;
    }

    const bars = card.querySelectorAll(".aivo-player-btn .aivo-eq i");
    eqBarsCache.jobId = jid;
    eqBarsCache.bars = (bars && bars.length) ? bars : null;

    if (eqBarsCache.bars) {
      eqBarsCache.bars.forEach((b) => {
        b.style.willChange = "transform";
        b.style.transformOrigin = "50% 100%";
      });
    }

    return eqBarsCache.bars;
  }

  function initEqEngine(){
    if (!audioEl || audioEl.__eqInited) return;
    audioEl.__eqInited = true;

    let ctx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) {
      console.warn("[music:eq] AudioContext not available", e);
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;

    let srcNode = null;
    try {
      srcNode = ctx.createMediaElementSource(audioEl);
    } catch (e) {
      console.warn("[music:eq] createMediaElementSource failed", e);
      return;
    }

    srcNode.connect(analyser);
    analyser.connect(ctx.destination);

    const freq = new Uint8Array(analyser.frequencyBinCount);
    audioEl.__eq = { ctx, analyser, freq };

    audioEl.addEventListener("play", () => {
      try { ctx.resume?.(); } catch {}
      bindEqBarsForCurrentJob();
      startEqLoop();
    }, { passive: true });

    audioEl.addEventListener("pause", () => stopEqLoop(), { passive: true });
    audioEl.addEventListener("ended", () => stopEqLoop(), { passive: true });
  }

  function startEqLoop(){
    if (eqRaf) return;
    __eqLastTs = 0;
    eqTick();
  }

  function stopEqLoop(){
    if (eqRaf) {
      cancelAnimationFrame(eqRaf);
      eqRaf = 0;
    }
    setEqBars(0.08, 0.06, 0.04);
  }

  function bandAvg(arr, a, b){
    let sum = 0;
    let n = 0;
    const end = Math.min(arr.length, b);
    for (let i = Math.max(0, a); i < end; i++) {
      sum += arr[i];
      n++;
    }
    return n ? (sum / n) : 0;
  }

  function clamp01(x){
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function setEqBars(L, M, H){
    if (!currentJobId || !hostEl) return;
    const bars = bindEqBarsForCurrentJob();
    if (!bars || !bars.length) return;

    const v = [
      0.20 + H * 0.70,
      0.25 + M * 0.85,
      0.30 + L * 1.00,
      0.25 + L * 1.15,
      0.30 + L * 1.00,
      0.25 + M * 0.85,
      0.20 + H * 0.70,
    ];

    for (let i = 0; i < bars.length; i++) {
      const k = v[i] ?? 0.2;
      const s = clamp01(k);
      bars[i].style.transform = `scaleY(${0.15 + s * 1.15})`;
    }
  }

  function eqTick(){
    eqRaf = requestAnimationFrame(eqTick);

    if (!audioEl || audioEl.paused) return;
    const pack = audioEl.__eq;
    if (!pack) return;

    const now = performance.now();
    if (now - __eqLastTs < 33) return;
    __eqLastTs = now;

    const { analyser, freq } = pack;
    analyser.getByteFrequencyData(freq);

    const low = bandAvg(freq, 2, 10);
    const mid = bandAvg(freq, 10, 28);
    const high = bandAvg(freq, 28, 60);

    const L = clamp01(low / 255);
    const M = clamp01(mid / 255);
    const H = clamp01(high / 255);

    setEqBars(L, M, H);
  }

  function ensureAudio(){
    if (audioEl) return audioEl;

    audioEl = document.getElementById("aivoAudio");
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "aivoAudio";
      audioEl.preload = "metadata";
      audioEl.crossOrigin = "anonymous";
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
    }

    initEqEngine();

    audioEl.onended = () => {
      setCardPlaying(currentJobId, false);
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    };
    audioEl.onpause = () => {
      if (currentJobId) setCardPlaying(currentJobId, false);
      stopRaf();
    };
    audioEl.onplay = () => {
      if (currentJobId) setCardPlaying(currentJobId, true);
      bindEqBarsForCurrentJob();
      startRaf();
    };

    return audioEl;
  }

  if (!window.__AIVO_MUSIC_POLL_TIMERS__) window.__AIVO_MUSIC_POLL_TIMERS__ = new Map();
  const TMAP = window.__AIVO_MUSIC_POLL_TIMERS__;

  function schedulePoll(jobId, ms){
    const id = String(jobId || "").trim();
    if (!alive || !id) return;
    if (isHiddenJobId(id)) return;
    if (TMAP.has(id)) return;
    const tid = setTimeout(() => {
      TMAP.delete(id);
      poll(id);
    }, ms);
    TMAP.set(id, tid);
  }

  function clearPoll(jobId){
    const id = String(jobId || "").trim();
    const tid = TMAP.get(id);
    if (tid) clearTimeout(tid);
    TMAP.delete(id);
  }

  function clearAllPolls(){
    for (const tid of TMAP.values()) clearTimeout(tid);
    TMAP.clear();
  }

  function renderCard(job){
    const jobId = getJobId(job);
    const st = job.__ui_state || "processing";

    const title =
      (String(job?.title || "").trim()) ||
      (String(job?.lyrics || "").replace(/\r/g, "").split("\n").map((s) => s.trim()).find(Boolean) || "") ||
      (String(job?.prompt || "").trim().split(/\s+/).slice(0, 2).join(" ") || "");

    const sub = job.subtitle || "";
    const dur = job.duration || job.__duration || "";
    const date = job.created_at || job.createdAt || job.__createdAt || "";

    const tagReady = `<span class="aivo-tag is-ready">Hazır</span>`;
    const tagProc = `<span class="aivo-tag is-loading">Hazırlanıyor…</span>`;
    const tagErr = `<span class="aivo-tag is-error">Hata</span>`;

    const isReady = (st === "ready") && !!job.__audio_src;
    const isPlayingNow = !!isReady && String(currentJobId || "") === String(jobId || "") && !!audioEl && !audioEl.paused;

    const tags = isReady ? tagReady : (st === "error" ? tagErr : tagProc);

    const leftBtn = `
      <button class="aivo-player-btn"
        data-action="toggle-play"
        aria-label="Oynat/Durdur"
        title="Oynat/Durdur"
        ${isReady ? "" : "disabled"}
        style="${isReady ? "" : "opacity:.45; cursor:not-allowed;"}">
        <svg class="icon-play" viewBox="0 0 24 24" fill="none" style="${isPlayingNow ? "display:none" : ""}">
          <path d="M8 5v14l11-7z" fill="currentColor"></path>
        </svg>
        <svg class="icon-pause" viewBox="0 0 24 24" fill="none" style="${isPlayingNow ? "" : "display:none"}">
          <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"></path>
        </svg>
        <span class="aivo-eq" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </span>
      </button>`;

    const metaLeft = dur ? esc(dur) : "0:00";
    const metaRight = date ? esc(date) : "";

    const stems = job?.stems || job?.__stems || null;
    const stemsStatus = String(stems?.status || "").toLowerCase();
    const stemsOut = stems?.output || null;

    const stemsBadge =
      stemsStatus === "succeeded" ? `<span class="aivo-tag is-ready">Stems Hazır</span>` :
      (["starting", "processing"].includes(stemsStatus) ? `<span class="aivo-tag is-loading">Stems…</span>` :
      (stemsStatus === "failed" ? `<span class="aivo-tag is-error">Stems Hata</span>` : ""));

    const px = (u, label) => {
      u = String(u || "").trim();
      if (!u) return "";
      const name = String(label || "stem").trim() || "stem";
      return "/api/media/convert-wav?url=" + encodeURIComponent(u) + "&filename=" + encodeURIComponent(name + ".wav");
    };

    const stemsControls =
      (stemsStatus === "succeeded" && stemsOut) ? `
        <div class="aivo-stems aivo-stems-icons" aria-label="Stems">
          ${stemsOut.vocals ? `<a class="aivo-stem aivo-stem-ic" href="${esc(px(stemsOut.vocals || "", "Vocals"))}" download target="_self" title="Vocals indir" aria-label="Vocals indir">🎤</a>` : ``}
          ${stemsOut.drums ? `<a class="aivo-stem aivo-stem-ic" href="${esc(px(stemsOut.drums || "", "Drums"))}" download target="_self" title="Drums indir" aria-label="Drums indir">🥁</a>` : ``}
          ${stemsOut.bass ? `<a class="aivo-stem aivo-stem-ic" href="${esc(px(stemsOut.bass || "", "Bass"))}" download target="_self" title="Bass indir" aria-label="Bass indir">🔊</a>` : ``}
          ${stemsOut.guitar ? `<a class="aivo-stem aivo-stem-ic" href="${esc(px(stemsOut.guitar || "", "Guitar"))}" download target="_self" title="Guitar indir" aria-label="Guitar indir">🎸</a>` : ``}
          ${stemsOut.piano ? `<a class="aivo-stem aivo-stem-ic" href="${esc(px(stemsOut.piano || "", "Piano"))}" download target="_self" title="Piano indir" aria-label="Piano indir">🎹</a>` : ``}
        </div>

        <style>
          .aivo-stems-icons{margin-top:8px !important;display:flex !important;flex-wrap:wrap !important;gap:6px !important;align-items:center !important;justify-content:flex-start !important;}
          .aivo-stems-icons::after{content:"24 saat içinde indirin.";display:block;flex-basis:100%;margin-top:6px;font-size:12px;opacity:.7;}
          .aivo-stems-icons .aivo-stem-ic{display:inline-flex !important;flex:0 0 26px !important;width:26px !important;min-width:26px !important;max-width:26px !important;height:26px !important;min-height:26px !important;max-height:26px !important;padding:0 !important;margin:0 !important;align-items:center !important;justify-content:center !important;border-radius:10px !important;border:1px solid rgba(255,255,255,.12) !important;background:rgba(255,255,255,.06) !important;text-decoration:none !important;user-select:none !important;line-height:1 !important;font-size:13px !important;}
          .aivo-stems-icons .aivo-stem-ic:active{transform:translateY(1px) !important;}
        </style>
      ` : (["starting", "processing"].includes(stemsStatus) ? `
        <div class="aivo-stems aivo-stems-status">Parçalar ayrıştırılıyor…</div>
      ` : (stemsStatus === "failed" ? `
        <div class="aivo-stems aivo-stems-status">Stems hata</div>
      ` : ""));

    return `
      <div class="aivo-player-card ${isReady ? "is-ready" : (st === "error" ? "is-error" : "is-loading is-processing")} ${isPlayingNow ? "is-playing" : ""}"
        data-job-id="${esc(jobId)}"
        data-src="${esc(job.__audio_src || "")}"
        data-provider-song-id="${esc(job.__provider_song_id || "")}">
        <div class="aivo-player-left">${leftBtn}</div>

        <div class="aivo-player-mid">
          <div class="aivo-player-titleRow">
            <div class="aivo-player-title">${esc(title)}</div>
            <div class="aivo-player-tags">${tags} ${stemsBadge}</div>
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

          <div class="aivo-player-controls">${stemsControls}</div>
        </div>

        <div class="aivo-player-actions">
          <button class="aivo-action is-accent" data-action="stems_5_confirm" title="Parçaları Ayır" aria-label="Parçaları Ayır">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M4 12h4M10 12h4M16 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="aivo-action is-blue" data-action="download" title="Dosyayı İndir" aria-label="Dosyayı İndir">⬇</button>
          <button class="aivo-action is-accent" data-action="extend" title="Süreyi Uzat" aria-label="Süreyi Uzat">⟲</button>
          <button class="aivo-action" data-action="lyrics" title="Şarkı Sözleri" aria-label="Şarkı Sözleri">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M14 3v6h6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="aivo-action is-danger" data-action="delete" title="Müziği Sil" aria-label="Müziği Sil">🗑</button>
        </div>
      </div>`;
  }

  let __searchQ = "";

  function applyMusicSearchFilter(){
    const q = String(__searchQ || "").trim();
    const cards = (listEl || document).querySelectorAll(".aivo-player-card");
    cards.forEach((card) => {
      const text = (card.textContent || "").toLowerCase();
      card.style.display = (!q || text.includes(q)) ? "" : "none";
    });
  }

  function render(){
    if (!alive || !hostEl || !listEl) return;
    if (window.RightPanel?.getCurrentKey?.() !== "music") return;

    const view = (jobs || []).filter((j) => {
      const id = getJobId(j);
      if (!id) return false;
      if (isHiddenJobId(id)) return false;
      return true;
    });

   view.sort((a, b) => {
  const aid = getJobId(a);
  const bid = getJobId(b);
  const abase = getBaseIdFromJobId(aid);
  const bbase = getBaseIdFromJobId(bid);

  const ta = toMs(a?.created_at) || toMs(a?.createdAt) || toMs(a?.__createdAt) || 0;
  const tb = toMs(b?.created_at) || toMs(b?.createdAt) || toMs(b?.__createdAt) || 0;

  if (tb !== ta) return tb - ta;
  if (bbase !== abase) return bbase.localeCompare(abase);

  const ar = aid.endsWith("::orig") ? 0 : aid.endsWith("::rev1") ? 1 : 9;
  const br = bid.endsWith("::orig") ? 0 : bid.endsWith("::rev1") ? 1 : 9;
  return ar - br;
});

    if (!view.length) {
      listEl.innerHTML = `
        <div class="aivo-empty">
          <div class="aivo-empty-sub">Player kartları hazır olunca burada görünecek.</div>
        </div>`;
      return;
    }

    listEl.innerHTML = view.map(renderCard).join("");
    eqBarsCache.jobId = null;
    eqBarsCache.bars = null;

    applyMusicSearchFilter();

    if (currentJobId && audioEl && !audioEl.paused) {
      setCardPlaying(currentJobId, true);
      bindEqBarsForCurrentJob();
    }
  }

  function getCard(jobId){
    if (!hostEl) return null;
    return qs(`.aivo-player-card[data-job-id="${CSS.escape(String(jobId || ""))}"]`, hostEl);
  }

  function setCardPlaying(jobId, isPlaying){
    if (!jobId) return;
    const card = getCard(jobId);
    if (!card) return;

    const playIcon = qs(".icon-play", card);
    const pauseIcon = qs(".icon-pause", card);
    if (playIcon && pauseIcon) {
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

async function togglePlayFromCard(card){
  if (!card) return;

  const jobId = String(card.getAttribute("data-job-id") || "").trim();
  if (!jobId || isHiddenJobId(jobId)) return;

  const existing = (jobs || []).find((x) => getJobId(x) === jobId) || {};
  const src = String(existing.__audio_src || card.dataset.src || "").trim();
  if (!src) {
    toast("info", "Henüz hazır değil");
    return;
  }

  const A = ensureAudio();

  if (currentJobId && currentJobId !== jobId) {
    setCardPlaying(currentJobId, false);
    try { A.pause(); } catch {}
  }

  if (currentJobId === jobId && !A.paused) {
    try { A.pause(); } catch {}
    setCardPlaying(jobId, false);
    return;
  }

  currentJobId = jobId;
  setCardPlaying(jobId, true);

  eqBarsCache.jobId = null;
  eqBarsCache.bars = null;
  bindEqBarsForCurrentJob();

  try {
    if (A.src !== src) A.src = src;
    await A.play();
  } catch (e) {
    console.warn("[panel.music] play failed", {
      jobId,
      src,
      providerSongId: String(existing.__provider_song_id || ""),
      uiState: String(existing.__ui_state || ""),
      errorName: String(e?.name || ""),
      errorMessage: String(e?.message || e || ""),
      audioCurrentSrc: String(A?.currentSrc || ""),
      audioNetworkState: Number(A?.networkState || 0),
      audioReadyState: Number(A?.readyState || 0)
    });
    setCardPlaying(jobId, false);
    toast("error", "Play başarısız (src açılamadı)");
  }
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

  function actionDownload(card){
    const jobId = String(card?.getAttribute("data-job-id") || "").trim();
    const existing = (jobs || []).find((x) => getJobId(x) === jobId) || {};
    const src = String(existing.__audio_src || card?.dataset?.src || "").trim();
    if (!src) {
      toast("error", "İndirilecek dosya yok");
      return;
    }

    const a = document.createElement("a");
    a.href = src;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("success", "İndirme başlatıldı");
  }

  if (!window.__AIVO_MUSIC_STEMS_TIMERS__) window.__AIVO_MUSIC_STEMS_TIMERS__ = new Map();
  const STEMS_TMAP = window.__AIVO_MUSIC_STEMS_TIMERS__;

  function stemsSet(jobId, patch){
    const i = jobs.findIndex((x) => getJobId(x) === jobId);
    if (i < 0) return;

    const cur = jobs[i].stems || jobs[i].__stems || {};
    const next = { ...cur, ...patch, __ts: Date.now() };

    jobs[i] = { ...jobs[i], stems: next };
    saveJobs();
  }

  async function stemsPost(body){
    const r = await fetch("/api/music/stems", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error((j && (j.error || j.message)) || ("http_" + r.status));
    return j;
  }

  function stemsClearTimer(jobId){
    const tid = STEMS_TMAP.get(jobId);
    if (tid) clearTimeout(tid);
    STEMS_TMAP.delete(jobId);
  }

  function stemsSchedulePoll(jobId, ms){
    if (!alive || !jobId) return;
    if (isHiddenJobId(jobId)) return;
    if (STEMS_TMAP.has(jobId)) return;

    const tid = setTimeout(() => {
      STEMS_TMAP.delete(jobId);
      stemsPoll(jobId);
    }, ms);

    STEMS_TMAP.set(jobId, tid);
  }

  async function stemsPoll(jobId){
    if (!alive || !jobId || isHiddenJobId(jobId)) return;

    const existing = jobs.find((x) => getJobId(x) === jobId) || {};
    const stems = existing.stems || existing.__stems || {};
    const pid = String(stems.prediction_id || "").trim();
    if (!pid) return;

    try {
      const s = await stemsPost({ prediction_id: pid });
      const status = String(s.status || "").toLowerCase();
      if (isHiddenJobId(jobId)) return;

      if (status === "succeeded") {
        stemsSet(jobId, { status: "succeeded", output: s.output || null, error: "" });
        render();
        return;
      }

      if (["failed", "canceled", "cancelled"].includes(status)) {
        stemsSet(jobId, { status: "failed", error: s.error || status });
        render();
        return;
      }

      stemsSet(jobId, { status: status || "processing" });
      render();
      stemsSchedulePoll(jobId, 2500);
    } catch (e) {
      stemsSet(jobId, { status: "failed", error: String(e?.message || e || "failed") });
      render();
    }
  }

  async function actionStems(card){
    const jobId = String(card?.getAttribute("data-job-id") || "").trim();
    if (!jobId || isHiddenJobId(jobId)) return;

    const existing = jobs.find((x) => getJobId(x) === jobId) || {};
    const src = String(existing.__audio_src || card?.dataset?.src || "").trim();
    if (!src) {
      toast("info", "Önce müzik hazır olmalı");
      return;
    }

    const stems = existing.stems || existing.__stems || {};
    const curStatus = String(stems.status || "").toLowerCase();
    const curPid = String(stems.prediction_id || "").trim();

    if (curStatus === "succeeded") {
      toast("info", "Stems zaten hazır");
      return;
    }

    if (curPid && ["starting", "processing"].includes(curStatus)) {
      stemsSchedulePoll(jobId, 200);
      toast("info", "Stems hazırlanıyor…");
      return;
    }

    stemsClearTimer(jobId);
    stemsSet(jobId, { status: "starting", prediction_id: "", output: null, error: "" });
    render();
    toast("info", "Stems başlatılıyor…");

    try {
      const c = await stemsPost({ audio_url: src });
      const pid = String(c.id || c.prediction_id || "").trim();
      const st = String(c.status || "starting").toLowerCase();
      if (!pid) throw new Error("missing_prediction_id");
      if (isHiddenJobId(jobId)) return;

      stemsSet(jobId, { status: st || "starting", prediction_id: pid, output: null, error: "" });
      render();
      toast("success", "Stems başladı");
      stemsSchedulePoll(jobId, 1200);
    } catch (e) {
      stemsSet(jobId, { status: "failed", error: String(e?.message || e || "failed") });
      render();
      toast("error", "Stems başlatılamadı");
    }
  }

  function actionLyrics(card){
    const jobId = String(card?.getAttribute("data-job-id") || "").trim();
    if (!jobId) return;

    const old = document.getElementById("aivoLyricsModal");
    if (old) old.remove();

    const existing = jobs.find((x) => getJobId(x) === jobId) || {};
    const title =
      String(existing.title || "").trim() ||
      String(card?.querySelector?.(".aivo-player-title")?.textContent || "").trim() ||
      "Şarkı";

    const lyrics = String(existing.lyrics || "").trim();
    if (!lyrics) {
      toast("info", "Bu şarkıda söz yok");
      return;
    }

    const durTextRaw =
      String(existing.__duration || existing.duration || "").trim() ||
      String(card?.querySelector?.(".meta-dur")?.textContent || "").trim();

    const dateText =
      String(existing.__createdAt || existing.created_at || existing.createdAt || "").trim() ||
      String(card?.querySelector?.(".meta-date")?.textContent || "").trim();

    const styleId = "aivoLyricsModalStyle";
    if (!document.getElementById(styleId)) {
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = `
#aivoLyricsModal{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:aivoFadeIn .18s ease-out;}
@keyframes aivoFadeIn{from{opacity:0}to{opacity:1}}
#aivoLyricsModal .aivoLm{width:min(860px,96vw);max-height:min(78vh,760px);border-radius:18px;overflow:hidden;position:relative;background:linear-gradient(180deg, rgba(30,18,56,.92), rgba(10,12,22,.92));border:1px solid rgba(140,100,255,.22);box-shadow:0 28px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset;transform:translateY(6px) scale(.99);animation:aivoPop .18s ease-out forwards;}
@keyframes aivoPop{to{transform:translateY(0) scale(1)}}
#aivoLyricsModal .aivoLmTop{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px 16px;border-bottom:1px solid rgba(255,255,255,.06);}
#aivoLyricsModal .aivoLmLeft{display:flex;gap:12px;align-items:center;min-width:0;}
#aivoLyricsModal .aivoLmIcon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,#7c5cff,#ff4fd8);box-shadow:0 10px 28px rgba(124,92,255,.25);}
#aivoLyricsModal .aivoLmTitleWrap{min-width:0;}
#aivoLyricsModal .aivoLmTitle{font-weight:800;font-size:16px;letter-spacing:.2px;color:rgba(255,255,255,.95);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#aivoLyricsModal .aivoLmMeta{margin-top:2px;font-size:12px;color:rgba(255,255,255,.55);display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
#aivoLyricsModal .aivoLmDot{width:4px;height:4px;border-radius:99px;background:rgba(255,255,255,.28);display:inline-block}
#aivoLyricsModal .aivoLmBtns{display:flex;gap:10px;align-items:center;}
#aivoLyricsModal .aivoLmBtn{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);border-radius:12px;padding:9px 12px;font-weight:700;font-size:13px;cursor:pointer;display:flex;gap:8px;align-items:center;}
#aivoLyricsModal .aivoLmBtn:hover{background:rgba(255,255,255,.10)}
#aivoLyricsModal .aivoLmX{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);cursor:pointer;font-size:18px;line-height:0}
#aivoLyricsModal .aivoLmX:hover{background:rgba(255,255,255,.10);color:rgba(255,255,255,.92)}
#aivoLyricsModal .aivoLmBody{padding:16px;max-height:calc(min(78vh,760px) - 72px);overflow:auto;}
#aivoLyricsModal .aivoLmBody::-webkit-scrollbar{width:10px}
#aivoLyricsModal .aivoLmBody::-webkit-scrollbar-thumb{background:rgba(140,100,255,.28);border-radius:999px;border:2px solid rgba(10,12,22,.6)}
#aivoLyricsModal .aivoLmBody::-webkit-scrollbar-track{background:rgba(255,255,255,.04)}
#aivoLyricsModal .aivoLmLyrics{white-space:pre-wrap;line-height:1.6;font-size:14px;color:rgba(255,255,255,.84);padding:14px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);}
      `;
      document.head.appendChild(st);
    }

    const modal = document.createElement("div");
    modal.id = "aivoLyricsModal";
    modal.innerHTML = `
      <div class="aivoLm" role="dialog" aria-modal="true" aria-label="Şarkı Sözleri">
        <div class="aivoLmTop">
          <div class="aivoLmLeft">
            <div class="aivoLmIcon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,.92)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 16a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z" fill="rgba(255,255,255,.92)"/>
                <path d="M21 14a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z" fill="rgba(255,255,255,.92)"/>
              </svg>
            </div>
            <div class="aivoLmTitleWrap">
              <div class="aivoLmTitle">Şarkı Sözleri — ${esc(title)}</div>
              <div class="aivoLmMeta">
                ${durTextRaw ? (`<span>${esc(durTextRaw)}</span>`) : `<span>—</span>`}
                <span class="aivoLmDot"></span>
                ${dateText ? (`<span>${esc(dateText)}</span>`) : `<span> </span>`}
              </div>
            </div>
          </div>
          <div class="aivoLmBtns">
            <button class="aivoLmBtn" type="button" data-lyr-action="copy" title="Kopyala"><span aria-hidden="true">📋</span> Kopyala</button>
            <button class="aivoLmX" type="button" data-lyr-action="close" aria-label="Kapat" title="Kapat">×</button>
          </div>
        </div>
        <div class="aivoLmBody">
          <div class="aivoLmLyrics" id="aivoLmLyricsText">${esc(lyrics)}</div>
        </div>
      </div>`;

    function closeLyricsModal(){
      const m = document.getElementById("aivoLyricsModal");
      if (m) m.remove();
    }

    modal.addEventListener("click", async (ev) => {
      const actBtn = ev.target.closest("[data-lyr-action]");
      if (actBtn) {
        const act = actBtn.getAttribute("data-lyr-action");
        if (act === "close") return closeLyricsModal();
        if (act === "copy") {
          try {
            await navigator.clipboard.writeText(lyrics);
            toast("success", "Kopyalandı");
          } catch {
            try {
              const ta = document.createElement("textarea");
              ta.value = lyrics;
              ta.style.position = "fixed";
              ta.style.left = "-9999px";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              ta.remove();
              toast("success", "Kopyalandı");
            } catch {
              toast("error", "Kopyalama başarısız");
            }
          }
          return;
        }
      }
      if (ev.target === modal) closeLyricsModal();
    });

    document.addEventListener("keydown", function __aivoLyricsEsc(e){
      if (e.key === "Escape") {
        closeLyricsModal();
        document.removeEventListener("keydown", __aivoLyricsEsc, true);
      }
    }, true);

    document.body.appendChild(modal);
  }

  async function resolveDbRowForDelete(jobId, baseId){
    const familyIds = new Set(buildFamilyIds(baseId));
    familyIds.add(String(jobId || "").trim());

    const familyJobs = (jobs || []).filter((x) => {
      const xid = getJobId(x);
      return xid && familyIds.has(xid);
    });

    for (const x of familyJobs) {
      const dbId = String(x?.__db_job_id || x?.db_job_id || "").trim();
      if (isUuid(dbId)) return { dbJobId: dbId, row: null, source: "memory_uuid" };
    }

    let memoryFallback = "";
    for (const x of familyJobs) {
      const dbId = String(x?.__db_job_id || x?.db_job_id || "").trim();
      if (dbId && !memoryFallback) memoryFallback = dbId;
    }

    try {
      const r = await fetch("/api/jobs/list?app=music", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) {
        return memoryFallback
          ? { dbJobId: memoryFallback, row: null, source: "memory_any" }
          : { dbJobId: "", row: null, source: "list_fail" };
      }

      const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.jobs) ? j.jobs : []);

      for (const row of items) {
        if (!row || isRowDeleted(row)) continue;

        const rowDbId = getRowDbId(row);
        const rowBaseId = getRowBaseId(row);
        const cards = mapDbJobToCards(row);
        const cardIds = cards.map((c) => getJobId(c)).filter(Boolean);

        const providerSongIds = Array.isArray(row?.meta?.provider_song_ids)
          ? row.meta.provider_song_ids.map((v) => String(v || "").trim()).filter(Boolean)
          : (Array.isArray(row?.provider_song_ids)
            ? row.provider_song_ids.map((v) => String(v || "").trim()).filter(Boolean)
            : []);

        const match =
          (rowDbId && familyIds.has(rowDbId)) ||
          (rowBaseId && rowBaseId === baseId) ||
          cardIds.some((id) => familyIds.has(id)) ||
          providerSongIds.includes(baseId);

        if (!match) continue;

        return { dbJobId: rowDbId, row, source: "list" };
      }
    } catch (e) {
      console.warn("[panel.music] resolveDbRowForDelete failed", e);
    }

    if (memoryFallback) return { dbJobId: memoryFallback, row: null, source: "memory_any" };
    return { dbJobId: "", row: null, source: "none" };
  }
      
async function actionDelete(card){
  const jobId = String(card?.getAttribute("data-job-id") || "").trim();
  console.log("[MUSIC_DELETE_FN]", { jobId });
  if (!jobId) return;

  const baseId = getBaseIdFromJobId(jobId);
  const isRev = getVariantOfJobId(jobId) === "rev1";
  const otherId = isRev ? `${baseId}::orig` : `${baseId}::rev1`;

  const otherStillExists = (jobs || []).some((x) => getJobId(x) === otherId);

 if (otherStillExists) {
  try {
    const dbJobId = String(
      (jobs || []).find((x) => getJobId(x) === jobId)?.__db_job_id || ""
    ).trim();

    if (!dbJobId) {
      toast("error", "DB job id bulunamadı");
      return;
    }

    const r = await fetch("/api/jobs/delete", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        job_id: dbJobId,
        app: "music",
        variant: getVariantOfJobId(jobId)
      })
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      toast("error", "Silme başarısız");
      return;
    }

    hiddenDeletedIds.add(jobId);
    clearPoll(jobId);
    POLL_BUSY.delete(jobId);
    POLL_LAST.delete(jobId);
    stemsClearTimer(jobId);

    if (currentJobId === jobId && audioEl) {
      try { audioEl.pause(); } catch {}
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    }

    jobs = (jobs || []).filter((x) => getJobId(x) !== jobId);
    saveJobs();
    render();
    toast("success", "Kart kaldırıldı");
    return;
  } catch (e) {
    console.warn("[panel.music] variant delete failed", e);
    toast("error", "Silme hatası");
    return;
  }
}

  const { dbJobId } = await resolveDbRowForDelete(jobId, baseId);

  if (!dbJobId) {
    hiddenDeletedIds.add(jobId);
    clearPoll(jobId);
    POLL_BUSY.delete(jobId);
    POLL_LAST.delete(jobId);
    stemsClearTimer(jobId);

    if (currentJobId === jobId && audioEl) {
      try { audioEl.pause(); } catch {}
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    }

    jobs = (jobs || []).filter((x) => getJobId(x) !== jobId);
    saveJobs();
    render();
    toast("success", "Kart kaldırıldı");
    return;
  }

  try {
    const r = await fetch("/api/jobs/delete", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: dbJobId })
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      const staleNotFound =
        r.status === 404 ||
        String(j?.error || "").trim() === "not_found_or_not_owned";

      if (staleNotFound) {
        hiddenDeletedIds.add(jobId);
        clearPoll(jobId);
        POLL_BUSY.delete(jobId);
        POLL_LAST.delete(jobId);
        stemsClearTimer(jobId);

        if (currentJobId === jobId && audioEl) {
          try { audioEl.pause(); } catch {}
          currentJobId = null;
          eqBarsCache.jobId = null;
          eqBarsCache.bars = null;
          stopRaf();
        }

        jobs = (jobs || []).filter((x) => getJobId(x) !== jobId);
        saveJobs();
        render();
        toast("success", "Kart kaldırıldı");
        return;
      }

      toast("error", "Silme başarısız");
      return;
    }

    hiddenDeletedIds.add(jobId);
    clearPoll(jobId);
    POLL_BUSY.delete(jobId);
    POLL_LAST.delete(jobId);
    stemsClearTimer(jobId);

    if (currentJobId === jobId && audioEl) {
      try { audioEl.pause(); } catch {}
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    }

    jobs = (jobs || []).filter((x) => getJobId(x) !== jobId);
    saveJobs();
    render();
    toast("success", "Silindi");

    try { await hydrateFromDBOnce(); } catch {}
    try { dbCtrl?.hydrate?.(); } catch {}
  } catch (e) {
    console.warn("[panel.music] delete failed", e);
    toast("error", "Silme hatası");
  }
}
  function onCardClick(e){
    const btn = e.target.closest("[data-action]");
    const card = e.target.closest(".aivo-player-card");
    if (!card) return;

    const act = btn?.dataset?.action || null;
    if (!act) {
      if (card.classList.contains("is-ready")) togglePlayFromCard(card);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (act === "stems_5_confirm") {
      const job_id =
        card.getAttribute("data-job-id") ||
        card.dataset.jobId ||
        card.getAttribute("data-track-id") ||
        card.dataset.trackId ||
        card.getAttribute("data-provider-job-id") ||
        card.dataset.providerJobId ||
        "";

      window.openStemConfirmModal?.({
        job_id,
        onConfirm: async () => {
          console.debug("[stems] confirmed 5 credits", { job_id });
          await actionStems(card);
        }
      });
      return;
    }

    if (act === "toggle-play") return togglePlayFromCard(card);
    if (act === "stems") return actionStems(card);
    if (act === "lyrics") return actionLyrics(card);
    if (act === "download") return actionDownload(card);
    if (act === "delete") return actionDelete(card);

    toast("info", `Action: ${act}`);
  }

  const POLL_BUSY = new Set();
  const POLL_LAST = new Map();
  if (!window.__AIVO_MUSIC_READY_TOASTED__) window.__AIVO_MUSIC_READY_TOASTED__ = new Set();
  const READY_TOASTED = window.__AIVO_MUSIC_READY_TOASTED__;
  const MUSIC_WORKER_ORIGIN = WORKER_ORIGIN || "https://aivo-archive-worker.aivostudioapp.workers.dev";

  function pickAudioFromStatus(j){
    const tm0 = j?.topmediai?.data?.[0] || null;
    const src =
      j?.audio?.src ||
      j?.audio_src ||
      j?.result?.audio?.src ||
      j?.result?.src ||
      j?.job?.audio?.src ||
      tm0?.audio_url ||
      "";

    const dur =
      j?.duration ||
      j?.audio?.duration ||
      j?.result?.duration ||
      tm0?.duration ||
      "";

    const outId =
      j?.audio?.output_id ||
      j?.output_id ||
      j?.result?.output_id ||
      j?.job?.output_id ||
      "";

    const title =
      j?.title ||
      tm0?.title ||
      j?.job?.title ||
      "";

    const state =
      j?.state ||
      j?.status ||
      j?.job?.status ||
      "";

    return {
      src: String(src || "").trim(),
      duration: dur,
      output_id: String(outId || "").trim(),
      title: String(title || "").trim(),
      state: String(state || "").trim(),
    };
  }

  async function poll(cardId){
    const id = String(cardId || "").trim();
    if (!alive || !id || isHiddenJobId(id)) return;

    const now = Date.now();
    const last = POLL_LAST.get(id) || 0;
    if (now - last < 1200) return;
    POLL_LAST.set(id, now);

    if (POLL_BUSY.has(id)) return;
    POLL_BUSY.add(id);

    try {
      clearPoll(id);
      if (isHiddenJobId(id)) return;

      const existing = (jobs || []).find((x) => getJobId(x) === id) || {};
      const providerSongId = String(existing.__provider_song_id || "").trim();
      const providerBase = getBaseIdFromJobId(id);
      const q = encodeURIComponent(providerSongId || providerBase);

      const r = await fetch(`/api/music/status?provider_job_id=${q}`, {
        cache: "no-store",
        credentials: "include",
      });

      let j = null;
      try { j = await r.json(); } catch { j = null; }

      if (isHiddenJobId(id)) return;

      if (!r.ok || !j || j.ok === false) {
        schedulePoll(id, 1800);
        return;
      }

      const { src, duration, output_id, title, state } = pickAudioFromStatus(j);
      const st = uiState(state);
      const playUrl = (!src && providerBase && output_id)
        ? `${MUSIC_WORKER_ORIGIN}/files/play?job_id=${encodeURIComponent(providerBase)}&output_id=${encodeURIComponent(output_id)}`
        : "";

      const baseId = providerBase;
      const isOrig = String(id).endsWith("::orig");
      const otherId = isOrig ? `${baseId}::rev1` : `${baseId}::orig`;

      const gotAudio = !!(src || playUrl);
      const next = {
        job_id: id,
        id,
        __ui_state: gotAudio ? "processing" : st,
        __pending_src: src || playUrl || "",
        __pending_output_id: output_id || existing.output_id || "",
      };

      if (duration) next.__pending_duration = String(duration);
      if (title) next.title = title;
      if (existing.__db_job_id) next.__db_job_id = existing.__db_job_id;
      if (existing.provider_job_id) next.provider_job_id = existing.provider_job_id;
      if (existing.__provider_song_id) next.__provider_song_id = existing.__provider_song_id;

      if (st === "error") {
        upsertJob({ ...next, __ui_state: "error" });
        render();
        return;
      }

      upsertJob(next);

      const me = (jobs || []).find((x) => getJobId(x) === id) || {};
      const other = (jobs || []).find((x) => getJobId(x) === otherId) || {};

      const meSrc = String(me.__pending_src || me.__audio_src || "").trim();
      const otherSrc = String(other.__pending_src || other.__audio_src || "").trim();

      if (meSrc && otherSrc) {
        const meOut = String(me.__pending_output_id || me.output_id || "").trim();
        const otherOut = String(other.__pending_output_id || other.output_id || "").trim();
        const meDur = String(me.__pending_duration || me.__duration || "").trim();
        const otherDur = String(other.__pending_duration || other.__duration || "").trim();

        upsertJob({
          job_id: id,
          id,
          __ui_state: "ready",
          __audio_src: meSrc,
          output_id: meOut,
          ...(meDur ? { __duration: meDur } : {}),
          __pending_src: "",
          __pending_output_id: "",
          __pending_duration: "",
          __db_job_id: String(me.__db_job_id || existing.__db_job_id || "").trim(),
          provider_job_id: String(me.provider_job_id || existing.provider_job_id || "").trim(),
          __provider_song_id: String(me.__provider_song_id || existing.__provider_song_id || "").trim(),
        });

        upsertJob({
          job_id: otherId,
          id: otherId,
          __ui_state: "ready",
          __audio_src: otherSrc,
          output_id: otherOut,
          ...(otherDur ? { __duration: otherDur } : {}),
          __pending_src: "",
          __pending_output_id: "",
          __pending_duration: "",
          __db_job_id: String(other.__db_job_id || existing.__db_job_id || "").trim(),
          provider_job_id: String(other.provider_job_id || existing.provider_job_id || "").trim(),
          __provider_song_id: String(other.__provider_song_id || "").trim(),
        });

        render();

        if (baseId && !READY_TOASTED.has(baseId)) {
          READY_TOASTED.add(baseId);
          toast("success", "Müzikler hazır 🎵");
        }
        return;
      }

      render();
      schedulePoll(id, 1600);
    } catch (e) {
      schedulePoll(id, 2000);
    } finally {
      POLL_BUSY.delete(id);
    }
  }

 function mapDbJobToCards(row){
  if (!row || isRowDeleted(row)) return [];

  const meta = row?.meta || {};
  const appGuess = String(row?.app || meta?.app || meta?.module || meta?.routeKey || "").trim();
  if (appGuess && !isMusicApp(appGuess)) return [];

  const provider_job_id = getRowProviderJobId(row);
  const dbJobId = getRowDbId(row);
  const baseId = provider_job_id || String(row?.provider_job_id || row?.providerJobId || row?.job_id || row?.id || "").trim();
  if (!baseId) return [];

  const songIds = Array.isArray(meta?.provider_song_ids)
    ? meta.provider_song_ids
    : (Array.isArray(row?.provider_song_ids) ? row.provider_song_ids : []);

  const songIdOrig = String(songIds[0] || provider_job_id || baseId).trim();
  const songIdRev = String(songIds[1] || songIds[0] || provider_job_id || baseId).trim();

  const deletedVariants = Array.isArray(meta?.deleted_variants)
    ? meta.deleted_variants.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const createdMs = toMs(row?.created_at) || toMs(row?.createdAt) || toMs(meta?.created_at) || Date.now();
  const rawStatus = norm(row?.db_status || row?.status || row?.state || "");
  const st =
    ["ready", "done", "completed", "success", "succeeded"].includes(rawStatus) ? "ready" :
    (["error", "failed", "fail"].includes(rawStatus) ? "error" : "processing");

  const audioSrc = String(
    meta?.audio_src ||
    meta?.audioUrl ||
    row?.audio_src ||
    row?.audioUrl ||
    row?.result?.audio?.src ||
    row?.result?.src ||
    ""
  ).trim();

  const duration = String(
    meta?.duration ||
    row?.duration ||
    row?.result?.duration ||
    ""
  ).trim();

  const baseCommon = {
    type: "music",
    __db_job_id: dbJobId,
    provider_job_id: provider_job_id || baseId,
    __ui_state: st,
    __audio_src: audioSrc,
    createdAt: createdMs,
    __createdAt: row?.created_at || meta?.created_at || "",
    created_at: row?.created_at || meta?.created_at || "",
    updated_at: row?.updated_at || meta?.updated_at || "",
    title: String(meta?.title || row?.title || "").trim(),
    lyrics: String(meta?.lyrics || row?.lyrics || "").trim(),
    prompt: String(meta?.prompt || row?.prompt || "").trim(),
    subtitle: String(meta?.subtitle || "").trim(),
    __duration: duration,
  };

  const cards = [];

  if (!deletedVariants.includes("orig")) {
    cards.push({
      ...baseCommon,
      job_id: `${baseId}::orig`,
      id: `${baseId}::orig`,
      __provider_song_id: songIdOrig
    });
  }

  if (!deletedVariants.includes("rev1")) {
    cards.push({
      ...baseCommon,
      job_id: `${baseId}::rev1`,
      id: `${baseId}::rev1`,
      __provider_song_id: songIdRev
    });
  }

  return cards;
}

function onJob(e){
  const payload = e?.detail || e || {};
  const baseId = String(payload.provider_job_id || payload.job_id || payload.id || "").trim();
  if (!baseId) return;
  if (hiddenDeletedBaseIds.has(baseId)) return;

  const origId = `${baseId}::orig`;
  const revId = `${baseId}::rev1`;

  const providerJobId = String(payload.provider_job_id || "").trim();
  const rawSongIds = Array.isArray(payload.provider_song_ids) ? payload.provider_song_ids : [];

  const songIdOrig = String(rawSongIds[0] || providerJobId || baseId).trim();
  const songIdRev = String(rawSongIds[1] || rawSongIds[0] || providerJobId || baseId).trim();
  const safeTitle = String(payload.title || "").trim();

  const common = {
    type: "music",
    subtitle: String(payload.subtitle || "").trim(),
    provider_job_id: providerJobId,
    __ui_state: "processing",
    __audio_src: "",
    title: safeTitle,
    lyrics: String(payload.lyrics || "").trim(),
    prompt: String(payload.prompt || "").trim(),
    __createdAt: payload.created_at || payload.createdAt || "",
    createdAt: Date.now(),
  };

  upsertJob({ ...common, job_id: origId, id: origId, __provider_song_id: songIdOrig });
  upsertJob({ ...common, job_id: revId, id: revId, __provider_song_id: songIdRev });

  render();
  poll(origId);
  poll(revId);
}

function setMusicHostForEvents(el){
  if (!window.__AIVO_MUSIC_EVENTS__) {
    window.__AIVO_MUSIC_EVENTS__ = { attached: false, host: null };
  }
  window.__AIVO_MUSIC_EVENTS__.host = el || null;
  if (window.__AIVO_MUSIC_EVENTS__.attached) return;
  window.__AIVO_MUSIC_EVENTS__.attached = true;

  window.addEventListener("click", (e) => {
    try {
      if (window.RightPanel?.getCurrentKey?.() !== "music") return;
      const H = window.__AIVO_MUSIC_EVENTS__.host;
      if (!H || !H.contains(e.target)) return;
      onCardClick(e);
    } catch (err) {
      console.warn("[panel.music] click handler error", err);
    }
  }, true);

    window.addEventListener("pointerdown", (e) => {
      try {
        if (window.RightPanel?.getCurrentKey?.() !== "music") return;
        const H = window.__AIVO_MUSIC_EVENTS__.host;
        if (!H || !H.contains(e.target)) return;
        if (e.target.closest(".aivo-progress")) onProgressSeek(e);
      } catch (err) {
        console.warn("[panel.music] pointer handler error", err);
      }
    }, true);
  }

  function onSearch(q){
    __searchQ = String(q || "").trim().toLowerCase();
    applyMusicSearchFilter();
  }

  function getHeader(){
    return {
      title: "Müziklerim",
      meta: "⚠️ Müzik dosyaları 14 gün saklanır.",
      searchPlaceholder: "Müziklerde ara...",
      searchEnabled: true,
      resetSearch: false
    };
  }

  function hydrateMergeWithDbRows(rows){
    const safeRows = Array.isArray(rows) ? rows : [];
    const dbCards = [];

    for (const row of safeRows) {
      if (!row || isRowDeleted(row) || isHiddenRow(row)) continue;
      const cards = mapDbJobToCards(row);
      if (cards && cards.length) dbCards.push(...cards);
    }

    const byId = new Map();

    for (const c of dbCards) {
      const id = getJobId(c);
      if (!id || isHiddenJobId(id)) continue;
      byId.set(id, c);
    }

    for (const old of (jobs || [])) {
      const id = getJobId(old);
      if (!id || isHiddenJobId(id)) continue;
      if (byId.has(id)) {
        byId.set(id, mergePreferDbButKeepReady(old, byId.get(id)));
      }
    }

    jobs = Array.from(byId.values());
    saveJobs();
    render();
  }

  async function hydrateFromDBOnce(){
    try {
      const r = await fetch("/api/jobs/list?app=music", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) return;

      const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.jobs) ? j.jobs : []);
      hydrateMergeWithDbRows(items);
    } catch (e) {
      console.warn("[panel.music] hydrateFromDBOnce error", e);
    }
  }

  function mount(contentEl){
    hostEl = contentEl;
    alive = true;
    setMusicHostForEvents(hostEl);

    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-body" id="musicList"></div>
        </div>
      </div>`;

    listEl = hostEl.querySelector("#musicList");
    if (listEl) listEl.className = "aivo-player-list";

    ensureAudio();

    const mainAudio = document.getElementById("mainAudio");
    if (mainAudio) {
      try { mainAudio.pause?.(); } catch {}
      mainAudio.removeAttribute("src");
      try { mainAudio.load?.(); } catch {}
      mainAudio.style.display = "none";
    }

    jobs = loadJobs().filter((j) => {
      const id = getJobId(j);
      return id && !isHiddenJobId(id);
    });
    render();
    hydrateFromDBOnce();

    try { dbCtrl?.destroy?.(); } catch {}
    dbCtrl = null;

    if (window.DBJobs && typeof window.DBJobs.create === "function") {
      dbCtrl = window.DBJobs.create({
        app: "music",
        debug: false,
        pollIntervalMs: 4000,
        hydrateEveryMs: 15000,
        acceptJob: (job) => {
          if (!job || isRowDeleted(job)) return false;
          const a = String(job?.app || job?.meta?.app || job?.meta?.module || job?.meta?.routeKey || "").trim();
          if (a && !isMusicApp(a)) return false;
          const baseId = getRowBaseId(job);
          const dbId = getRowDbId(job);
          if (baseId && hiddenDeletedBaseIds.has(baseId)) return false;
          if (dbId && hiddenDeletedDbIds.has(dbId)) return false;
          return true;
        },
        acceptOutput: (o) => {
          const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind || "");
          return !t || t === "audio";
        },
        onChange: (items) => {
          if (!alive) return;
          hydrateMergeWithDbRows(items);
          (jobs || []).slice(0, 60).forEach((j) => {
            const id = getJobId(j);
            if (id && !isHiddenJobId(id)) poll(id);
          });
        }
      });
    }

    window.addEventListener("aivo:job", onJob, true);
    (jobs || []).slice(0, 60).forEach((j) => {
      const id = getJobId(j);
      if (id && !isHiddenJobId(id)) poll(id);
    });
    applyMusicSearchFilter();

    return () => destroy();
  }

  function destroy(){
    alive = false;
    setMusicHostForEvents(null);
    window.removeEventListener("aivo:job", onJob, true);

    clearAllPolls();
    stopRaf();

    try { dbCtrl?.destroy?.(); } catch {}
    dbCtrl = null;

    try { if (audioEl) audioEl.pause(); } catch {}
    currentJobId = null;
    eqBarsCache.jobId = null;
    eqBarsCache.bars = null;
    hostEl = null;
    listEl = null;
  }

  function register(){
    window.RightPanel.register(PANEL_KEY, { getHeader, mount, destroy, onSearch });
    console.log("[panel.music] registered");
  }

  waitForReady(register);

  window.addEventListener("pageshow", (ev) => {
    try {
      if (ev && ev.persisted) {
        waitForReady(register);
      }
    } catch {}
  }, { passive: true });

  (function ensureStemConfirmModalHelpers(){
    if (window.openStemConfirmModal) return;

    const MODAL_ID = "aivoStemConfirmModal";

    function closeStemConfirmModal(){
      const el = document.getElementById(MODAL_ID);
      if (el) el.remove();
    }

    function openStemConfirmModal({ job_id, onConfirm }){
      closeStemConfirmModal();

      const overlay = document.createElement("div");
      overlay.id = MODAL_ID;
      overlay.innerHTML = `
        <div class="aivoStemOverlay" role="dialog" aria-modal="true">
          <div class="aivoStemModal">
            <button class="aivoStemX" type="button" aria-label="Kapat">×</button>
            <div class="aivoStemTitle">Kanal Ayırma</div>
            <div class="aivoStemDesc">Bu işlem 5 kredi kullanır. Devam edilsin mi?</div>
            <div class="aivoStemFine">Bu işlem başlamadan önce kredi kesilir.</div>
            <div class="aivoStemBtns">
              <button class="aivoStemBtn aivoStemCancel" type="button">İptal</button>
              <button class="aivoStemBtn aivoStemOk" type="button">Onayla (5 Kredi)</button>
            </div>
          </div>
        </div>

        <style>
          .aivoStemOverlay{position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding:18px;}
          .aivoStemModal{width:min(520px, 96vw); border-radius:18px; background:rgba(20,20,24,.92); border:1px solid rgba(255,255,255,.10); box-shadow: 0 20px 60px rgba(0,0,0,.55); padding:18px 18px 16px; position:relative;}
          .aivoStemX{position:absolute; top:12px; right:12px; width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#fff; font-size:22px; line-height:32px; cursor:pointer;}
          .aivoStemTitle{ color:#fff; font-weight:700; font-size:18px; margin-bottom:6px; }
          .aivoStemDesc{ color:rgba(255,255,255,.82); font-size:14px; line-height:1.35; }
          .aivoStemFine{ margin-top:8px; color:rgba(255,255,255,.55); font-size:12px; }
          .aivoStemBtns{ margin-top:14px; display:flex; gap:10px; justify-content:flex-end; }
          .aivoStemBtn{ border-radius:12px; padding:10px 12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#fff; cursor:pointer; font-weight:600; }
          .aivoStemBtn:hover{ background:rgba(255,255,255,.10); }
          .aivoStemOk{ background:rgba(140,90,255,.28); border:1px solid rgba(160,120,255,.45); }
          .aivoStemOk:hover{ background:rgba(140,90,255,.36); }
          .aivoStemBtn[disabled]{ opacity:.55; cursor:not-allowed; }
        </style>`;

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeStemConfirmModal();
      });

      const btnX = overlay.querySelector(".aivoStemX");
      const btnCancel = overlay.querySelector(".aivoStemCancel");
      const btnOk = overlay.querySelector(".aivoStemOk");

      btnX.addEventListener("click", () => closeStemConfirmModal());
      btnCancel.addEventListener("click", () => closeStemConfirmModal());

      let locked = false;
      btnOk.addEventListener("click", async () => {
        if (locked) return;
        locked = true;
        btnOk.disabled = true;
        const prev = btnOk.textContent;
        btnOk.textContent = "Yükleniyor...";

        try {
          await (onConfirm?.({ job_id }));
          closeStemConfirmModal();
        } catch (err) {
          console.error("[stems] confirm failed", err);
          btnOk.disabled = false;
          btnOk.textContent = prev;
          locked = false;
        }
      });

      document.body.appendChild(overlay);

      const onKey = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKey);
          closeStemConfirmModal();
        }
      };
      document.addEventListener("keydown", onKey);

      console.debug("[stems] open confirm modal", { job_id });
    }

    window.openStemConfirmModal = openStemConfirmModal;
    window.closeStemConfirmModal = closeStemConfirmModal;
  })();
})();
