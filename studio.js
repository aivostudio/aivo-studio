document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     HELPERS
     ========================================================= */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function pageExists(key) {
    return !!qs(`.page[data-page="${key}"]`);
  }

  function setTopnavActive(target) {
    qsa(".topnav-link[data-page-link]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-page-link") === target);
    });
  }

  function setSidebarsActive(target) {
    qsa(".sidebar [data-page-link]").forEach((b) => b.classList.remove("is-active"));
    qsa(".sidebar .sidebar-sublink").forEach((b) => b.classList.remove("is-active"));

    // Sidebar ana sayfaya bağlı olduğu için, aktif sayfa music iken sublinkleri işaretleyeceğiz
    if (target === "music") {
      const activeView = qs(".music-view.is-active")?.getAttribute("data-music-view");
      if (activeView) {
        const btn = qs(`.sidebar [data-music-tab="${activeView}"]`);
        if (btn) btn.classList.add("is-active");
      }
      return;
    }

    // Diğer sayfalar için sidebar-link (varsa)
    const btn = qs(`.sidebar [data-page-link="${target}"]`);
    if (btn) btn.classList.add("is-active");
  }

  function activateRealPage(target) {
    qsa(".page").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-page") === target);
    });
    setTopnavActive(target);
    setSidebarsActive(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================================================
     MUSIC SUBVIEWS
     ========================================================= */
  function switchMusicView(key) {
    qsa(".music-view").forEach((v) => {
      v.classList.toggle("is-active", v.getAttribute("data-music-view") === key);
    });

    qsa("[data-music-tab]").forEach((b) => b.classList.remove("is-active"));
    const btn = qs(`[data-music-tab="${key}"]`);
    if (btn) btn.classList.add("is-active");
  }
  window.switchMusicView = switchMusicView;

  function setRightPanelMode(mode) {
    const rightTitle = qs("#rightPanelTitle");
    const rightSubtitle = qs("#rightPanelSubtitle");

    const musicList = qs("#musicList");
    const videoList = qs("#videoList");
    const recordList = qs("#recordList");

    const musicEmpty = qs("#musicEmpty");
    const videoEmpty = qs("#videoEmpty");
    const recordEmpty = qs("#recordEmpty");

    const isMusic = mode === "music";
    const isVideo = mode === "video";
    const isRecord = mode === "record";

    if (rightTitle) rightTitle.textContent = isMusic ? "Müziklerim" : isVideo ? "Videolarım" : "Kayıtlarım";
    if (rightSubtitle) rightSubtitle.textContent = isMusic ? "Son üretilen müzikler" : isVideo ? "Son üretilen videolar" : "Son kayıtlar";

    if (musicList) musicList.classList.toggle("hidden", !isMusic);
    if (videoList) videoList.classList.toggle("hidden", !isVideo);
    if (recordList) recordList.classList.toggle("hidden", !isRecord);

    if (musicEmpty) musicEmpty.classList.toggle("hidden", !isMusic);
    if (videoEmpty) videoEmpty.classList.toggle("hidden", !isVideo);
    if (recordEmpty) recordEmpty.classList.toggle("hidden", !isRecord);
  }

  /* =========================================================
     SWITCH PAGE
     ========================================================= */
  function switchPage(target) {
    if (!target) return;

    // "video" üst menü = music sayfasında ai-video subview
    if (target === "video") {
      if (pageExists("music")) activateRealPage("music");
      switchMusicView("ai-video");
      setTopnavActive("video");
      setRightPanelMode("video");
      return;
    }

    if (!pageExists(target)) {
      console.warn("[AIVO] switchPage: hedef sayfa yok:", target);
      return;
    }

    activateRealPage(target);

    if (target === "music") {
      switchMusicView("geleneksel");
      setRightPanelMode("music");
    }
  }
  window.switchPage = switchPage;

  /* =========================================================
     MODE TOGGLE (BASİT / GELİŞMİŞ)
     ========================================================= */
  const body = document.body;
  const modeButtons = qsa("[data-mode-button]");
  const advancedSections = qsa("[data-visible-in='advanced']");
  const basicSections = qsa("[data-visible-in='basic']");

  function updateMode(mode) {
    body.setAttribute("data-mode", mode);

    modeButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-mode-button") === mode);
    });

    advancedSections.forEach((el) => {
      if (mode === "basic") el.classList.add("hidden");
      else el.classList.remove("hidden");
    });

    basicSections.forEach((el) => {
      if (mode === "basic") el.classList.remove("hidden");
      else el.classList.add("hidden");
    });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode-button");
      if (!mode) return;
      updateMode(mode);
    });
  });
  updateMode(body.getAttribute("data-mode") || "advanced");

  /* =========================================================
     SIDEBAR SUBMENU TOGGLE
     ========================================================= */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-submenu-toggle]");
    if (!t) return;

    const key = t.getAttribute("data-submenu-toggle");
    const menu = qs(`[data-submenu="${key}"]`);
    if (!menu) return;

    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    t.classList.toggle("is-open", open);
  });

  /* =========================================================
     KURUMSAL DROPDOWN (SAFE)
     ========================================================= */
  const corpDropdown = qs("#corpDropdown");
  function closeCorpDropdown() {
    if (!corpDropdown) return;
    corpDropdown.classList.remove("is-open");
    const btn = qs(".dropdown-toggle", corpDropdown);
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function toggleCorpDropdown() {
    if (!corpDropdown) return;
    const willOpen = !corpDropdown.classList.contains("is-open");
    corpDropdown.classList.toggle("is-open", willOpen);
    const btn = qs(".dropdown-toggle", corpDropdown);
    if (btn) btn.setAttribute("aria-expanded", String(willOpen));
  }

  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("#corpDropdown .dropdown-toggle");
    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleCorpDropdown();
      return;
    }
    if (corpDropdown && !e.target.closest("#corpDropdown")) closeCorpDropdown();
  });

  /* =========================================================
     PRICING MODAL
     ========================================================= */
  const pricingModal = qs("#pricingModal");
  const creditsButton = qs("#creditsButton");
  const closePricingBtn = qs("#closePricing");
  const pricingBackdrop = pricingModal ? qs(".pricing-backdrop", pricingModal) : null;

  function openPricing() {
    if (!pricingModal) return;
    pricingModal.classList.add("is-open");
    pricingModal.setAttribute("aria-hidden", "false");
    closeCorpDropdown();
  }
  function closePricing() {
    if (!pricingModal) return;
    pricingModal.classList.remove("is-open");
    pricingModal.setAttribute("aria-hidden", "true");
  }

  if (creditsButton) creditsButton.addEventListener("click", (e) => { e.preventDefault(); openPricing(); });
  if (closePricingBtn) closePricingBtn.addEventListener("click", (e) => { e.preventDefault(); closePricing(); });
  if (pricingBackdrop) pricingBackdrop.addEventListener("click", () => closePricing());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (pricingModal?.classList.contains("is-open")) closePricing();
      closeCorpDropdown();
    }
  });

  /* =========================================================
     GLOBAL CLICK HANDLER
     - data-open-pricing
     - data-page-link
     - data-music-tab
     - Kurumsal scroll: data-corp-scroll
     ========================================================= */
  document.addEventListener("click", (e) => {
    const pricingEl = e.target.closest("[data-open-pricing]");
    if (pricingEl) {
      e.preventDefault();
      openPricing();
      return;
    }

    const musicTab = e.target.closest("[data-music-tab]");
    if (musicTab) {
      e.preventDefault();
      const key = musicTab.getAttribute("data-music-tab");
      if (!key) return;

      // ai-video tab: üst menü video davranışı ile aynı
      if (key === "ai-video") {
        switchPage("video");
        closeCorpDropdown();
        return;
      }

      switchPage("music");
      switchMusicView(key);
      setRightPanelMode(key === "ses-kaydi" ? "record" : "music");
      setSidebarsActive("music");
      closeCorpDropdown();
      return;
    }

    const linkEl = e.target.closest("[data-page-link]");
    if (!linkEl) return;

    const target = linkEl.getAttribute("data-page-link");
    if (!target) return;

    const corpScroll = linkEl.getAttribute("data-corp-scroll");
    if (target === "corporate" && corpScroll) {
      e.preventDefault();
      switchPage("corporate");
      closeCorpDropdown();
      setTimeout(() => {
        const el = document.getElementById(corpScroll);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return;
    }

    e.preventDefault();
    closeCorpDropdown();
    switchPage(target);
  });

  /* =========================================================
     INITIAL STATE
     ========================================================= */
  setRightPanelMode("music");
  switchMusicView("geleneksel");
  setSidebarsActive("music");
});
