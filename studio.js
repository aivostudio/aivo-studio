// =========================================================
// AIVO STUDIO – STUDIO.JS (STABLE BASE)
// Amaç: Sayfanın her koşulda açılması
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     HELPERS
     ========================================================= */
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* =========================================================
     PAGE SYSTEM (FAIL-SAFE)
     ========================================================= */

  const pages = qsa(".page");

  function showPage(key) {
    let found = false;

    pages.forEach(p => {
      const match = p.dataset.page === key;
      p.classList.toggle("is-active", match);
      if (match) found = true;
    });

    // Fail-safe: sayfa yoksa studio'yu aç
    if (!found) {
      pages.forEach(p => {
        p.classList.toggle("is-active", p.dataset.page === "studio");
      });
    }
  }

  // İlk açılış – HTML bozuk olsa bile aç
  showPage("studio");

  /* =========================================================
     TOPNAV & SIDEBAR LINK BINDING
     ========================================================= */

  qsa("[data-page-link]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const key = btn.getAttribute("data-page-link");
      if (key) showPage(key);
    });
  });

  /* =========================================================
     SIDEBAR SUBMENU (MUSIC)
     ========================================================= */

  qsa("[data-submenu-toggle]").forEach(toggle => {
    toggle.addEventListener("click", () => {
      const key = toggle.getAttribute("data-submenu-toggle");
      const menu = qs(`[data-submenu="${key}"]`);
      if (!menu) return;

      toggle.classList.toggle("is-open");
      menu.classList.toggle("is-open");
    });
  });

  /* =========================================================
     MUSIC VIEWS (GELENEKSEL / SES KAYDI / AI VIDEO)
     ========================================================= */

  const musicViews = qsa(".music-view");

  function showMusicView(key) {
    let found = false;

    musicViews.forEach(v => {
      const match = v.dataset.musicView === key;
      v.classList.toggle("is-active", match);
      if (match) found = true;
    });

    // Fail-safe
    if (!found && musicViews.length) {
      musicViews[0].classList.add("is-active");
    }
  }

  // Varsayılan
  showMusicView("geleneksel");

  qsa("[data-music-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      showMusicView(btn.dataset.musicTab);
    });
  });

  /* =========================================================
     MODE TOGGLE (BASIT / GELİŞMİŞ)
     ========================================================= */

  qsa("[data-mode-button]").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.modeButton;
      document.body.setAttribute("data-mode", mode);

      qsa("[data-mode-button]").forEach(b =>
        b.classList.toggle("is-active", b === btn)
      );
    });
  });

  /* =========================================================
     VIDEO TABS
     ========================================================= */

  const videoViews = qsa(".video-view");

  function showVideoView(key) {
    videoViews.forEach(v =>
      v.classList.toggle("is-active", v.dataset.videoView === key)
    );
  }

  showVideoView("text");

  qsa("[data-video-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      showVideoView(btn.dataset.videoTab);
    });
  });

  /* =========================================================
     PRICING MODAL
     ========================================================= */

  const pricingModal = qs("#pricingModal");

  function openPricing() {
    if (pricingModal) pricingModal.classList.add("is-open");
  }

  function closePricing() {
    if (pricingModal) pricingModal.classList.remove("is-open");
  }

  qsa("[data-open-pricing]").forEach(btn =>
    btn.addEventListener("click", openPricing)
  );

  qs("#closePricing")?.addEventListener("click", closePricing);
  qs(".pricing-backdrop")?.addEventListener("click", closePricing);

  /* =========================================================
     MEDIA MODAL (COVER / VIDEO PREVIEW)
     ========================================================= */

  const mediaModal = qs("#mediaModal");

  function closeMedia() {
    mediaModal?.setAttribute("aria-hidden", "true");
  }

  qsa("[data-media-close]").forEach(el =>
    el.addEventListener("click", closeMedia)
  );

  /* =========================================================
     GLOBAL PLAYER (SAFE INIT)
     ========================================================= */

  const gp = {
    root : qs("#globalPlayer"),
    audio: qs("#gpAudio"),
    play : qs("#gpPlay"),
    prev : qs("#gpPrev"),
    next : qs("#gpNext"),
    close: qs("#gpClose"),
    seek : qs("#gpSeek"),
    vol  : qs("#gpVol"),
    cur  : qs("#gpCur"),
    dur  : qs("#gpDur"),
  };

  if (gp.root && gp.audio) {

    gp.play?.addEventListener("click", () => {
      if (gp.audio.paused) gp.audio.play();
      else gp.audio.pause();
    });

    gp.close?.addEventListener("click", () => {
      gp.audio.pause();
      gp.root.classList.add("is-hidden");
    });

    gp.audio.addEventListener("timeupdate", () => {
      if (!gp.seek || !gp.dur || !gp.cur) return;
      gp.cur.textContent = formatTime(gp.audio.currentTime);
      gp.dur.textContent = formatTime(gp.audio.duration);
      gp.seek.value = (gp.audio.currentTime / gp.audio.duration) * 100 || 0;
    });

    gp.seek?.addEventListener("input", () => {
      if (!gp.audio.duration) return;
      gp.audio.currentTime = (gp.seek.value / 100) * gp.audio.duration;
    });

    gp.vol?.addEventListener("input", () => {
      gp.audio.volume = gp.vol.value;
    });
  }

  function formatTime(sec) {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /* =========================================================
     LOG
     ========================================================= */

  console.log("✅ AIVO Studio JS loaded (stable base)");

});
