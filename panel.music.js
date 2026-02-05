/* =========================================================
   panel.music.js — RightPanel V2 (player.js ile UYUMLU KART)
   - player.js SELECTORS:
     card: ".aivo-player-card"
     playBtn: '[data-action="toggle-play"]'
     timeBind: '[data-bind="time"]'
     progressBar: ".aivo-progress"
     progressFill: ".aivo-progress i"
   ========================================================= */
(function () {
  if (window.__AIVO_PANEL_MUSIC_V3__) return;
  window.__AIVO_PANEL_MUSIC_V3__ = true;

  const PANEL_KEY = "music";

  let hostEl = null;
  let listEl = null;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureList() {
    if (!hostEl) return null;
    listEl = hostEl.querySelector(".aivo-player-list");
    if (!listEl) {
      listEl = document.createElement("div");
      listEl.className = "aivo-player-list";
      hostEl.appendChild(listEl);
    }
    return listEl;
  }

  function jobId(job) {
    return String(job?.job_id || job?.id || job?.jobId || "");
  }

  function pick(job, keys, fallback = "") {
    for (const k of keys) {
      if (job && job[k]) return job[k];
    }
    return fallback;
  }

  function pickSrc(job) {
    return pick(job, ["src", "url", "audioUrl", "audio_url"], "");
  }

  function isReady(job) {
    const st = String(job?.status || "").toLowerCase();
    return !!pickSrc(job) && (st === "ready" || st === "done" || st === "completed");
  }

  function ensureCard(job) {
    const id = jobId(job);
    if (!id || !listEl) return null;

    let card = listEl.querySelector(`.aivo-player-card[data-job-id="${CSS.escape(id)}"]`);
    if (card) return card;

    const title = esc(pick(job, ["title", "name"], "Yeni Müzik"));
    const sub = esc(pick(job, ["subtitle", "prompt"], ""));

    card = document.createElement("div");
    card.className = "aivo-player-card is-loadingState";
    card.setAttribute("data-job-id", id);
    card.setAttribute("data-output-id", pick(job, ["output_id", "outputId"], ""));
    card.setAttribute("data-src", ""); // ready olunca dolacak

    // ✅ PLAY BUTTON: player.js bunu kendi SVG’sine çevirecek (setBtnState)
    card.innerHTML = `
      <div class="aivo-player-left">
        <button class="aivo-player-btn"
          data-action="toggle-play"
          aria-label="Oynat"
          title="Oynat"></button>

        <div class="aivo-player-spinner" title="İşleniyor"></div>
      </div>

      <div class="aivo-player-mid">
        <div class="aivo-player-titleRow">
          <div class="aivo-player-title">${title}</div>
          <div class="aivo-player-tags">
            <span class="aivo-tag is-queued">Hazırlanıyor</span>
          </div>
        </div>

        <div class="aivo-player-sub">${sub}</div>

        <div class="aivo-player-meta">
          <span data-bind="time">0:00</span>
        </div>

        <div class="aivo-player-controls">
          <div class="aivo-progress" title="İlerleme"><i style="width:0%"></i></div>
        </div>
      </div>

      <div class="aivo-player-actions">
        <button class="aivo-action is-blue" data-action="download" title="İndir" aria-label="İndir">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 10l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="aivo-action is-danger" data-action="delete" title="Sil" aria-label="Sil">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18" stroke="currentColor" stroke-width="2"/>
            <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2"/>
            <path d="M7 6l1 14h8l1-14" stroke="currentColor" stroke-width="2"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
    `;

    listEl.prepend(card);
    return card;
  }

  function updateCard(job) {
    const card = ensureCard(job);
    if (!card) return;

    const ready = isReady(job);
    const src = pickSrc(job);

    if (src) card.setAttribute("data-src", src);

    card.classList.toggle("is-ready", ready);
    card.classList.toggle("is-loadingState", !ready);

    const tag = card.querySelector(".aivo-tag");
    const spinner = card.querySelector(".aivo-player-spinner");

    if (tag) {
      if (ready) {
        tag.className = "aivo-tag is-ready";
        tag.textContent = "Hazır";
      } else {
        tag.className = "aivo-tag is-queued";
        tag.textContent = "Hazırlanıyor";
      }
    }
    if (spinner) spinner.style.display = ready ? "none" : "";
  }

  function handleJob(job) {
    const t = String(job?.type || "").toLowerCase();
    if (t && t !== "music" && t !== "audio") return;

    if (!hostEl) return;
    ensureList();
    updateCard(job);
  }

  function mount(host) {
    hostEl = host;
    hostEl.innerHTML = "";
    ensureList();

    // sayfa açılırken varsa bas
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.list === "function") {
      window.AIVO_JOBS.list().forEach(handleJob);
    }
  }

  function destroy(host) {
    if (host) host.innerHTML = "";
    hostEl = null;
    listEl = null;
  }

  function registerOnce() {
    if (!window.RightPanel) return false;
    if (window.RightPanel.panels?.music) return true;
    window.RightPanel.register(PANEL_KEY, { mount, destroy });
    return true;
  }

  if (!registerOnce()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (registerOnce() || tries > 50) clearInterval(t);
    }, 100);
  }

  // job event
  window.addEventListener("aivo:job", (e) => handleJob(e.detail));

  console.log("[panel.music] v3 ready");
})();
