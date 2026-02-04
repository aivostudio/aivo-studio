/* =========================================================
   AIVO Player — v1 (Card actions + local audio)
   File: /public/js/player.js
   ========================================================= */


(function AIVO_PLAYER_V1() {
  if (window.__AIVO_PLAYER_V1__) return;
  window.__AIVO_PLAYER_V1__ = true;

  // ---------------------------------------------------------
  // Config (edit as needed)
  // ---------------------------------------------------------
  const SELECTORS = {
    root: "#rightPanelHost",               // cards live under here
    list: ".aivo-player-list",
    card: ".aivo-player-card",
    playBtn: '[data-action="toggle-play"]',
    actionBtn: ".aivo-action[data-action]",
    timeBind: '[data-bind="time"]',
    progressBar: ".aivo-progress",
    progressFill: ".aivo-progress i",
    tagReady: ".aivo-tag.is-ready",
    tagLoading: ".aivo-tag.is-loading",
  };

  // Single audio instance (one at a time)
  const audio = new Audio();
  audio.preload = "metadata";

  let activeCard = null;        // currently playing card element
  let activeBtn = null;         // play button element
  let rafId = null;

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
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

    // swap icon: play/pause (inline svg)
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

    // time label
    const timeEl = qs(SELECTORS.timeBind, activeCard);
    if (timeEl) timeEl.textContent = fmtTime(cur);

    // progress fill
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

  // ---------------------------------------------------------
  // Actions (stubs for now)
  // ---------------------------------------------------------
  function actionDownload(card) {
    const src = getCardSrc(card);
    if (!src) return;

    // direct download: open in new tab to let browser handle mp3/wav
    window.open(src, "_blank", "noopener,noreferrer");
  }

  function actionStem(card) {
    const ids = getCardIds(card);
    console.log("[PLAYER] stem requested", ids);

    alert("Stem (Parçaları Ayır) bu sürümde henüz bağlı değil. (JS hazır, endpoint bağlayacağız)");
  }

  function actionExtend(card) {
    const ids = getCardIds(card);
    console.log("[PLAYER] extend requested", ids);

    alert("Uzatma bu sürümde henüz bağlı değil. (JS hazır, motor bağlayacağız)");
  }

  function actionRemix(card) {
    const ids = getCardIds(card);
    console.log("[PLAYER] remix requested", ids);

    alert("Yeniden Yorumla bu sürümde henüz bağlı değil. (JS hazır, motor bağlayacağız)");
  }

  function actionDelete(card) {
    const ids = getCardIds(card);
    console.log("[PLAYER] delete requested", ids);

    const ok = confirm("Bu müziği silmek istiyor musun?");
    if (!ok) return;

    // demo: remove from UI
    // later: call /api/... then remove
    if (activeCard === card) {
      audio.pause();
      audio.src = "";
      clearActiveUI();
      stopRaf();
    }
    card.remove();
  }

  // ---------------------------------------------------------
  // Play toggle
  // ---------------------------------------------------------
  async function togglePlay(card, btn) {
    if (!cardIsPlayable(card)) return;

    const src = getCardSrc(card);
    const isSame = activeCard === card;

    // If clicking another card: stop previous first
    if (!isSame) {
      audio.pause();
      audio.src = "";
      clearActiveUI();
    }

    // If same card and currently playing -> pause
    if (isSame && !audio.paused) {
      audio.pause();
      setBtnState(btn, false);
      card.classList.remove("is-playing");
      stopRaf();
      return;
    }

    // Otherwise: start playing
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

  // Click on progress bar (seek)
  function seekByClick(card, evt) {
    const bar = evt.currentTarget;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, evt.clientX - rect.left));
    const ratio = rect.width > 0 ? (x / rect.width) : 0;

    const dur = audio.duration || 0;
    if (!dur || activeCard !== card) return;

    audio.currentTime = ratio * dur;
  }

  // ---------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------
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
      if (act === "download") return actionDownload(card);
      if (act === "stem") return actionStem(card);
      if (act === "extend") return actionExtend(card);
      if (act === "remix") return actionRemix(card);
      if (act === "delete") return actionDelete(card);

      return;
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

  // Audio lifecycle
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
// Boot
function boot() {
  const root = qs(SELECTORS.root);
  if (!root) {
    console.warn("[PLAYER] #rightPanelHost not found yet");
    return;
  }

  root.addEventListener("click", onRootClick);

  // if cards are injected later, init play buttons
  function wirePlayButtons() {
    qsa(SELECTORS.playBtn, root).forEach((btn) => {
      if (btn.__aivoInited) return;
      btn.__aivoInited = true;
      setBtnState(btn, false);
    });
  }

  wirePlayButtons();

  const mo = new MutationObserver(() => {
    wirePlayButtons();
  });

  mo.observe(root, { childList: true, subtree: true });

  console.log("[PLAYER] v1 ready");
}

// ================= DEBUG SAFE BLOCK =================
function wirePlayButtons() {
  const btns = qsa(SELECTORS.playBtn, root);
  console.log("[PLAYER][debug] play buttons found:", btns.length);

  btns.forEach((btn) => {
    if (btn.__aivoInited) return;
    btn.__aivoInited = true;
    console.log("[PLAYER][debug] init play button", btn);
    setBtnState(btn, false);
  });
}

function debugScan() {
  const cards = qsa(SELECTORS.card, root);
  console.log("[PLAYER][debug] cards found:", cards.length);

  cards.forEach((c, i) => {
    console.log(`[PLAYER][debug] card[${i}]`, {
      src: c.getAttribute("data-src"),
      job: c.getAttribute("data-job-id"),
      output: c.getAttribute("data-output-id"),
      classes: c.className,
    });
  });
}

wirePlayButtons();
debugScan();

const mo = new MutationObserver(() => {
  console.log("[PLAYER][debug] DOM mutated under #rightPanelHost");
  wirePlayButtons();
  debugScan();
});

mo.observe(root, { childList: true, subtree: true });

console.log("[PLAYER] v1 ready — DEBUG MODE");
// ====================================================


})();
