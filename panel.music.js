/* =========================================================
   panel.music.js — RightPanel V2 + AIVO_JOBS listener
   - Statik test kart YOK
   - aivo:job event gelince listeye kart BASAR
   - Player.js delegasyonu ile uyumlu:
     .aivo-player-card + data-src + [data-action="toggle-play"]
   ========================================================= */

(function bootRegisterMusicPanel() {
  if (window.__AIVO_PANEL_MUSIC_V2__) return;
  window.__AIVO_PANEL_MUSIC_V2__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL = "#rightPanelHost";

  let hostEl = null;
  let listEl = null;

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
      hostEl.appendChild(listEl);
    }
    return listEl;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function jobToKey(job) {
    return String(job?.job_id || job?.id || job?.jobId || "");
  }

  function pickTitle(job) {
    return job?.title || job?.name || "Yeni Müzik";
  }

  function pickSubtitle(job) {
    // istersen prompt/genre vb.
    return job?.subtitle || job?.prompt || "";
  }

  function pickStatus(job) {
    return job?.status || "queued";
  }

  function pickSrc(job) {
    // backend hangi alanı dönüyorsa buraya ekle
    const o = job || {};
    return (
      o.src ||
      o.url ||
      o.audioUrl ||
      o.audio_url ||
      (o.output && (o.output.url || o.output.src)) ||
      (Array.isArray(o.outputs) ? (o.outputs[0]?.url || o.outputs[0]?.src) : "") ||
      ""
    );
  }

  function isReady(job) {
    const st = String(pickStatus(job)).toLowerCase();
    const src = pickSrc(job);
    return !!src && (st === "ready" || st === "completed" || st === "done");
  }

  function ensureCard(job) {
    const id = jobToKey(job);
    if (!id || !listEl) return null;

    let card = listEl.querySelector(`.aivo-player-card[data-job-id="${CSS.escape(id)}"]`);
    if (!card) {
      card = document.createElement("div");
      card.className = "aivo-player-card is-loadingState";
      card.setAttribute("data-job-id", id);
      card.setAttribute("data-output-id", job.output_id || job.outputId || "");
      card.setAttribute("data-src", "");

      card.innerHTML = `
        <!-- LEFT -->
        <div class="aivo-player-left">
          <button class="aivo-player-btn"
            data-action="toggle-play"
            aria-label="Oynat"
            title="Oynat">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8 5v14l11-7-11-7z" fill="currentColor"></path>
            </svg>
          </button>
          <div class="aivo-player-spinner" title="İşleniyor"></div>
        </div>

        <!-- MID -->
        <div class="aivo-player-mid">
          <div class="aivo-player-titleRow">
            <div class="aivo-player-title">${esc(pickTitle(job))}</div>
            <div class="aivo-player-tags">
              <span class="aivo-tag is-queued">Hazırlanıyor</span>
            </div>
          </div>

          <div class="aivo-player-sub">${esc(pickSubtitle(job))}</div>

          <div class="aivo-player-meta">
            <span>0:00</span>
          </div>

          <div class="aivo-player-controls">
            <div class="aivo-progress" title="İlerleme">
              <i style="width:0%"></i>
            </div>
          </div>
        </div>

        <!-- RIGHT ACTIONS -->
        <div class="aivo-player-actions">
          <button class="aivo-action is-blue" data-action="download" title="Dosyayı İndir" aria-label="Dosyayı İndir">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M8 10l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="aivo-action is-danger" data-action="delete" title="Müziği Sil" aria-label="Müziği Sil">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18" stroke="currentColor" stroke-width="2"/>
              <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2"/>
              <path d="M7 6l1 14h8l1-14" stroke="currentColor" stroke-width="2"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      `;

      // en üste ekle
      listEl.prepend(card);
    }
    return card;
  }

  function updateCard(job) {
    const card = ensureCard(job);
    if (!card) return;

    const src = pickSrc(job);
    const ready = isReady(job);
    const st = pickStatus(job);

    // data-src güncelle (player.js buna bakıyor)
    if (src) card.setAttribute("data-src", src);

    // title/sub güncelle
    const titleEl = card.querySelector(".aivo-player-title");
    if (titleEl) titleEl.textContent = pickTitle(job);

    const subEl = card.querySelector(".aivo-player-sub");
    if (subEl) subEl.textContent = pickSubtitle(job);

    // tag + spinner + state
    const tagEl = card.querySelector(".aivo-tag");
    const spinner = card.querySelector(".aivo-player-spinner");

    card.classList.toggle("is-ready", ready);
    card.classList.toggle("is-loadingState", !ready);

    if (tagEl) {
      if (ready) {
        tagEl.className = "aivo-tag is-ready";
        tagEl.textContent = "Hazır";
      } else {
        tagEl.className = "aivo-tag is-queued";
        tagEl.textContent = (String(st) === "queued") ? "Hazırlanıyor" : esc(st);
      }
    }
    if (spinner) spinner.style.display = ready ? "none" : "";
  }

  function handleJob(job) {
    // sadece music job’ları
    const t = String(job?.type || job?.job_type || job?.kind || "").toLowerCase();
    if (t && t !== "music" && t !== "audio") return;

    // host/list hazır değilse pas geç
    if (!hostEl) ensureHost();
    if (!hostEl) return;
    ensureList();
    if (!listEl) return;

    updateCard(job);
  }

  function mount(host) {
    hostEl = host;
    hostEl.innerHTML = "";          // her mount temiz başlasın
    ensureList();

    // mevcut job’lar varsa bas
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.list === "function") {
      window.AIVO_JOBS.list().forEach(handleJob);
    }
  }

  function destroy(host) {
    if (host) host.innerHTML = "";
    hostEl = null;
    listEl = null;
  }

  const registerOnce = () => {
    if (!window.RightPanel) return false;
    if (window.RightPanel.panels?.music) return true;

    window.RightPanel.register(PANEL_KEY, { mount, destroy });
    return true;
  };

  if (!registerOnce()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (registerOnce() || tries > 50) clearInterval(t);
    }, 100);
  }

  // 🔥 AIVO_JOBS event listener (GLOBAL)
  window.addEventListener("aivo:job", function (e) {
    handleJob(e.detail);
  });

  console.log("[panel.music] v2 ready (listening aivo:job)");
})();
