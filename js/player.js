/* =========================================================
   AIVO Player — v1 (Card actions + local audio)
   File: /js/player.js
   Notes:
   - Eski global player DOM'u KALDIRILDI (gpAudio vs yok).
   - Tek Audio instance + kart bazlı UI.
   ========================================================= */

(function AIVO_PLAYER_V1() {
  if (window.__AIVO_PLAYER_V1__) return;
  window.__AIVO_PLAYER_V1__ = true;

  const SELECTORS = {
    root: "#rightPanelHost",
    card: ".aivo-player-card",
    playBtn: '[data-action="toggle-play"]',
    actionBtn: ".aivo-action[data-action]",
    timeBind: '[data-bind="time"]',
    progressBar: ".aivo-progress",
    progressFill: ".aivo-progress i",
  };

  // Single audio instance
  const audio = new Audio();
  audio.preload = "metadata";

  let activeCard = null;
  let activeBtn = null;
  let rafId = null;

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function setBtnState(btn, playing) {
    if (!btn) return;
    btn.setAttribute("aria-label", playing ? "Duraklat" : "Oynat");
    btn.setAttribute("title", playing ? "Duraklat" : "Oynat");

    btn.innerHTML = playing
      ? `<svg viewBox="0 0 24 24" fill="none">
           <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>
         </svg>`
      : `<svg viewBox="0 0 24 24" fill="none">
           <path d="M8 5v14l11-7-11-7z" fill="currentColor"/>
         </svg>`;
  }

  function clearActiveUI() {
    if (activeBtn) setBtnState(activeBtn, false);
    if (activeCard) activeCard.classList.remove("is-playing");
    activeBtn = null;
    activeCard = null;
  }

  function stopRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function updateUIFrame() {
    if (!activeCard) return;

    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;

    const timeEl = qs(SELECTORS.timeBind, activeCard);
    if (timeEl) timeEl.textContent = fmtTime(cur);

    const fillEl = qs(SELECTORS.progressFill, activeCard);
    if (fillEl) {
      const pct = dur > 0 ? Math.min(100, Math.max(0, (cur / dur) * 100)) : 0;
      fillEl.style.width = pct.toFixed(2) + "%";
    }

    rafId = requestAnimationFrame(updateUIFrame);
  }

  function ensureRaf() {
    stopRaf();
    rafId = requestAnimationFrame(updateUIFrame);
  }

  function cardIsPlayable(card) {
    if (!card) return false;
    const src = card.getAttribute("data-src");
    const isLoading = card.classList.contains("is-loadingState");
    return !!src && !isLoading;
  }

  function getCardSrc(card) {
    return card.getAttribute("data-src") || "";
  }

  function getCardIds(card) {
    return {
      job_id: card.getAttribute("data-job-id") || "",
      output_id: card.getAttribute("data-output-id") || "",
    };
  }

  // --- Actions (event olarak kalsın; panel tarafı dinler) ---
  function dispatchAction(card, action) {
    const ids = getCardIds(card);
    const detail = { action, ...ids, src: getCardSrc(card) || null };
    window.dispatchEvent(new CustomEvent("aivo:player-action", { detail }));
  }

  // --- Play toggle ---
  async function togglePlay(card, btn) {
    if (!cardIsPlayable(card)) return;

    const src = getCardSrc(card);
    const isSame = activeCard === card;

    if (!isSame) {
      audio.pause();
      audio.src = "";
      clearActiveUI();
    }

    if (isSame && !audio.paused) {
      audio.pause();
      setBtnState(btn, false);
      card.classList.remove("is-playing");
      stopRaf();
      return;
    }

    try {
      activeCard = card;
      activeBtn = btn;
      card.classList.add("is-playing");

      if (audio.src !== src) audio.src = src;

      await audio.play();
      setBtnState(btn, true);
      ensureRaf();
    } catch (err) {
      console.error("[PLAYER] play failed", err);
      alert("Çalma başlatılamadı. (URL / CORS / Range kontrol)");
      clearActiveUI();
      stopRaf();
    }
  }

  function seekByClick(card, evt) {
    const bar = evt.currentTarget;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, evt.clientX - rect.left));
    const ratio = rect.width > 0 ? (x / rect.width) : 0;

    const dur = audio.duration || 0;
    if (!dur || activeCard !== card) return;

    audio.currentTime = ratio * dur;
  }

  // --- Delegation ---
  function onRootClick(e) {
    const root = qs(SELECTORS.root);
    if (!root) return;

    const playBtn = e.target.closest(SELECTORS.playBtn);
    if (playBtn) {
      const card = playBtn.closest(SELECTORS.card);
      if (!card) return;
      e.preventDefault();
      togglePlay(card, playBtn);
      return;
    }

    const actionBtn = e.target.closest(SELECTORS.actionBtn);
    if (actionBtn) {
      const card = actionBtn.closest(SELECTORS.card);
      if (!card) return;
      e.preventDefault();
      const act = actionBtn.getAttribute("data-action");
      if (!act) return;
      if (act === "toggle-play") return togglePlay(card, qs(SELECTORS.playBtn, card));
      return dispatchAction(card, act);
    }
  }

  function wireProgressBars() {
    const root = qs(SELECTORS.root);
    if (!root) return;

    qsa(`${SELECTORS.card} ${SELECTORS.progressBar}`, root).forEach((bar) => {
      if (bar.__aivoWired) return;
      bar.__aivoWired = true;
      bar.addEventListener("click", function (evt) {
        const card = bar.closest(SELECTORS.card);
        if (!card) return;
        seekByClick(card, evt);
      });
    });
  }

  function wirePlayButtons(root) {
    qsa(SELECTORS.playBtn, root).forEach((btn) => {
      if (btn.__aivoInited) return;
      btn.__aivoInited = true;
      setBtnState(btn, false);
    });
  }

  // --- Audio lifecycle ---
  audio.addEventListener("ended", () => {
    if (activeBtn) setBtnState(activeBtn, false);
    if (activeCard) activeCard.classList.remove("is-playing");
    stopRaf();
  });

  audio.addEventListener("pause", () => {
    if (activeBtn) setBtnState(activeBtn, false);
    if (activeCard) activeCard.classList.remove("is-playing");
    stopRaf();
  });

  // --- Boot ---
  function boot() {
    const root = qs(SELECTORS.root);
    if (!root) {
      console.warn("[PLAYER] #rightPanelHost not found yet");
      return;
    }

    if (!root.__aivoPlayerBound) {
      root.__aivoPlayerBound = true;
      root.addEventListener("click", onRootClick);
    }

    wireProgressBars();
    wirePlayButtons(root);

    setInterval(() => {
      wireProgressBars();
      wirePlayButtons(root);
    }, 1200);

    console.log("[PLAYER] v1 ready (no globalPlayer)");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
