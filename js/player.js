window.__AIVO_JOB_BINDER__ = false;

// --- AIVO_JOBS (global mini store) ---
// studio.music.generate.js buraya upsert eder, paneller de buradan dinler.
window.AIVO_JOBS = window.AIVO_JOBS || (function(){
  const jobs = new Map();

  function upsert(job){
    if (!job) return;
    const id = job.job_id || job.id || job.jobId;
    if (!id) return;

    const prev = jobs.get(id) || {};
    const next = { ...prev, ...job, job_id: id };
    jobs.set(id, next);

    // dinleyenler için event
    window.dispatchEvent(new CustomEvent('aivo:job', { detail: next }));
    return next;
  }

  function list(){
    return Array.from(jobs.values());
  }

  return { upsert, list, _jobs: jobs };
})();

/* =========================================================
   AIVO Player — v1 (Card actions + local audio)
   File: /js/player.js
   Notes:
   - Tek Audio instance + kart bazlı UI.
   - Kart HTML'i: .aivo-player-card + data-src + data-action="toggle-play"
   - Aksiyonlar: window event -> "aivo:player-action"
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

  // --- Actions: panel tarafı dinler ---
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

    // başka karta geçiyorsak önce durdur
    if (!isSame) {
      audio.pause();
      audio.src = "";
      clearActiveUI();
    }

    // aynı kart + çalıyorsa duraklat
    if (isSame && !audio.paused) {
      audio.pause();
      setBtnState(btn, false);
      card.classList.remove("is-playing");
      stopRaf();
      return;
    }

    // çal
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

  // progress click -> seek
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

    // play
    const playBtn = e.target.closest(SELECTORS.playBtn);
    if (playBtn) {
      const card = playBtn.closest(SELECTORS.card);
      if (!card) return;
      e.preventDefault();
      togglePlay(card, playBtn);
      return;
    }

    // actions
    const actionBtn = e.target.closest(SELECTORS.actionBtn);
    if (actionBtn) {
      const card = actionBtn.closest(SELECTORS.card);
      if (!card) return;

      const act = actionBtn.getAttribute("data-action");
      if (!act) return;

      e.preventDefault();

      // güvenlik: toggle-play action'ı yanlışlıkla aivo-action'a konursa da çalışsın
      if (act === "toggle-play") {
        const btn = qs(SELECTORS.playBtn, card);
        if (btn) togglePlay(card, btn);
        return;
      }

      dispatchAction(card, act);
      return;
    }
  }

  function wirePlayButtons(root) {
    qsa(SELECTORS.playBtn, root).forEach((btn) => {
      if (btn.__aivoInited) return;
      btn.__aivoInited = true;
      setBtnState(btn, false);
    });
  }

  function wireProgressBars(root) {
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

  function syncWiring(root) {
    wirePlayButtons(root);
    wireProgressBars(root);
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

    // ilk init
    syncWiring(root);

    // sonradan basılan kartlar için
    const mo = new MutationObserver(() => {
      syncWiring(root);
    });
    mo.observe(root, { childList: true, subtree: true });

    console.log("[PLAYER] v1 ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
// ---- job status polling (TEMP DISABLED) ----
// status endpoint şu an 404 verdiği için polling'i kapatıyoruz.
const POLL_INTERVAL = 2500;
const TIMEOUT = 1000 * 60 * 5;

async function waitForOutput(jobId) {
  // binder-off: false ise hiç status polling yapma
  if (window.__AIVO_JOB_BINDER__ === false) return null;

  const deadline = Date.now() + TIMEOUT;

  while (Date.now() < deadline) {
    if (window.__AIVO_JOB_BINDER__ === false) return null;

    const r = await fetch(
      `/api/jobs/status?job_id=${encodeURIComponent(jobId)}`,
      { cache: "no-store" }
    ).catch(() => null);

    if (!r || !r.ok) {
      await new Promise((t) => setTimeout(t, POLL_INTERVAL));
      continue;
    }

    const j = await r.json().catch(() => null);
    if (!j) {
      await new Promise((t) => setTimeout(t, POLL_INTERVAL));
      continue;
    }

    if (
      j.status === "ready" ||
      j.status === "completed" ||
      j.status === "done" ||
      j.output_id ||
      j.outputId ||
      (j.outputs && j.outputs.length)
    ) return j;

    await new Promise((t) => setTimeout(t, POLL_INTERVAL));
  }

  return null;
}
// === AIVO PLAYER PUBLIC API (inject new cards the real way) ===
(function () {
  if (window.AIVO_PLAYER && window.AIVO_PLAYER.add) return;

  function findListRoot() {
    // Right panel host içindeki gerçek listeyi hedefle
    const host = document.getElementById("rightPanelHost");
    if (!host) return document.querySelector(".aivo-player-list");
    return host.querySelector(".aivo-player-list") || document.querySelector(".aivo-player-list");
  }

  // player.js içinde zaten render eden bir fonksiyon yoksa bile,
  // en azından player.js'in kendi init mekanizmasını tekrar koşturacağız.
  // v2 player genelde DOM scan yapar; isimler değişebileceği için çok toleranslı.
  function tryReinit() {
    const candidates = [
      window.__AIVO_PLAYER_V1__?.scan,
      window.__AIVO_PLAYER_V1__?.init,
      window.__AIVO_PLAYER_V1__?.mountAll,
      window.__AIVO_PLAYER_V1__?.refresh,
      window.__AIVO_PLAYER_V1__?.boot,
    ].filter((f) => typeof f === "function");

    if (candidates.length) {
      try {
        candidates[0](); // ilk bulduğunu çalıştır
        return true;
      } catch (e) {
        console.warn("[AIVO_PLAYER] reinit failed", e);
      }
    }
    return false;
  }

  // ✅ gerçek ekleme: player’ın kendi DOM şablonuna uygun "boş kart" bas
  function addCard({ title, job_id, output_id, src }) {
    const list = findListRoot();
    if (!list) {
      console.warn("[AIVO_PLAYER] list root bulunamadı");
      return null;
    }

    const el = document.createElement("div");
    el.className = "aivo-player-card";
    el.setAttribute("data-title", title || "Untitled");
    el.setAttribute("data-job-id", job_id || "");
    el.setAttribute("data-output-id", output_id || "");
    el.setAttribute("data-src", src || "");

    // IMPORTANT: player.js zaten bu node'u dolduracak.
    // Eğer doldurmazsa zaten “gerçek” player yok demektir.
    list.prepend(el);

    const ok = tryReinit();
    console.log("[AIVO_PLAYER] addCard", { ok, title, job_id, output_id });
    return el;
  }

  window.AIVO_PLAYER = window.AIVO_PLAYER || {};
  window.AIVO_PLAYER.add = function ({ job_id }) {
    const base = job_id || ("job_" + Math.random().toString(16).slice(2));
    // v1/v2 ikilisi
    addCard({ title: "Original (v1)", job_id: base, output_id: base + ":v1", src: "" });
    addCard({ title: "Revize (v2)", job_id: base, output_id: base + ":v2", src: "" });
  };

  console.log("[AIVO_PLAYER] public API ready: AIVO_PLAYER.add({job_id})");
})();

