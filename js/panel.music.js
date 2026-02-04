/* =========================================================
   AIVO Right Panel — Music Panel
   File (repo): public/panel.music.js
   URL (browser): /panel.music.js
   ========================================================= */

(function AIVO_PANEL_MUSIC() {
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL = "#rightPanelHost";

  let hostEl = null;
  let listEl = null;

  // In-memory state (panel owns it)
  let jobs = [];

  function qs(sel, root = document) { return root.querySelector(sel); }

  function ensureHost() {
    hostEl = qs(HOST_SEL);
    return hostEl;
  }

 function ensureList() {
  if (!hostEl) return null;
  // tek list container
  listEl = hostEl.querySelector(".aivo-player-list");
  if (!listEl) {
    listEl = document.createElement("div");
    listEl.className = "aivo-player-list";
    listEl.id = "musicList";
    // ❌ hostEl.innerHTML = "";  ← BUNU KALDIRDIK
    hostEl.appendChild(listEl);
  }
  return listEl;
}


  // ---------------------------------------------------------
  // ✅ BİREBİR KART TEMPLATE (player.js'in beklediği hooks):
  // - data-action="toggle-play"
  // - data-bind="time"
  // - .aivo-progress i
  // - data-src / data-job-id / data-output-id
  // ---------------------------------------------------------
  function renderMusicCard(job) {
    const title = job?.title || job?.name || "Untitled";
    const sub = job?.sub || job?.genre || job?.lang || "—";
    const dur = job?.duration || job?.dur || "—:—";
    const dateText = job?.createdAtText || job?.created_at || "";
    const jobId = job?.job_id || job?.jobId || job?.id || "";
    const outputId = job?.output_id || job?.outputId || job?.output || "";
    const src = job?.src || job?.play_url || job?.url || "";

    const isReady = !!src && !(job?.status && job.status !== "ready");
    const isLoading = !isReady;

    return `
<div class="aivo-player-card ${isReady ? "is-ready" : "is-loadingState"}"
     data-job-id="${escapeAttr(jobId)}"
     data-output-id="${escapeAttr(outputId)}"
     data-src="${escapeAttr(src)}">

  <div class="aivo-player-left">
    ${
      isReady
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
          isReady
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

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
function escapeAttr(s) { return escapeHtml(s).replaceAll("\n", " "); }

function render() {
  if (!ensureHost()) return;
  if (!ensureList()) return;

  console.log("[PANEL_MUSIC] render()", {
    jobsLen: (jobs || []).length,
    host: !!hostEl,
    list: !!listEl,
    htmlBefore: (listEl && listEl.innerHTML) ? listEl.innerHTML.slice(0, 80) : null
  });

  // ✅ her zaman 2 slot bas: (1) newest, (2) second newest
  const newestFirst = (jobs || []).slice().reverse();

  const slot1 = newestFirst[0] || { title: "Player 1", sub: "Henüz output yok", status: "loading" };
  const slot2 = newestFirst[1] || { title: "Player 2", sub: "Henüz output yok", status: "loading" };

  listEl.innerHTML = [
    renderMusicCard(slot1),
    renderMusicCard(slot2),
  ].join("\n");

  console.log("[PANEL_MUSIC] renderedHTMLlen", listEl.innerHTML.length);
}


   // ---------------------------------------------------------
  // RightPanel integration
  // ---------------------------------------------------------
  function mount() {
    if (!ensureHost()) return;

    // ✅ BOŞKEN BİLE GÖRÜNECEK 2 PLAYER SKELETON (mount anında)
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Player 1</div>
          <div class="rp-body">Henüz output yok</div>
        </div>
        <div class="rp-playerCard">
          <div class="rp-title">Player 2</div>
          <div class="rp-body">Henüz output yok</div>
        </div>
      </div>
    `;

    // mevcut listeyi bunun ALTINA kur
    ensureList();
    render();
  }

  function destroy() {
    // panel switch olduğunda istersek temizleriz
    // host'u tamamen silmiyoruz, manager yönetiyor
  }

  function registerToManager() {
    const RP = window.RightPanel;
    if (!RP || typeof RP.register !== "function") return false;

    RP.register(PANEL_KEY, { mount, destroy });
    return true;
  }

  // ---------------------------------------------------------
  // Public debug helper (temporary)
  // ---------------------------------------------------------
  window.AIVO_MUSIC_PANEL = {
    setJobs(nextJobs) {
      jobs = Array.isArray(nextJobs) ? nextJobs : [];
      render();
    },
    renderMusicCard, // istersen konsolda birebir template’i görebilirsin
  };

  // Try register now; otherwise retry on DOMContentLoaded
  if (!registerToManager()) {
    window.addEventListener("DOMContentLoaded", () => {
      registerToManager();
    });
  }
})();

