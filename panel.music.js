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

  const title = job.title || "Müzik Üretimi";
  const sub   = job.subtitle || "";
  const lang  = job.lang || "Türkçe";
  const dur   = job.duration || job.__duration || "";
  const date  = job.created_at || job.createdAt || job.__createdAt || "";

  const tagReady = `<span class="aivo-tag is-ready">Hazır</span>`;
  const tagProc  = `<span class="aivo-tag is-loading">Hazırlanıyor</span>`;
  const tagErr   = `<span class="aivo-tag is-error">Hata</span>`;

  // ✅ state'e bakma: src varsa hazır say
  const isReady = !!job.__audio_src;

  const leftBtn = `
    <button class="aivo-player-btn"
      data-action="toggle-play"
      aria-label="Oynat/Durdur"
      title="Oynat/Durdur"
      ${isReady ? "" : "disabled"}
      style="${isReady ? "" : "opacity:.45; cursor:not-allowed;"}">
      <svg class="icon-play" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 5v14l11-7-11-7z" fill="currentColor"></path>
      </svg>
      <svg class="icon-pause" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:none">
        <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"></path>
      </svg>
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
<div class="aivo-player-card ${isReady ? "is-ready" : st === "error" ? "is-error" : "is-loading"}"
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
  // 🚫 Music panel aktif değilse ASLA DOM'a dokunma
  if (window.RightPanel?.getCurrentKey?.() !== "music") return;

  if (!ensureHost() || !ensureList()) return;

  const view = jobs.filter(j => j?.job_id || j?.id);

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

let pollBusy = false;
let lastPollAt = 0;

async function poll(jobId) {
  if (!alive || !jobId) return;

  // 1) aynı anda üst üste bindirme (spam kesilir)
  if (pollBusy) return;

  // 2) 1.5sn’den sık vurma (spam kesilir)
  const now = Date.now();
  if (now - lastPollAt < 1500) return;
  lastPollAt = now;

  pollBusy = true;

  const providerId = String(jobId);           // kart id: prov_xxx::orig
  const providerBase = providerId.split("::")[0];

  const existing = jobs.find(x => (x.job_id || x.id) === providerId) || {};
  const knownReal = existing.__real_job_id || null;

  // Her zaman provider_job_id ile çağırıyoruz.
  async function fetchStatus(id) {
    const q = encodeURIComponent(String(id).startsWith("job_") ? providerBase : String(id));
    const r = await fetch(`/api/music/status?provider_job_id=${q}`, {
      cache: "no-store",
      credentials: "include",
    });
    let j = null;
    try { j = await r.json(); } catch { j = null; }
    return { ok: r.ok, json: j };
  }

  try {
    clearPoll(providerId);

    // 1) önce (real varsa onu, yoksa providerBase)
    const firstId = knownReal || providerBase;
    let { ok, json: j } = await fetchStatus(firstId);

    if (!ok || !j) {
      schedulePoll(providerId, 1500);
      return;
    }

    // Backend bazen proxy_error döndürüyor, onu da “retry” say
    if (j.ok === false && (j.error === "proxy_error" || j.error === "worker_non_json")) {
      schedulePoll(providerId, 2000);
      return;
    }

    // 2) internal_job_id yakala (senin response’ta var)
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

    // state
    let state = uiState(j.state || j.status || job.status);
    if (job.__audio_src) state = "ready";
    job.__ui_state = state;

    job.title = job.title || j?.title || "Müzik Üretimi";
    if (j?.duration) job.__duration = j.duration;
    if (j?.created_at) job.__createdAt = j.created_at;

    upsertJob(job);
    render();

    // PPE bridge
    if (window.PPE && job.__audio_src) {
      PPE.apply({
        state: "COMPLETED",
        outputs: [{ type: "audio", url: job.__audio_src, meta: { app: "music" } }]
      });
    }

    // auto-play sadece ORIGINAL ve ilk kez
    if (
      job.__ui_state === "ready" &&
      String(job.job_id || "").endsWith("::orig") &&
      !job.__auto_played
    ) {
      job.__auto_played = true;
      setTimeout(() => {
        const card = getCard(job.job_id);
        if (card) togglePlayFromCard(card);
      }, 300);
    }

    if (job.__ui_state === "ready") return;
    if (job.__ui_state === "error") return;

    schedulePoll(providerId, 1500);

  } catch (e) {
    schedulePoll(providerId, 2000);
  } finally {
    pollBusy = false;
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

  const common = {
    type: payload.type || "music",
    subtitle: payload.subtitle || "",
    __ui_state: payload.__ui_state || "processing",
    __audio_src: payload.__audio_src || "",
    __real_job_id: payload.__real_job_id || null,
    provider_job_id: payload.provider_job_id || null,
  };

  upsertJob({
    ...common,
    job_id: origId,
    id: origId,
    title: (payload.title || "Müzik Üretimi") + " — Original Version",
  });

  upsertJob({
    ...common,
    job_id: revId,
    id: revId,
    title: (payload.title || "Müzik Üretimi") + " — Revize Version",
  });

  render();

  // poll başlat
  poll(origId);
  poll(revId);
}


  /* ---------------- panel integration ---------------- */
  function mount(){
    if (!ensureHost()) return;

    // ✅ idempotent: eğer shell zaten varsa reset atma
    const already = hostEl.querySelector("#musicList");
    if (!already){
      hostEl.innerHTML = `
        <div class="rp-players">
          <div class="rp-playerCard">
            <div class="rp-title">Üretilenler</div>
            <div class="rp-body" id="musicList"></div>
          </div>
        </div>
      `;
    }

    listEl = hostEl.querySelector("#musicList");
    listEl.className = "aivo-player-list";

    // bind events (tek sefer)
    if (!hostEl.__musicBound){
      hostEl.__musicBound = true;
      hostEl.addEventListener("click", onCardClick, true);
      hostEl.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".aivo-progress")) onProgressSeek(e);
      }, true);
    }

    ensureAudio();
    render();

    jobs.slice(0, 50).forEach(j => (j?.job_id || j?.id) && poll(j.job_id || j.id));

    window.addEventListener("aivo:job", onJob, true);

    console.log("[panel.music] mounted OK (custom player + actions + 2x generate bridge)");
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
// --- DB LIST (music) bootstrap + render ---
(function bootMusicDbList() {
  const state = { timer: null, items: [] };

  function ensureHost() {
    // Önce right panel içinde makul bir yer arayalım
    const candidates = [
      document.querySelector("#rightPanelHost"),
      document.querySelector("#right-panel"),
      document.querySelector(".right-panel"),
      document.querySelector(".rightCard"),
      document.querySelector("#moduleHost"),
      document.body
    ].filter(Boolean);

    const root = candidates[0];

    let host = root.querySelector?.("#musicDbListHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "musicDbListHost";
      host.style.cssText = "margin-top:12px;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;";
      root.appendChild(host);
    }
    return host;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
  }

  function pickAudioUrl(job) {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    const a = outs.find(o => o?.type === "audio" && o?.url) || outs.find(o => o?.url && String(o?.url).match(/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i));
    return a?.url || null;
  }

  function badge(job) {
    const s = job?.state || job?.status || "PENDING";
    const t = String(s).toUpperCase();
    const map = {
      COMPLETED: "✅ Hazır",
      READY: "✅ Hazır",
      RUNNING: "⏳ İşleniyor",
      PROCESSING: "⏳ İşleniyor",
      PENDING: "🕓 Bekliyor",
      QUEUED: "🕓 Bekliyor",
      FAILED: "❌ Hata",
      ERROR: "❌ Hata"
    };
    return map[t] || `🕓 ${t}`;
  }

  function render() {
    const host = ensureHost();
    const items = state.items || [];

    const html = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-weight:700;">Müzik Üretilenler</div>
        <button id="musicDbRefreshBtn" style="border:1px solid rgba(255,255,255,.18);background:transparent;color:inherit;border-radius:10px;padding:6px 10px;cursor:pointer;">
          Yenile
        </button>
      </div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">
        ${
          items.length === 0
            ? `<div style="opacity:.75;">Henüz kayıt yok.</div>`
            : items.map(j => {
                const title = j?.meta?.prompt || j?.prompt || "(prompt yok)";
                const b = badge(j);
                const audioUrl = pickAudioUrl(j);
                const created = j?.created_at ? new Date(j.created_at).toLocaleString() : "";
                const err = j?.error ? `<div style="margin-top:6px;opacity:.85;color:#ffb4b4;">${esc(j.error)}</div>` : "";

                return `
                  <div style="padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:12px;">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                      <div style="font-weight:650;line-height:1.25;">${esc(title)}</div>
                      <div style="white-space:nowrap;opacity:.9;">${esc(b)}</div>
                    </div>
                    <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;opacity:.75;">
                      <div style="font-size:12px;">${esc(created)}</div>
                      <div style="font-size:12px;">${esc(j?.job_id || "")}</div>
                    </div>
                    ${
                      audioUrl
                        ? `<div style="margin-top:10px;display:flex;gap:8px;">
                             <a href="${esc(audioUrl)}" target="_blank" rel="noopener" style="text-decoration:none;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 10px;display:inline-block;">
                               ▶︎ Dinle
                             </a>
                           </div>`
                        : ""
                    }
                    ${err}
                  </div>
                `;
              }).join("")
        }
      </div>
    `;

    host.innerHTML = html;

    const btn = host.querySelector("#musicDbRefreshBtn");
    if (btn) btn.addEventListener("click", () => fetchList(true), { once: true });
  }

  async function fetchList(force) {
    try {
      const url = "/api/jobs/list?app=music" + (force ? `&_=${Date.now()}` : "");
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json();
      console.log("[music:list]", j);

      state.items = Array.isArray(j?.items) ? j.items : [];
      render();
    } catch (e) {
      console.warn("[music:list] failed", e);
    }
  }

  // İlk yükleme + 5sn poll (işler pending ise)
  fetchList(false);
  state.timer = setInterval(() => {
    // pending/running varsa poll, yoksa boşuna spamleme
    const hasActive = (state.items || []).some(x => {
      const t = String(x?.state || x?.status || "").toUpperCase();
      return t === "PENDING" || t === "QUEUED" || t === "RUNNING" || t === "PROCESSING";
    });
    if (hasActive) fetchList(false);
  }, 5000);
})();

