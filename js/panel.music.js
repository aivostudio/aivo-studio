/* =========================================================
   AIVO Right Panel — Music Panel (REAL)
   File: public/panel.music.js
   URL : /panel.music.js
   ========================================================= */

(function AIVO_PANEL_MUSIC() {
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL = "#rightPanelHost";
  const LS_KEY = "aivo.music.jobs.v1";

  let hostEl = null;
  let listEl = null;

  // Persisted state (reload’de kaybolmasın)
  let jobs = loadJobs();

  // ---------------------------------------------------------
  // Utils
  // ---------------------------------------------------------
  function qs(sel, root = document) { return root.querySelector(sel); }

  function ensureHost() {
    hostEl = qs(HOST_SEL);
    return hostEl;
  }

  function ensureList() {
    if (!hostEl) return null;
    listEl = hostEl.querySelector(".aivo-player-list");
    if (!listEl) {
      listEl = document.createElement("div");
      listEl.className = "aivo-player-list";
      listEl.id = "musicList";
      hostEl.appendChild(listEl);
    }
    return listEl;
  }

  function loadJobs() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  }

  function saveJobs(next) {
    try { localStorage.setItem(LS_KEY, JSON.stringify((next || []).slice(0, 50))); }
    catch {}
  }

  function upsertJob(job) {
    if (!job) return;
    const job_id = job.job_id || job.jobId || job.id;
    if (!job_id) return;

    const i = jobs.findIndex(j => (j.job_id || j.jobId || j.id) === job_id);
    if (i >= 0) jobs[i] = { ...jobs[i], ...job };
    else jobs.unshift(job);

    saveJobs(jobs);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(s) { return escapeHtml(s).replaceAll("\n", " "); }

  function pickSrc(job) {
    return (
      job?.output_url ||
      job?.play_url ||
      job?.src ||
      job?.url ||
      job?.output?.url ||
      job?.outputs?.[0]?.url ||
      job?.outputs?.[0]?.src ||
      ""
    );
  }

  function isReadyStatus(job) {
    const s = String(job?.status || "").toLowerCase();
    return ["ready", "completed", "done", "succeeded"].includes(s);
  }

  // ---------------------------------------------------------
  // Card template (player.js hooks uyumlu)
  // ---------------------------------------------------------
  function renderMusicCard(job) {
    const title = job?.title || job?.name || "Untitled";
    const sub = job?.sub || job?.genre || job?.lang || "—";
    const dur = job?.duration || job?.dur || "—:—";
    const dateText = job?.createdAtText || job?.created_at || "";
    const jobId = job?.job_id || job?.jobId || job?.id || "";
    const outputId = job?.output_id || job?.outputId || job?.output || "";

    const src = pickSrc(job);
    const ready = isReadyStatus(job) && !!src;

    return `
<div class="aivo-player-card ${ready ? "is-ready" : "is-loadingState"}"
     data-job-id="${escapeAttr(jobId)}"
     data-output-id="${escapeAttr(outputId)}"
     data-src="${escapeAttr(src)}">

  <div class="aivo-player-left">
    ${
      ready
        ? `<button class="aivo-player-btn"
                type="button"
                aria-label="Oynat"
                title="Oynat"
                data-action="toggle-play">
             <svg viewBox="0 0 24 24" fill="none">
               <path d="M8 5v14l11-7-11-7z" fill="currentColor"/>
             </svg>
           </button>`
        : `<div class="aivo-player-spinner" aria-label="Hazırlanıyor"></div>`
    }
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title" title="${escapeAttr(title)}">${escapeHtml(title)}</div>

      <div class="aivo-player-tags">
        ${
          ready
            ? `<span class="aivo-tag is-ready" title="Dinlemeye ve indirilmeye hazır">Hazır</span>`
            : `<span class="aivo-tag is-loading" title="Müzik oluşturuluyor, kısa süre içinde hazır olacak">Hazırlanıyor</span>`
        }
      </div>
    </div>

    <div class="aivo-player-sub" title="${escapeAttr(sub)}">${escapeHtml(sub)}</div>

    <div class="aivo-player-meta" title="Meta">
      <span>${escapeHtml(String(dur))}</span>
      <span class="aivo-player-dot"></span>
      <span>${escapeHtml(String(dateText))}</span>
    </div>

    <div class="aivo-player-controls">
      <div class="aivo-progress" title="Zamana Git">
        <i style="width:0%"></i>
      </div>
      <div style="min-width:54px; text-align:right; font-size:12px; opacity:.7;">
        <span data-bind="time">0:00</span>
      </div>
    </div>
  </div>

  <div class="aivo-player-actions">
    <button class="aivo-action is-blue"
            type="button"
            title="Dosyayı İndir"
            aria-label="Dosyayı İndir"
            data-action="download">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3v10m0 0 4-4m-4 4-4-4M5 15v4h14v-4"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <button class="aivo-action is-accent"
            type="button"
            title="Parçaları Ayır"
            aria-label="Parçaları Ayır"
            data-action="stem">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 5a4 4 0 0 0-4 4v1H7a3 3 0 0 0 0 6h1v1a4 4 0 0 0 8 0v-1h1a3 3 0 0 0 0-6h-1V9a4 4 0 0 0-4-4z"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <button class="aivo-action"
            type="button"
            title="Süreyi Uzat"
            aria-label="Süreyi Uzat"
            data-action="extend">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 6v6l4 2M21 12a9 9 0 1 1-3-6.7"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <button class="aivo-action"
            type="button"
            title="Yeniden Yorumla"
            aria-label="Yeniden Yorumla"
            data-action="remix">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 20h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <button class="aivo-action is-danger"
            type="button"
            title="Müziği Sil"
            aria-label="Müziği Sil"
            data-action="delete">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M10 11v7M14 11v7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 7V4h6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</div>`;
  }

  // ---------------------------------------------------------
  // Render (son 2 işi göster)
  // ---------------------------------------------------------
  function render() {
    if (!ensureHost()) return;
    if (!ensureList()) return;

    // newest (jobs[0]) üstte olsun:
    const newestFirst = (jobs || []).slice(0, 2);

    const slot1 = newestFirst[0] || { title: "Player 1", sub: "Henüz output yok", status: "loading" };
    const slot2 = newestFirst[1] || { title: "Player 2", sub: "Henüz output yok", status: "loading" };

    listEl.innerHTML = [renderMusicCard(slot1), renderMusicCard(slot2)].join("\n");
  }
// =========================================================
// AIVO MUSIC — READY → REAL PLAYER BRIDGE (TEK GERÇEK YOL)
// =========================================================
(function AIVO_MUSIC_READY_TO_PLAYER(){
  if (window.__AIVO_MUSIC_READY_BRIDGE__) return;
  window.__AIVO_MUSIC_READY_BRIDGE__ = true;

  function pickSrc(job){
    if (!job) return "";
    return (
      job.play_url ||
      job.playUrl ||
      job.audio_url ||
      job.audioUrl ||
      job.url ||
      (Array.isArray(job.outputs) &&
        job.outputs[0] &&
        (job.outputs[0].play_url ||
         job.outputs[0].audio_url ||
         job.outputs[0].url)) ||
      ""
    );
  }

  // panel.music zaten job event basıyor → biz sadece READY olanı dinliyoruz
  document.addEventListener("aivo:job-updated", function (e) {
    const job = e.detail;
    if (!job || job.type !== "music") return;

    const status = String(job.status || "").toLowerCase();
    if (!["ready", "done", "completed", "success", "finished"].includes(status)) return;

    const src = pickSrc(job);
    if (!src) return;

    // ✅ GERÇEK PLAYER
    if (window.AIVO_PLAYER && typeof window.AIVO_PLAYER.load === "function") {
      window.AIVO_PLAYER.load({
        src,
        title: job.title || "Üretilen Müzik"
      });
      window.AIVO_PLAYER.play();
    }

    // ✅ PANEL KARTI (varsa)
    const card = document.querySelector(
      `.aivo-player-card[data-job-id="${job.job_id}"], 
       .music-item[data-job-id="${job.job_id}"]`
    );

    if (card) {
      card.dataset.src = src;
      card.classList.remove("is-loading", "processing");
      card.classList.add("is-ready");
    }
  });
})();

  // ---------------------------------------------------------
  // Poll + hydrate
  // ---------------------------------------------------------
  async function pollJob(job_id) {
    try {
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok || !j.job) return;

      const job = j.job;
      upsertJob(job);
      render();

      const src = pickSrc(job);
      if (isReadyStatus(job) && src) {
        // kartın data-src’si zaten render’da basılıyor; gene de garanti:
        const card = document.querySelector(`.aivo-player-card[data-job-id="${job_id}"]`);
        if (card) {
          card.classList.remove("is-loadingState");
          card.classList.add("is-ready");
          card.dataset.src = src;
          const sp = card.querySelector(".aivo-player-spinner");
          if (sp) sp.remove();
        }

        // gerçek player hydrate
        if (window.AIVO_PLAYER && typeof window.AIVO_PLAYER.add === "function") {
          window.AIVO_PLAYER.add({
            id: job_id,
            src,
            title: job.title || job.name || "Yeni Müzik",
            meta: job,
          });
        }
        return;
      }

      setTimeout(() => pollJob(job_id), 1500);
    } catch (e) {
      console.warn("[panel.music] poll error", e);
      setTimeout(() => pollJob(job_id), 2000);
    }
  }

  // ---------------------------------------------------------
  // RightPanel integration
  // ---------------------------------------------------------
  function mount() {
    if (!ensureHost()) return;

    // skeleton + list container
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Player</div>
          <div class="rp-body">Müzikler hazırlanıyor…</div>
        </div>
      </div>
    `;

    ensureList();
    render();

    // reload sonrası: mevcut job’ları poll et
    (jobs || []).forEach(j => {
      const id = j.job_id || j.jobId || j.id;
      if (id) pollJob(id);
    });

    // yeni job eventlerini yakala
    window.addEventListener("aivo:job", onJobEvent);
  }

  function destroy() {
    window.removeEventListener("aivo:job", onJobEvent);
  }

  function onJobEvent(e) {
    const job = e?.detail || e;
    if (!job) return;

    // type geliyorsa music filtrele
    if (job.type && String(job.type) !== "music") return;

    upsertJob(job);
    render();

    const id = job.job_id || job.jobId || job.id;
    if (id) pollJob(id);
  }

  function registerToManager() {
    const RP = window.RightPanel;
    if (!RP || typeof RP.register !== "function") return false;
    RP.register(PANEL_KEY, { mount, destroy });
    return true;
  }

  // Public debug helper
  window.AIVO_MUSIC_PANEL = {
    getJobs() { return jobs.slice(); },
    clear() { jobs = []; saveJobs([]); render(); },
    poll(job_id) { pollJob(job_id); },
  };

  // Register now or retry
  if (!registerToManager()) {
    window.addEventListener("DOMContentLoaded", () => registerToManager());
  }
})();
