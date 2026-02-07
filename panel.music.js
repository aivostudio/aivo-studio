/* =========================================================
   AIVO Right Panel — Music Panel (CUSTOM PLAYER UI)
   File: /js/panel.music.js
   - UI: aivo-player-card (senin CSS'inle uyumlu)
   - Playback: bu dosya yönetir (play/pause/progress)
   - Dışarıdan test ekleme: window.AIVO_MUSIC_PANEL.addTest(src, meta)
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const HOST_SEL = "#rightPanelHost";
  const PANEL_KEY = "music";

  const qs = (s, r=document) => r.querySelector(s);

  let hostEl = null;
  let listEl = null;

  // tek audio instance (UI gibi davranır)
  const audio = new Audio();
  audio.preload = "metadata";

  let currentCard = null;
  let rafId = null;

  function ensureHost(){
    hostEl = qs(HOST_SEL);
    return hostEl;
  }

  function ensureList(){
    if (!hostEl) return null;
    listEl = hostEl.querySelector(".aivo-player-list");
    if (!listEl){
      listEl = document.createElement("div");
      listEl.className = "aivo-player-list";
      hostEl.appendChild(listEl);
    }
    return listEl;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function fmtTime(sec){
    sec = Math.max(0, Number(sec||0));
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60);
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  function stopRAF(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function updateProgress(card){
    if (!card) return;

    const prog = card.querySelector(".aivo-progress i");
    const timeEl = card.querySelector(".aivo-player-meta span"); // ilk span = süre
    if (!prog) return;

    const dur = audio.duration || 0;
    const cur = audio.currentTime || 0;

    const pct = dur > 0 ? (cur/dur)*100 : 0;
    prog.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    if (timeEl){
      // “current / total” yerine sadece total istersen bunu değiştir
      const total = dur > 0 ? fmtTime(dur) : "0:00";
      timeEl.textContent = total;
    }
  }

  function tick(){
    if (!currentCard) return;
    updateProgress(currentCard);
    rafId = requestAnimationFrame(tick);
  }

  function setCardPlaying(card, isPlaying){
    if (!card) return;
    card.classList.toggle("is-playing", !!isPlaying);

    const btn = card.querySelector('[data-action="toggle-play"]');
    if (btn){
      // istersen ikon swap yaparsın; şimdilik class ile CSS yönet
      btn.setAttribute("aria-label", isPlaying ? "Durdur" : "Oynat");
      btn.setAttribute("title", isPlaying ? "Durdur" : "Oynat");
    }
  }

  function playCard(card){
    const src = card?.dataset?.src || "";
    if (!src) {
      console.warn("[panel.music] data-src boş, çalınamaz");
      return;
    }

    // başka kart çalıyorsa durdur
    if (currentCard && currentCard !== card){
      setCardPlaying(currentCard, false);
    }

    currentCard = card;

    // aynı src değilse değiştir
    if (audio.src !== src) {
      audio.src = src;
      audio.currentTime = 0;
    }

    audio.play().then(() => {
      setCardPlaying(card, true);
      stopRAF();
      tick();
    }).catch((e) => {
      console.error("[panel.music] audio.play failed", e);
      setCardPlaying(card, false);
      stopRAF();
    });
  }

  function pause(){
    audio.pause();
  }

  function toggle(card){
    if (!card) return;
    const same = (currentCard === card);
    const isPlaying = !audio.paused && !audio.ended;

    if (same && isPlaying){
      pause();
    } else {
      playCard(card);
    }
  }

  function seekFromClick(card, e){
    const bar = card.querySelector(".aivo-progress");
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    const pct = rect.width > 0 ? (x / rect.width) : 0;

    const dur = audio.duration || 0;
    if (dur > 0){
      audio.currentTime = dur * pct;
      updateProgress(card);
    }
  }

  function cardHTML(meta){
    const title = meta?.title || "Müzik Üretimi";
    const sub = meta?.sub || meta?.subtitle || "";
    const tags = Array.isArray(meta?.tags) ? meta.tags : [];
    const dateText = meta?.dateText || "";

    const tagHTML = [
      `<span class="aivo-tag is-ready">Hazır</span>`,
      ...tags.map(t => `<span class="aivo-tag">${esc(t)}</span>`)
    ].join("");

    return `
<div class="aivo-player-card is-ready"
  data-src="${esc(meta?.src || "")}"
  data-job-id="${esc(meta?.jobId || "")}"
  data-output-id="${esc(meta?.outputId || "")}">

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
  </div>

  <!-- MID -->
  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title">${esc(title)}</div>
      <div class="aivo-player-tags">${tagHTML}</div>
    </div>

    <div class="aivo-player-sub">${esc(sub)}</div>

    <div class="aivo-player-meta">
      <span>0:00</span>
      <span class="aivo-player-dot"></span>
      <span>${esc(dateText)}</span>
    </div>

    <div class="aivo-player-controls">
      <div class="aivo-progress" title="İlerleme">
        <i style="width:0%"></i>
      </div>
    </div>
  </div>

  <!-- RIGHT ACTIONS (şimdilik UI) -->
  <div class="aivo-player-actions">
    <button class="aivo-action" data-action="stems" title="Parçaları Ayır" aria-label="Parçaları Ayır">…</button>
    <button class="aivo-action is-blue" data-action="download" title="Dosyayı İndir" aria-label="Dosyayı İndir">⬇</button>
    <button class="aivo-action is-accent" data-action="extend" title="Süreyi Uzat" aria-label="Süreyi Uzat">⟳</button>
    <button class="aivo-action" data-action="revise" title="Yeniden Yorumla" aria-label="Yeniden Yorumla">✎</button>
    <button class="aivo-action is-danger" data-action="delete" title="Müziği Sil" aria-label="Müziği Sil">🗑</button>
  </div>
</div>`;
  }

  function addCard(meta){
    ensureHost(); ensureList();
    const wrap = document.createElement("div");
    wrap.innerHTML = cardHTML(meta);
    const card = wrap.firstElementChild;
    listEl.appendChild(card);
    return card;
  }

  // --- Events (delegation) ---
  function onClick(e){
    const btn = e.target.closest?.('[data-action="toggle-play"]');
    if (btn){
      const card = btn.closest(".aivo-player-card");
      if (card) toggle(card);
      return;
    }

    const prog = e.target.closest?.(".aivo-progress");
    if (prog){
      const card = prog.closest(".aivo-player-card");
      if (card) seekFromClick(card, e);
    }
  }

  // audio events -> UI sync
  audio.addEventListener("pause", () => {
    if (currentCard) setCardPlaying(currentCard, false);
    stopRAF();
  });

  audio.addEventListener("ended", () => {
    if (currentCard) setCardPlaying(currentCard, false);
    stopRAF();
    if (currentCard){
      const prog = currentCard.querySelector(".aivo-progress i");
      if (prog) prog.style.width = "0%";
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (currentCard) updateProgress(currentCard);
  });

  function mount(){
    if (!ensureHost()) return;

    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Üretilenler</div>
          <div class="rp-body">
            <div class="aivo-player-list"></div>
          </div>
        </div>
      </div>
    `;

    ensureList();
    hostEl.addEventListener("click", onClick, true);

    console.log("[panel.music] mounted (custom player ui)");
  }

  function destroy(){
    stopRAF();
    try { audio.pause(); } catch {}
    currentCard = null;
    if (hostEl) hostEl.removeEventListener("click", onClick, true);
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

  // dışarıdan test bağlamak için:
  window.AIVO_MUSIC_PANEL = {
    addTest(src, meta={}){
      return addCard({
        ...meta,
        src,
        title: meta.title || "TEST (Cloudflare)",
        tags: meta.tags || ["Türkçe"],
        dateText: meta.dateText || new Date().toLocaleString("tr-TR"),
      });
    }
  };
})();
