// /js/player.js
(function AIVO_PLAYER(){
  if (window.__AIVO_PLAYER__) return;
  window.__AIVO_PLAYER__ = true;

  const root = document.getElementById("rightPanelHost");
  if (!root) return;

  const globalWrap  = document.getElementById("globalPlayer");
  const gpAudio     = document.getElementById("gpAudio");
  const gpTitle     = document.getElementById("gpTitle");
  const gpSub       = document.getElementById("gpSub");
  const gpPlayBtn   = document.getElementById("gpPlay");
  const gpSeek      = document.getElementById("gpSeek");
  const gpCur       = document.getElementById("gpCur");
  const gpDur       = document.getElementById("gpDur");
  const gpClose     = document.getElementById("gpClose");

  let currentCard = null;
  let isSeeking = false;

  function fmtTime(sec){
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function showGlobalPlayer(){
    if (!globalWrap) return;
    globalWrap.classList.remove("is-hidden");
    globalWrap.setAttribute("aria-hidden", "false");
  }

  function hideGlobalPlayer(){
    if (!globalWrap) return;
    globalWrap.classList.add("is-hidden");
    globalWrap.setAttribute("aria-hidden", "true");
  }

  function setCardPlaying(card, playing){
    if (!card) return;
    card.classList.toggle("is-playing", !!playing);

    // kart içi ikon değişimi istersen (CSS ile de yapabilirsin)
    const btn = card.querySelector('[data-action="toggle-play"]');
    if (btn) btn.setAttribute("aria-label", playing ? "Duraklat" : "Oynat");
  }

  function stopCurrent(){
    if (gpAudio) gpAudio.pause();
    if (currentCard) setCardPlaying(currentCard, false);
    currentCard = null;
  }

  function playCard(card){
    if (!card || !gpAudio) return;

    const src = card.getAttribute("data-src");
    if (!src) return;

    const titleEl = card.querySelector(".aivo-player-title");
    const subEl   = card.querySelector(".aivo-player-sub");

    // aynı kartsa toggle
    if (currentCard === card) {
      if (gpAudio.paused) gpAudio.play().catch(()=>{});
      else gpAudio.pause();
      return;
    }

    // başka kart: önce eskisini durdur
    stopCurrent();

    currentCard = card;
    setCardPlaying(card, true);

    if (gpTitle && titleEl) gpTitle.textContent = titleEl.textContent.trim();
    if (gpSub && subEl) gpSub.textContent = subEl.textContent.trim();

    gpAudio.src = src;
    gpAudio.currentTime = 0;
    showGlobalPlayer();

    gpAudio.play().catch(() => {
      // autoplay engeline takılırsa: kullanıcı tekrar tıklar
      setCardPlaying(card, false);
    });
  }

  function dispatchAction(card, action){
    const detail = {
      action,
      job_id: card?.getAttribute("data-job-id") || null,
      output_id: card?.getAttribute("data-output-id") || null,
      src: card?.getAttribute("data-src") || null
    };
    window.dispatchEvent(new CustomEvent("aivo:player-action", { detail }));
  }

  // --- Event Delegation (kartlar sonradan ekleneceği için) ---
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const card = btn.closest(".aivo-player-card");
    const action = btn.getAttribute("data-action");
    if (!action) return;

    if (action === "toggle-play") {
      playCard(card);
      return;
    }

    // diğer aksiyonlar: şimdilik event
    dispatchAction(card, action);
  });

  // --- Global player kontrolleri (opsiyonel) ---
  if (gpPlayBtn && gpAudio) {
    gpPlayBtn.addEventListener("click", () => {
      if (!gpAudio.src) return;
      if (gpAudio.paused) gpAudio.play().catch(()=>{});
      else gpAudio.pause();
    });
  }

  if (gpClose && gpAudio) {
    gpClose.addEventListener("click", () => {
      stopCurrent();
      hideGlobalPlayer();
    });
  }

  if (gpSeek && gpAudio) {
    gpSeek.addEventListener("input", () => {
      isSeeking = true;
      const pct = Number(gpSeek.value || 0) / 100;
      const t = (gpAudio.duration || 0) * pct;
      if (gpCur) gpCur.textContent = fmtTime(t);
    });

    gpSeek.addEventListener("change", () => {
      const pct = Number(gpSeek.value || 0) / 100;
      const t = (gpAudio.duration || 0) * pct;
      gpAudio.currentTime = t;
      isSeeking = false;
    });
  }

  if (gpAudio) {
    gpAudio.addEventListener("play", () => {
      if (currentCard) setCardPlaying(currentCard, true);
      if (gpPlayBtn) gpPlayBtn.textContent = "⏸";
    });

    gpAudio.addEventListener("pause", () => {
      if (currentCard) setCardPlaying(currentCard, false);
      if (gpPlayBtn) gpPlayBtn.textContent = "▶";
    });

    gpAudio.addEventListener("loadedmetadata", () => {
      if (gpDur) gpDur.textContent = fmtTime(gpAudio.duration);
    });

    gpAudio.addEventListener("timeupdate", () => {
      if (!gpAudio.duration) return;

      if (gpCur) gpCur.textContent = fmtTime(gpAudio.currentTime);

      if (!isSeeking && gpSeek) {
        const pct = (gpAudio.currentTime / gpAudio.duration) * 100;
        gpSeek.value = String(pct);
      }

      // kart üzerindeki küçük progress (varsa)
      if (currentCard) {
        const bar = currentCard.querySelector(".aivo-progress i");
        if (bar) {
          const pct = (gpAudio.currentTime / gpAudio.duration) * 100;
          bar.style.width = pct.toFixed(2) + "%";
        }
        const t = currentCard.querySelector('[data-bind="time"]');
        if (t) t.textContent = fmtTime(gpAudio.currentTime);
      }
    });

    gpAudio.addEventListener("ended", () => {
      if (currentCard) setCardPlaying(currentCard, false);
    });
  }

})();
