/* =========================================================
   AIVO Right Panel — Music Panel (CUSTOM PLAYER UI)
   File: /js/panel.music.js
   - UI: "aivo-player-card" (STATIC CARD v1 ile uyumlu)
   - Davranış: panel.music.js yönetir (play/pause/progress/actions)
   - Job kaynağı: studio.music.generate.js -> "aivo:job" event
   - Status: /api/music/status?job_id=...
   - EXTRA: "Müzik Üret" click -> 2x generate + 2 kart aynı anda (opsiyonel köprü)
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.jobs.v3";

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

    // ✅ EQ için gerekli
    audioEl.crossOrigin = "anonymous";
    initEqEngine();   // 🔥 BURAYA EKLENDİ

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
    if (currentJobId) setCardPlaying(currentJobId, false);
    stopRaf();
  };

  audioEl.onplay = () => {
    if (currentJobId) setCardPlaying(currentJobId, true);
    startRaf();
  };

  return audioEl;
}
/* ---------------- EQ engine (beat-reactive) ---------------- */
let eqRaf = 0;

function initEqEngine(){
  if(!audioEl) return;
  if(audioEl.__eqInited) return;
  audioEl.__eqInited = true;

  // AudioContext + analyser
  let ctx = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch (e){
    console.warn("[music:eq] AudioContext not available", e);
    return;
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;                 // hızlı/akıcı
  analyser.smoothingTimeConstant = 0.85;  // yumuşak geçiş

  let srcNode = null;
  try {
    srcNode = ctx.createMediaElementSource(audioEl);
  } catch (e){
    // aynı audioEl için ikinci kez source yaratılırsa exception atar
    console.warn("[music:eq] createMediaElementSource failed (already?)", e);
    return;
  }

  srcNode.connect(analyser);
  analyser.connect(ctx.destination);

  const freq = new Uint8Array(analyser.frequencyBinCount);

  audioEl.__eq = { ctx, analyser, freq };

  // play/pause durumlarında döngüyü yönet
  audioEl.addEventListener("play", () => {
    try { ctx.resume?.(); } catch {}
    startEqLoop();
  }, { passive:true });

  audioEl.addEventListener("pause", () => stopEqLoop(), { passive:true });
  audioEl.addEventListener("ended", () => stopEqLoop(), { passive:true });

  // sayfa ilk açıldığında “autoplay yok” ama user play’e basınca çalışır
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
  // pause’da barları sakinleştir
  setEqBars(0.08, 0.06, 0.04);
}

function eqTick(){
  eqRaf = requestAnimationFrame(eqTick);

  if(!audioEl || audioEl.paused) return;
  const pack = audioEl.__eq;
  if(!pack) return;

  const { analyser, freq } = pack;
  analyser.getByteFrequencyData(freq);

  // 3 band çıkar (low/mid/high) => 7 bar’a güzel dağıtacağız
  const low  = bandAvg(freq, 2, 10);   // bass
  const mid  = bandAvg(freq, 10, 28);  // body
  const high = bandAvg(freq, 28, 60);  // air

  // 0..1 normalize (0..255)
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
  // sadece “şu an çalan kartın” butonundaki EQ’yu hareket ettir
  // (mevcut kodunda currentJobId var: onu kullanıyoruz)
  if(!currentJobId) return;

  const card = hostEl?.querySelector?.(`.aivo-player-card[data-job-id="${CSS.escape(String(currentJobId))}"]`);
  if(!card) return;

  const bars = card.querySelectorAll(".aivo-player-btn .aivo-eq i");
  if(!bars || !bars.length) return;

  // “ultra” görünüm: bass daha çok, high daha titrek
  // 7 bar: L ağırlıklı merkez, dışlara doğru M/H karışımı
  const v = [
    0.20 + H*0.70,
    0.25 + M*0.85,
    0.30 + L*1.00,
    0.25 + L*1.15,  // center “kick”
    0.30 + L*1.00,
    0.25 + M*0.85,
    0.20 + H*0.70,
  ];

  for(let i=0;i<bars.length;i++){
    const k = v[i] ?? 0.2;
    // cap + min (zıplama kontrollü)
    const s = clamp01(k);
    bars[i].style.transform = `scaleY(${0.15 + s*1.15})`;
  }
}
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

    // stop if playing
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

  function uid(prefix="tmp"){
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

  const title = job.title || "Müzik Üretimi";
  const sub   = job.subtitle || "";
  const lang  = job.lang || "Türkçe";
  const dur   = job.duration || job.__duration || "";
  const date  = job.created_at || job.createdAt || job.__createdAt || "";

  const tagReady = `<span class="aivo-tag is-ready">Hazır</span>`;
const tagProc  = `<span class="aivo-tag is-loading">Hazırlanıyor…</span>`;
  const tagErr   = `<span class="aivo-tag is-error">Hata</span>`;

// ✅ artık "ready" UI state şart (iki kart birlikte unlock edilecek)
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
  // ✅ tag'i de src ile belirle
  const tags =
    isReady ? `${tagReady}<span class="aivo-tag">${esc(lang)}</span>` :
    st === "error" ? `${tagErr}` :
    `${tagProc}`;

  const metaLeft = dur ? esc(dur) : "0:00";
  const metaRight = date ? esc(date) : "";

  // ✅ disable sadece src yoksa
  const disabled = (!job.__audio_src) ? 'data-disabled="1"' : "";

  return `
<div class="aivo-player-card ${isReady ? "is-ready" : st === "error" ? "is-error" : "is-loading is-processing"}"
  data-job-id="${esc(jobId)}"
  data-output-id="${esc(job.output_id || "")}"
  data-loading-started-at="${esc(job.__loading_startedAt || "")}"
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

  <!-- ✅ Progress artık controls dışında -->
  <div class="aivo-progress" title="İlerleme">
    <i style="width:${esc(job.__progress || 0)}%"></i>
  </div>

  <!-- Controls boş kalabilir (layout bozulmaması için) -->
  <div class="aivo-player-controls"></div>
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
/* ================= LOADING TICKER (Hazırlanıyor % + blink) ================= */
if (!window.__AIVO_LOADING_TICKER__) {
  window.__AIVO_LOADING_TICKER__ = true;

  // cardKey -> { lastPct, inflight, lastFetchAt }
  const _prog = new Map();

  const clampPct = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    // 0..100 -> 1..99 (READY olunca zaten is-ready render olur)
    const pct = Math.max(1, Math.min(99, Math.floor(x)));
    return pct;
  };

  const pickProviderId = (card) => {
    // En olası attribute isimleri (sende hangisi varsa onu yakalar)
    return (
      card.getAttribute("data-provider-song-id") ||
      card.getAttribute("data-provider_song_id") ||
      card.getAttribute("data-provider-job-id") ||
      card.getAttribute("data-provider_job_id") ||
      card.getAttribute("data-provider") ||
      ""
    );
  };

  const readProgressFromJson = (j) => {
    if (!j || typeof j !== "object") return null;

    // yaygın alan isimleri
    const direct =
      j.progress ?? j.pct ?? j.percent ?? j.percentage ??
      j?.data?.progress ?? j?.data?.pct ?? j?.data?.percent ?? j?.data?.percentage;

    if (direct != null) return clampPct(direct);

    // bazı API’ler 0..1 arası dönebiliyor
    const frac =
      j.fraction ?? j.frac ?? j?.data?.fraction ?? j?.data?.frac;
    if (frac != null) return clampPct(Number(frac) * 100);

    return null;
  };

  setInterval(() => {
    const cards = document.querySelectorAll(".aivo-player-card.is-loading.is-processing");
    const now = Date.now();

    cards.forEach((card) => {
      const pctEl = card.querySelector('[data-bind="loadingPct"]');
      if (!pctEl) return;

      // blink
      const tag = card.querySelector(".aivo-tag.is-loading");
      if (tag) {
        const visible = tag.getAttribute("data-blink") !== "1";
        tag.setAttribute("data-blink", visible ? "1" : "0");
        tag.style.opacity = visible ? "1" : "0.45";
      }

      const providerId = pickProviderId(card);
      if (!providerId) {
        // provider id yoksa yüzde göstermeyelim (uydurma olmasın)
        pctEl.textContent = "";
        return;
      }

      const key = String(providerId);
      const st = _prog.get(key) || { lastPct: 1, inflight: false, lastFetchAt: 0 };
      _prog.set(key, st);

      // UI: eldeki son pct’yi yaz (geri düşmez)
      pctEl.textContent = `· ${st.lastPct}%`;

      // fetch throttling (1.2sn)
      if (st.inflight) return;
      if (now - st.lastFetchAt < 1200) return;

      st.inflight = true;
      st.lastFetchAt = now;

      fetch(`/api/music/status?provider_job_id=${encodeURIComponent(providerId)}`, { credentials: "include" })
        .then((r) => r.json().catch(() => null))
        .then((json) => {
          const pct = readProgressFromJson(json);

          // gerçek pct yoksa dokunma (uydurma yapma)
          if (pct == null) return;

          // monotonic: asla geri düşmesin
          if (pct > st.lastPct) st.lastPct = pct;
        })
        .catch(() => {})
        .finally(() => {
          st.inflight = false;
        });
    });
  }, 450);
}
/* ================= /LOADING TICKER ================= */
function render(){
  // 🚫 Music panel aktif değilse ASLA DOM'a dokunma
  if (window.RightPanel?.getCurrentKey?.() !== "music") return;

  if (!ensureHost() || !ensureList()) return;

  const view = jobs.filter(j => j?.job_id || j?.id);

     // ✅ her base için sıralama: ::orig üstte, ::rev1 altta
  view.sort((a, b) => {
    const aid = String(a.job_id || a.id || "");
    const bid = String(b.job_id || b.id || "");

    const abase = aid.split("::")[0];
    const bbase = bid.split("::")[0];

    // önce base (yeni base üstte kalsın)
    if (abase !== bbase) return bbase.localeCompare(abase);

    // aynı base içinde: orig önce, rev sonra
    const ar = aid.endsWith("::orig") ? 0 : aid.endsWith("::rev1") ? 1 : 9;
    const br = bid.endsWith("::orig") ? 0 : bid.endsWith("::rev1") ? 1 : 9;
    return ar - br;
  });

  if (!view.length){
   listEl.innerHTML = `
  <div class="aivo-empty">
    <div class="aivo-empty-sub">Player kartları hazır olunca burada görünecek.</div>
  </div>`;
    return;
  }

  listEl.innerHTML = view.map(renderCard).join("");
   applyMusicSearchFilter();
}

function getMusicSearchQ(){
  const el = document.getElementById("musicOutputsSearch");
  return (el?.value || "").trim().toLowerCase();
}

function applyMusicSearchFilter(){
  const q = getMusicSearchQ();
  const cards = (listEl || document).querySelectorAll(".aivo-player-card");
  cards.forEach(card => {
    const text = (card.textContent || "").toLowerCase();
    card.style.display = (!q || text.includes(q)) ? "" : "none";
  });
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

async function togglePlayFromCard(card){
  if (!card) return;

  let src = card.dataset.src || card.getAttribute("data-src") || "";
  const jobId = card.getAttribute("data-job-id") || "";
  if (!jobId) return;

  // base provider id
  const baseId = String(jobId).split("::")[0];

  // kartta real job id saklandıysa onu kullan
  const existing = jobs.find(x => (x.job_id || x.id) === jobId) || {};
  const realJobId = existing.__real_job_id || baseId;

  // src boşsa / yanlışsa self-heal
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

// provider mp3 verdiyse onu kullan
const realSrc =
  d?.audio?.src ||
  d?.audio_src ||
  "";

// 🔥 MUTLAKA worker origin
const WORKER_ORIGIN = "https://aivo-archive-worker.aivostudioapp.workers.dev";

// src yoksa worker /files/play üret
const playUrl = (realJobId && outputId)
  ? `${WORKER_ORIGIN}/files/play?job_id=${encodeURIComponent(realJobId)}&output_id=${encodeURIComponent(outputId)}`
  : "";

src = realSrc || playUrl || "";

if (!src){
  toast("info", "Henüz hazır değil (audio src yok)");
  return;
}


      // kartı unlock et
      card.dataset.src = src;
      card.setAttribute("data-src", src);
      card.dataset.disabled = "0";
      card.setAttribute("data-disabled", "0");
      card.classList.add("is-ready");

      // buton disabled olsa bile DOM’dan kaldır
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

  // başka job çalıyorsa durdur
  if (currentJobId && currentJobId !== jobId){
    setCardPlaying(currentJobId, false);
    try { A.pause(); } catch {}
  }

  // aynı job çalıyorsa pause
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


  /* ---------------- ACTIONS (GERÇEK FONKSİYONLAR) ---------------- */

  function emitAction(act, jobId, extra){
    try{
      window.dispatchEvent(new CustomEvent("aivo:music:action", {
        detail: { act, job_id: jobId, ...extra }
      }));
    } catch {}
  }

  function actionDownload(card){
    const src = card?.dataset?.src || "";
    if (!src) { toast("error","İndirilecek dosya yok"); return; }
    // gerçek download
    const a = document.createElement("a");
    a.href = src;
    a.download = "";          // browser izin verirse indirir
    a.target = "_blank";      // olmazsa yeni sekmede açılır
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
    emitAction("delete", jobId, {});
  }

  function actionStems(card){
    const jobId = card?.getAttribute("data-job-id") || "";
    if (!jobId) return;
    toast("info","Stems: event gönderildi");
    emitAction("stems", jobId, {});
    // İstersen burada endpoint'e bağla:
    // fetch(`/api/music/stems?job_id=${encodeURIComponent(jobId)}`,{method:"POST",credentials:"include"})
  }

  function actionExtend(card){
    const jobId = card?.getAttribute("data-job-id") || "";
    if (!jobId) return;
    toast("info","Extend: event gönderildi");
    emitAction("extend", jobId, {});
    // Endpoint örneği:
    // fetch(`/api/music/extend`, {method:"POST",headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({job_id:jobId})})
  }

  function actionRevise(card){
    const jobId = card?.getAttribute("data-job-id") || "";
    if (!jobId) return;
    toast("info","Revise: event gönderildi");
    emitAction("revise", jobId, {});
    // Endpoint örneği:
    // fetch(`/api/music/revise`, {method:"POST",headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({job_id:jobId})})
  }

  function onCardClick(e){
    const btn  = e.target.closest("[data-action]");
    const card = e.target.closest(".aivo-player-card");
    if (!card) return;

    const act = btn?.dataset?.action || null;

    if (act){
      e.preventDefault();
      e.stopPropagation();

      if (act === "toggle-play") return togglePlayFromCard(card);

      // ✅ gerçek fonksiyonlar
      if (act === "download") return actionDownload(card);
      if (act === "delete")   return actionDelete(card);
      if (act === "stems")    return actionStems(card);
      if (act === "extend")   return actionExtend(card);
      if (act === "revise")   return actionRevise(card);

      // bilinmeyen action
      const jobId = card.getAttribute("data-job-id");
      console.log("[panel.music] unknown action:", act, "job:", jobId);
      toast("info", `Action: ${act}`);
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
/* ---------------- polling ---------------- */

// ✅ kart/job bazlı throttle + busy (2 kart birbirini bloklamasın)
const POLL_BUSY = new Set();   // key: providerId (örn: "1334977::orig")
const POLL_LAST = new Map();   // key: providerId -> timestamp(ms)

async function poll(jobId) {
  if (!alive || !jobId) return;

  const providerId = String(jobId);           // kart id: 1334977::orig / 1334977::rev1
  const providerBase = providerId.split("::")[0];

  // 1) aynı karta paralel bindirme (spam kesilir)
  if (POLL_BUSY.has(providerId)) return;

// 2) aynı karta 1.5sn’den sık vurma (spam kesilir)
const now = Date.now();
const last = POLL_LAST.get(providerId) || 0;
if (now - last < 1500) return;
POLL_LAST.set(providerId, now);

POLL_BUSY.add(providerId);

const existing = jobs.find(x => (x.job_id || x.id) === providerId) || {};
const knownReal = existing.__real_job_id || null;

// Bu kart hangi provider_song_id'ye aitse onu poll et (orig/rev ayrılır)
async function fetchStatus() {
  const songIdForThisCard = String(existing.__provider_song_id || providerBase);
  const q = encodeURIComponent(songIdForThisCard);

  const r = await fetch(`/api/music/status?provider_job_id=${q}`, {
    cache: "no-store",
    credentials: "include",
  });

  let j = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }

  return { ok: r.ok, json: j };
}
  try {
    clearPoll(providerId);

    // 1) önce (real varsa onu, yoksa providerBase) — fetchStatus zaten providerBase kullanıyor
    const firstId = knownReal || providerBase;
 let { ok, json: j } = await fetchStatus();

    if (!ok || !j) {
      schedulePoll(providerId, 1500);
      return;
    }

    // Backend bazen proxy_error döndürüyor, onu da “retry” say
    if (j.ok === false && (j.error === "proxy_error" || j.error === "worker_non_json")) {
      schedulePoll(providerId, 2000);
      return;
    }

    // 2) internal_job_id yakala (varsa)
    const internalJobId =
      j?.internal_job_id ||
      j?.job?.internal_job_id ||
      j?.data?.internal_job_id ||
      j?.result?.internal_job_id ||
      null;

    // İlk response’ta audio yoksa ve internal_job_id varsa -> 2. hop
    const firstHasAudio = !!(
      j?.audio?.src ||
      j?.audio_src ||
      j?.result?.audio?.src ||
      j?.result?.src ||
      j?.job?.audio?.src
    );

    if (internalJobId && !firstHasAudio) {
      const second = await fetchStatus(internalJobId);
      if (second.ok && second.json) j = second.json;
    }

    const job = j.job || {};

    // “real job id” olarak internal id’yi sakla
    const realJobId =
      j?.internal_job_id ||
      job?.internal_job_id ||
      job?.job_id ||
      j?.job_id ||
      null;

    if (realJobId && existing.__real_job_id !== realJobId) {
      upsertJob({ job_id: providerId, id: providerId, __real_job_id: realJobId });
    }

    // kart kimliği sabit
    job.job_id = providerId;
    job.id = providerId;

    // src/output yakala
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

    // playUrl sadece outputId varsa
    const playUrl = (realJobId && outputId)
      ? `/files/play?job_id=${encodeURIComponent(realJobId)}&output_id=${encodeURIComponent(outputId)}`
      : "";

    job.__audio_src = src || playUrl || "";
    job.output_id = outputId || job.output_id || "";

  // state (iki kart birlikte unlock)
let state = uiState(j.state || j.status || job.status);

// mp3 geldiyse bunu "pending" olarak işaretle, ama hemen ready yapma
if (job.__audio_src) {
  // 🎧 mp3 düştü → hemen preview oynatılabilir olsun
  job.__ui_state = "ready";
  job.__pending_ready = false;
} else {
  job.__ui_state = state;
  job.__pending_ready = false;
}

// Eğer bu base'in (133xxxx) iki varyantında da mp3 varsa: ikisini birden ready yap
try {
const base = String(jobId).split("::")[0];
  const aId = `${base}::orig`;
  const bId = `${base}::rev1`;

  const a = jobs.find(x => (x.job_id || x.id) === aId);
  const b = jobs.find(x => (x.job_id || x.id) === bId);

  const bothHaveAudio = !!(a?.__audio_src) && !!(b?.__audio_src);

  if (bothHaveAudio) {
    upsertJob({ job_id: aId, id: aId, __ui_state: "ready", __pending_ready: false });
    upsertJob({ job_id: bId, id: bId, __ui_state: "ready", __pending_ready: false });

    // mevcut job objesini de ready'ye çek
    job.__ui_state = "ready";
    job.__pending_ready = false;
  }
} catch {}

    job.title = job.title || j?.title || "Müzik Üretimi";
    if (j?.duration) job.__duration = j.duration;
    if (j?.created_at) job.__createdAt = j.created_at;

    upsertJob(job);
    render();

   // auto-play sadece ORIGINAL ve ilk kez
// if (
//   job.__ui_state === "ready" &&
//   String(job.job_id || "").endsWith("::orig") &&
//   !job.__auto_played
// ) {
//   job.__auto_played = true;
//   setTimeout(() => {
//     const card = getCard(job.job_id);
//     if (card) togglePlayFromCard(card);
//   }, 300);
// }

if (job.__ui_state === "ready") return;
if (job.__ui_state === "error") return;

schedulePoll(providerId, 1500);

} catch (e) {
  schedulePoll(providerId, 2000);
} finally {
  POLL_BUSY.delete(providerId);
}
}
/* ---------------- onJob ---------------- */
function onJob(e){
  const payload = e?.detail || e || {};
  const baseId = payload.job_id || payload.id;
  if (!baseId) return;

  // tek job -> 2 kart
  const origId = `${baseId}::orig`;
  const revId  = `${baseId}::rev1`;

  // 🔥 güvenli song id çıkarımı
  const providerJobId = String(payload.provider_job_id || "").trim();
  const rawSongIds = Array.isArray(payload.provider_song_ids)
    ? payload.provider_song_ids
    : [];

  // fallback mantığı:
  // - 2 id varsa kullan
  // - 1 id varsa ikisine de yaz (çökmesin diye)
  // - hiç yoksa provider_job_id kullan
  const songIdOrig =
    String(rawSongIds[0] || providerJobId || "").trim();

  const songIdRev =
    String(
      rawSongIds[1] ||
      rawSongIds[0] ||   // tek id gelirse çökmesin
      providerJobId ||
      ""
    ).trim();

  const common = {
    type: payload.type || "music",
    subtitle: payload.subtitle || "",
    __ui_state: payload.__ui_state || "processing",
    __audio_src: payload.__audio_src || "",
    __real_job_id: payload.__real_job_id || null,
    provider_job_id: providerJobId,
  };

  // ORIGINAL
  upsertJob({
    ...common,
    job_id: origId,
    id: origId,
    __provider_song_id: songIdOrig,
    title: (payload.title || "Müzik Üretimi") + " — Original Version",
  });

  // REVIZE
  upsertJob({
    ...common,
    job_id: revId,
    id: revId,
    __provider_song_id: songIdRev,
    title: (payload.title || "Müzik Üretimi") + " — Revize Version",
  });

  render();

  // poll başlat (iki kart ayrı ayrı)
  poll(origId);
  poll(revId);
}
/* ---------------- panel integration ---------------- */

// ✅ Cover'daki gibi: RightPanel gelmeden register deneme
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

let __searchQ = "";

// ✅ Manager search buraya düşecek
function onSearch(q){
  __searchQ = String(q || "").trim().toLowerCase();
  applyMusicSearchFilter();
}

// ✅ artık manager search’i kullanacağız
function applyMusicSearchFilter(){
  const q = (__searchQ || "").trim();
  const cards = (listEl || document).querySelectorAll(".aivo-player-card");
  cards.forEach(card => {
    const text = (card.textContent || "").toLowerCase();
    card.style.display = (!q || text.includes(q)) ? "" : "none";
  });
}

// ✅ Header/search tamamen manager’dan
function getHeader(){
  return {
   title: "Müziklerim",
    meta: "",
    searchPlaceholder: "Müziklerde ara...",
    searchEnabled: true,
    resetSearch: false
  };
}

function mount(contentEl){
  // 🔥 Manager’ın content alanı burası: #rightPanelHost’a dokunma
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

  // ✅ music panelde global mainAudio bar'ı kapat (PPE/player.js)
  const mainAudio = document.getElementById("mainAudio");
  if (mainAudio) {
    try { mainAudio.pause?.(); } catch {}
    mainAudio.removeAttribute("src");
    try { mainAudio.load?.(); } catch {}
    mainAudio.style.display = "none";
  }

  render();
  applyMusicSearchFilter();

  jobs.slice(0, 50).forEach(j => (j?.job_id || j?.id) && poll(j.job_id || j.id));
  window.addEventListener("aivo:job", onJob, true);

  console.log("[panel.music] mounted OK (manager search + onSearch)");

  // ✅ manager unmount zinciri: mount return function olmalı
  return () => destroy();
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
  window.RightPanel.register(PANEL_KEY, { getHeader, mount, destroy, onSearch });
}

// ✅ RightPanel hazır olunca register et
waitForRightPanel(register);
  /* =========================================================
     EXTRA: "Müzik Üret"e 1 kez basınca 2 job başlat (2 kart)
     - studio.music.generate.js yoksa bile çalışsın diye burada köprü var.
     - Eğer zaten başka script bu butonu yönetiyorsa double-call olmasın diye
       btn.__aivoGen2xBound guard var.
     ========================================================= */
  (function bindGenerate2xBridge(){
    const BTN_SEL = "#musicGenerateBtn, [data-action='music-generate'], .music-generate-btn";
    const API_GENERATE = "/api/music/generate";
    const COUNT = 2;

    function extractJobId(resp){
      return (
        resp?.job_id ||
        resp?.id ||
        resp?.job?.job_id ||
        resp?.job?.id ||
        resp?.data?.job_id ||
        resp?.data?.id ||
        resp?.provider_job_id ||
        null
      );
    }

    async function postGenerate(payload){
      const r = await fetch(API_GENERATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      let j = null;
      try { j = await r.json(); } catch { j = null; }

      if (!r.ok || !j || j.ok === false){
        const msg = j?.error || j?.message || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      return j;
    }

    function buildPayloadBestEffort(){
      // Studio form alanları sende farklıysa bu sadece fallback.
      const title =
        qs("#musicTitle")?.value ||
        qs("input[name='title']")?.value ||
        qs("#songTitle")?.value ||
        "Müzik Üretimi";

      const lyrics =
        qs("#musicLyrics")?.value ||
        qs("textarea[name='lyrics']")?.value ||
        qs("#songLyrics")?.value ||
        "";

      const prompt =
        qs("#musicPrompt")?.value ||
        qs("textarea[name='prompt']")?.value ||
        qs("#songPrompt")?.value ||
        "";

      const mode =
        qs("[name='mode']:checked")?.value ||
        qs("#modeSelect")?.value ||
        qs("select[name='mode']")?.value ||
        "basic";

      const lang =
        qs("#langSelect")?.value ||
        qs("select[name='lang']")?.value ||
        qs("select[name='language']")?.value ||
        "tr";

      return {
        title: String(title || "Müzik Üretimi").trim(),
        lyrics: String(lyrics || "").trim(),
        prompt: String(prompt || "").trim(),
        mode: String(mode || "basic").trim(),
        lang: String(lang || "tr").trim(),
      };
    }

    async function generateOne(payload, idx, total){
      // Placeholder kart (anında 2 kart görünsün)
      const tempId = uid(`music_${idx}`);
      window.dispatchEvent(new CustomEvent("aivo:job", { detail: {
        job_id: tempId,
        id: tempId,
        type: "music",
        title: `${payload.title} (${idx}/${total})`,
        subtitle: payload.prompt ? String(payload.prompt).slice(0,80) : "",
        __ui_state: "processing",
        __audio_src: ""
      }}));

      const resp = await postGenerate(payload);
      const realId = extractJobId(resp);

      if (!realId){
        console.warn("[generate2x] missing job_id:", resp);
        toast("error","Backend job_id döndürmedi (poll başlayamaz)");
        return;
      }

      window.dispatchEvent(new CustomEvent("aivo:job", { detail: {
        job_id: realId,
        id: realId,
        type: "music",
        title: `${payload.title} (${idx}/${total})`,
        subtitle: payload.prompt ? String(payload.prompt).slice(0,80) : "",
        provider_job_id: resp?.provider_job_id || null,
      }}));
    }

    function bind(){
      const btn = qs(BTN_SEL);
      if (!btn) return;

      if (btn.__aivoGen2xBound) return;
      btn.__aivoGen2xBound = true;

      btn.addEventListener("click", async (e) => {
        // Eğer başka script de dinliyorsa, çift tetik olmasın diye:
        if (btn.dataset.__aivo2xBusy === "1") return;

        // Burada “tam kontrol” istiyorsun → varsayılan click’i kesiyoruz:
        // Eğer kesmek istemezsen şu iki satırı kaldır.
        e.preventDefault();
        e.stopPropagation();

        btn.dataset.__aivo2xBusy = "1";
        const prevDisabled = btn.disabled;
        btn.disabled = true;

        try{
         
          toast("info","2 adet müzik üretimi başlatılıyor…");

          const payload = buildPayloadBestEffort();
          const total = COUNT;

         await generateOne(payload, 1, total);
await generateOne(payload, 2, total);


          toast("success","2 üretim başlatıldı ✅");
        } catch(err){
          console.warn("[generate2x] failed:", err);
          toast("error", err?.message || "Müzik üretimi başarısız");
        } finally{
          btn.disabled = prevDisabled;
          btn.dataset.__aivo2xBusy = "0";
        }
      }, true);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
      bind();
    }
  })();

})();
