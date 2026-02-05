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

  // Backend yeni contract: { ok, job_id, status, audio:{src}, job }
  function contractStatusToCard(status) {
    const s = String(status || "").toLowerCase();
    if (["ready"].includes(s)) return "ready";
    if (["error", "failed", "fail"].includes(s)) return "error";
    return "processing";
  }

  // ---------------------------------------------------------
  // Card template (player.js hooks uyumlu)
  //  - player.js şunlara bakıyor:
  //    .aivo-player-card + data-src + data-action="toggle-play"
  // ---------------------------------------------------------
  function renderMusicCard(job) {
    const title = job?.title || job?.name || "Untitled";
    const sub = job?.sub || job?.genre || job?.lang || "—";
    const dur = job?.duration || job?.dur || "—:—";
    const dateText = job?.createdAtText || job?.created_at || "";
    const jobId = job?.job_id || job?.jobId || job?.id || "";
    const outputId = job?.output_id || job?.outputId || job?.output || "";

    const src = job?.__audio_src || "";      // ✅ tek gerçek src alanımız (panel içinde tutuluyor)
    const state = job?.__ui_state || "processing";

    const ready = state === "ready" && !!src;
    const errored = state === "error";

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
                data-action="toggle-play"></button>`
        : errored
          ? `<div class="aivo-player-spinner" aria-label="Hata">!</div>`
          : `<div class="aivo-player-spinner" aria-label="Hazırlanıyor"></div>`
    }
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title" title="${escapeAttr(title)}">${escapeHtml(title)}</div>

      <div class="aivo-player-tags">
        ${
          ready
            ? `<span class="aivo-tag is-ready" title="Dinlemeye hazır">Hazır</span>`
            : errored
              ? `<span class="aivo-tag is-danger" title="Servis hatası">Hata</span>`
              : `<span class="aivo-tag is-loading" title="Müzik oluşturuluyor">Hazırlanıyor</span>`
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
      <div class="aivo-progress" title="Zamana Git"><i style="width:0%"></i></div>
      <div style="min-width:54px; text-align:right; font-size:12px; opacity:.7;">
        <span data-bind="time">0:00</span>
      </div>
    </div>
  </div>

  <div class="aivo-player-actions">
    <button class="aivo-action is-blue" type="button" title="Dosyayı İndir" aria-label="Dosyayı İndir" data-action="download"></button>
    <button class="aivo-action is-accent" type="button" title="Parçaları Ayır" aria-label="Parçaları Ayır" data-action="stem"></button>
    <button class="aivo-action" type="button" title="Süreyi Uzat" aria-label="Süreyi Uzat" data-action="extend"></button>
    <button class="aivo-action" type="button" title="Yeniden Yorumla" aria-label="Yeniden Yorumla" data-action="remix"></button>
    <button class="aivo-action is-danger" type="button" title="Müziği Sil" aria-label="Müziği Sil" data-action="delete"></button>
  </div>
</div>`;
  }

  // ---------------------------------------------------------
  // Render (son 2 işi göster)
  // ---------------------------------------------------------
  function render() {
    if (!ensureHost()) return;
    if (!ensureList()) return;

    const newestFirst = (jobs || []).slice(0, 2);

    const slot1 = newestFirst[0] || { title: "Player 1", sub: "Henüz output yok", __ui_state: "processing" };
    const slot2 = newestFirst[1] || { title: "Player 2", sub: "Henüz output yok", __ui_state: "processing" };

    listEl.innerHTML = [renderMusicCard(slot1), renderMusicCard(slot2)].join("\n");
  }

  // ---------------------------------------------------------
  // Poll: tek gerçek sözleşme = /api/jobs/status -> audio.src
  // ---------------------------------------------------------
  async function pollJob(job_id) {
    try {
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) {
        setTimeout(() => pollJob(job_id), 1500);
        return;
      }

      const job = j.job || {};
      // ✅ normalize contract alanları
      const uiState = contractStatusToCard(j.status || job.status);
      const src = (j.audio && j.audio.src) ? String(j.audio.src) : "";

      // job’u kaydet + UI state’i job üstüne iliştir
      job.job_id = job.job_id || job.id || job.jobId || job_id;
      job.__ui_state = uiState;
      job.__audio_src = src;

      upsertJob(job);
      render();

      // ✅ Ready + src varsa: player otomatik “kart + data-src” üzerinden çalışır.
      // Burada ekstra AIVO_PLAYER API çağırmıyoruz.
      if (uiState === "ready" && src) return;

      // error ise de dur (kart üstünde Hata gözüksün)
      if (uiState === "error") return;

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

    // Panel chrome
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Müzik</div>
          <div class="rp-body">Üretilenler burada görünür.</div>
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
    console.log("[panel.music] mounted");
  }

  function destroy() {
    window.removeEventListener("aivo:job", onJobEvent);
  }

  function onJobEvent(e) {
    const job = e?.detail || e;
    if (!job) return;

    // type geliyorsa music filtrele
    if (job.type && String(job.type) !== "music") return;

    // hemen “processing” olarak listeye ekle (kart çıksın)
    const id = job.job_id || job.jobId || job.id;
    const next = { ...job, job_id: id, __ui_state: "processing", __audio_src: "" };
    upsertJob(next);
    render();

    if (id) pollJob(id);
  }

  function registerToManager() {
    const RP = window.RightPanel;
    if (!RP || typeof RP.register !== "function") return false;
    RP.register(PANEL_KEY, { mount, destroy });
    return true;
  }

  // Debug helper
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
