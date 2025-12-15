// AIVO STUDIO – STUDIO.JS (FULL)
// Navigation + Music subviews + Pricing modal + Media modal + Right panel

document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
   HELPERS
   ========================================================= */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function pageExists(key) {
    return !!qs(`.page[data-page="${key}"]`);
  }

  function getActivePageKey() {
    return qs(".page.is-active")?.getAttribute("data-page") || null;
  }

  function setTopnavActive(target) {
    qsa(".topnav-link[data-page-link]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-page-link") === target);
    });
  }

  function setSidebarsActive(target) {
    // Tüm sayfalardaki sidebar linkleri temizle
    qsa(".sidebar [data-page-link]").forEach((b) => b.classList.remove("is-active"));

    const activePage = qs(".page.is-active");
    if (!activePage) return;

    // Sadece aktif sayfadaki sidebar’da aktif işaretle
    qsa(".sidebar [data-page-link]", activePage).forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-page-link") === target);
    });
  }

  /** Sayfayı gerçekten aktive eden küçük yardımcı (recursive çağrı yok) */
  function activateRealPage(target) {
    qsa(".page").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-page") === target);
    });

    setTopnavActive(target);
    setSidebarsActive(target);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchPage(target) {
    if (!target) return;

    /* ------------------------------
       VIDEO: ayrı page değil -> MUSIC + ai-video subview
       (Recursive switchPage yok, tek akış)
       ------------------------------ */
    if (target === "video" || target === "ai-video") {
      // Music page’e geç
      if (pageExists("music")) activateRealPage("music");

      // Subview’i video yap
      if (typeof switchMusicView === "function") switchMusicView("ai-video");

      // Üst menü video seçili görünsün
      setTopnavActive("video");

      // ✅ Sidebar page aktifliği "music" olmalı (çünkü gerçek sayfa music)
      setSidebarsActive("music");

      // Sağ panel modu
      if (typeof setRightPanelMode === "function") setRightPanelMode("video");

      if (typeof refreshEmptyStates === "function") refreshEmptyStates();
      return;
    }

    /* ------------------------------
       NORMAL PAGE SWITCH
       ------------------------------ */
    if (!pageExists(target)) {
      console.warn("[AIVO] switchPage: hedef sayfa yok:", target);
      return;
    }

    activateRealPage(target);

    // MUSIC'e dönünce her zaman “geleneksel”e dön (video’da takılmasın)
    if (target === "music") {
      if (typeof switchMusicView === "function") switchMusicView("geleneksel");
      if (typeof setRightPanelMode === "function") setRightPanelMode("music");
      if (typeof refreshEmptyStates === "function") refreshEmptyStates();
    }
  }

  /* =========================================================
     GLOBAL CLICK HANDLER (NAV + MODALS)
     ========================================================= */
  document.addEventListener("click", (e) => {
    // 1) Pricing modal trigger (data-open-pricing)
    const pricingEl = e.target.closest("[data-open-pricing]");
    if (pricingEl) {
      e.preventDefault();
      openPricing();
      return;
    }

    // 2) Page navigation
    const linkEl = e.target.closest("[data-page-link]");
    if (!linkEl) return;

    const target = linkEl.getAttribute("data-page-link");
    if (!target) return;

    // ✅ Kredi menüsü yanlışlıkla page-link olarak bağlandıysa modal aç
    // (Topbar/Sidebar "Kredi AI" bazen pricing/credits/kredi gibi key gönderiyor)
    const pricingKeys = new Set(["pricing", "credits", "kredi", "kredi-al", "credit", "buy-credits"]);
    if (pricingKeys.has(target)) {
      e.preventDefault();
      openPricing();
      return;
    }

    // ✅ AI Video yanlışlıkla page-link ise: music + ai-video view + aktiflik senkronu
    if (target === "ai-video") {
      e.preventDefault();
      switchPage("music");
      if (typeof switchMusicView === "function") switchMusicView("ai-video");
      setTopnavActive("video");
      setSidebarsActive("music");
      return;
    }

    e.preventDefault();
    switchPage(target);
  });

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
     PRICING MODAL
     ========================================================= */
  const pricingModal = qs("#pricingModal");
  const creditsButton = qs("#creditsButton");
  const closePricingBtn = qs("#closePricing");
  const pricingBackdrop = pricingModal ? qs(".pricing-backdrop", pricingModal) : null;

  function openPricing() {
    if (!pricingModal) return;
    pricingModal.classList.add("is-open");
  }

  function closePricing() {
    if (!pricingModal) return;
    pricingModal.classList.remove("is-open");
  }

  if (creditsButton) {
    creditsButton.addEventListener("click", (e) => {
      e.preventDefault();
      openPricing();
    });
  }

  if (closePricingBtn) {
    closePricingBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closePricing();
    });
  }

  if (pricingBackdrop) {
    pricingBackdrop.addEventListener("click", () => closePricing());
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (pricingModal?.classList.contains("is-open")) closePricing();
      if (mediaModal?.classList.contains("is-open")) closeMediaModal();
    }
  });

  /* =========================================================
     MEDIA MODAL (Video + Kapak preview)
     ========================================================= */
  const mediaModal = qs("#mediaModal");
  const mediaStage = qs("#mediaStage");

  function openMediaModal(node) {
    if (!mediaModal || !mediaStage) return;
    mediaStage.innerHTML = "";
    mediaStage.appendChild(node);
    mediaModal.classList.add("is-open");
    mediaModal.setAttribute("aria-hidden", "false");
  }

  function closeMediaModal() {
    if (!mediaModal || !mediaStage) return;
    mediaModal.classList.remove("is-open");
    mediaModal.setAttribute("aria-hidden", "true");
    mediaStage.innerHTML = "";
  }

  if (mediaModal) {
    qsa("[data-media-close]", mediaModal).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeMediaModal();
      });
    });
  }

  /* =========================================================
     RIGHT PANEL LISTS (Müzik / Video / Kayıt)
     ========================================================= */
  const rightTitle = qs("#rightPanelTitle");
  const rightSubtitle = qs("#rightPanelSubtitle");

  const musicList = qs("#musicList");
  const videoList = qs("#videoList");
  const recordList = qs("#recordList");

  const musicEmpty = qs("#musicEmpty");
  const videoEmpty = qs("#videoEmpty");
  const recordEmpty = qs("#recordEmpty");

  function setRightPanelMode(mode) {
    const isMusic = mode === "music";
    const isVideo = mode === "video";
    const isRecord = mode === "record";

    if (rightTitle) rightTitle.textContent = isMusic ? "Müziklerim" : isVideo ? "Videolarım" : "Kayıtlarım";
    if (rightSubtitle) rightSubtitle.textContent = isMusic ? "Son üretilen müzikler" : isVideo ? "Son üretilen videolar" : "Son kayıtlar";

    if (musicList) musicList.classList.toggle("hidden", !isMusic);
    if (videoList) videoList.classList.toggle("hidden", !isVideo);
    if (recordList) recordList.classList.toggle("hidden", !isRecord);
  }

  function refreshEmptyStates() {
    if (musicEmpty && musicList) musicEmpty.style.display = musicList.querySelector(".media-item") ? "none" : "flex";
    if (videoEmpty && videoList) videoEmpty.style.display = videoList.querySelector(".media-item") ? "none" : "flex";
    if (recordEmpty && recordList) recordEmpty.style.display = recordList.querySelector(".media-item") ? "none" : "flex";
  }

  function createIconButton(symbol, aria, extraClass = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `media-ico ${extraClass}`.trim();
    btn.textContent = symbol;
    btn.setAttribute("aria-label", aria);
    return btn;
  }

  function createMusicItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    item.className = "media-item music-item";
    item.dataset.kind = "music";
    item.dataset.status = placeholder ? "pending" : "ready";

    const playBtn = createIconButton("▶", "Oynat/Duraklat");
    const downloadBtn = createIconButton("⬇", "İndir");
    const delBtn = createIconButton("✖", "Sil", "danger");

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.gap = "10px";
    left.style.alignItems = "center";

    playBtn.style.width = "46px";
    playBtn.style.height = "46px";
    playBtn.style.borderRadius = "999px";

    const right = document.createElement("div");
    right.className = "icon-row";
    right.appendChild(downloadBtn);
    right.appendChild(delBtn);

    left.appendChild(playBtn);
    item.appendChild(left);
    item.appendChild(right);

    if (placeholder) {
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      let isPlaying = false;
      playBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? "❚❚" : "▶";
      });
      downloadBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Music download (placeholder)");
      });
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  function createVideoItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    item.className = "media-item video-item";
    item.dataset.kind = "video";
    item.dataset.status = placeholder ? "pending" : "ready";

    const overlay = document.createElement("div");
    overlay.className = "media-overlay";

    const play = document.createElement("button");
    play.type = "button";
    play.className = "play-overlay";
    play.textContent = "▶";
    play.setAttribute("aria-label", "Oynat");

    const row = document.createElement("div");
    row.className = "icon-row";

    const downloadBtn = createIconButton("⬇", "İndir");
    const expandBtn = createIconButton("🔍", "Büyüt");
    const delBtn = createIconButton("✖", "Sil", "danger");

    row.appendChild(downloadBtn);
    row.appendChild(expandBtn);
    row.appendChild(delBtn);

    overlay.appendChild(play);
    overlay.appendChild(row);
    item.appendChild(overlay);

    if (placeholder) {
      play.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      expandBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      const openPreview = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const v = document.createElement("video");
        v.controls = true;
        v.autoplay = true;
        v.muted = true;
        openMediaModal(v);
      };

      play.addEventListener("click", openPreview);
      expandBtn.addEventListener("click", openPreview);
      downloadBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Video download (placeholder)");
      });
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  function createRecordItem({ placeholder = false } = {}) {
    const item = document.createElement("div");
    item.className = "media-item record-item";
    item.dataset.kind = "record";
    item.dataset.status = placeholder ? "pending" : "ready";

    const playBtn = createIconButton("▶", "Oynat");
    const row = document.createElement("div");
    row.className = "icon-row";

    const downloadBtn = createIconButton("⬇", "İndir");
    const toMusicBtn = createIconButton("🎵", "Müzikte referans");
    const delBtn = createIconButton("✖", "Sil", "danger");

    row.appendChild(downloadBtn);
    row.appendChild(toMusicBtn);
    row.appendChild(delBtn);

    item.appendChild(playBtn);
    item.appendChild(row);

    if (placeholder) {
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      toMusicBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      playBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Record play (placeholder)");
      });
      downloadBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("Record download (placeholder)");
      });
      toMusicBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        switchPage("music");
        switchMusicView("geleneksel");
        setRightPanelMode("music");
      });
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  function addPlaceholderAndActivate(listEl, itemFactory, activateDelay = 1400) {
    if (!listEl) return;
    const placeholder = itemFactory({ placeholder: true });
    listEl.prepend(placeholder);
    refreshEmptyStates();

    setTimeout(() => {
      const ready = itemFactory({ placeholder: false });
      placeholder.replaceWith(ready);
      refreshEmptyStates();
    }, activateDelay);
  }

  /* =========================================================
   MUSIC SUBVIEWS (Geleneksel / Ses Kaydı / AI Video)
   ========================================================= */
  const musicViews = qsa(".music-view");
  const musicTabButtons = qsa(".sidebar-sublink[data-music-tab]");

  let recordController = null;

  function switchMusicView(targetKey) {
    if (!targetKey) return;

    /* ---- MUSIC VIEW GÖSTER / GİZLE ---- */
    musicViews.forEach((view) => {
      const key = view.getAttribute("data-music-view");
      view.classList.toggle("is-active", key === targetKey);
    });

    /* ✅ SIDEBAR SUBTAB AKTİFLİĞİ (TOPBAR'dan gelince de seçsin) */
    if (musicTabButtons && musicTabButtons.length) {
      musicTabButtons.forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-music-tab") === targetKey);
      });
    }

    /* ---- RIGHT PANEL MODE ---- */
    if (targetKey === "geleneksel") setRightPanelMode("music");
    if (targetKey === "ses-kaydi") setRightPanelMode("record");
    if (targetKey === "ai-video") setRightPanelMode("video");

    /* ---- AI VIDEO DEFAULT TAB ---- */
    if (targetKey === "ai-video") {
      ensureVideoDefaultTab();
    }

    /* ---- RECORD TEMİZLE ---- */
    if (recordController && targetKey !== "ses-kaydi") {
      recordController.forceStopAndReset();
    }

    refreshEmptyStates();

    /* =====================================================
       ✅ ÜST MENÜ IŞIĞI (KIRILMAYAN / GÜVENLİ)
       ===================================================== */
    try {
      const topMusic = qs('.topnav-link[data-page-link="music"]');
      const topVideo = qs('.topnav-link[data-page-link="video"]');

      if (topMusic && topVideo) {
        const isVideo = targetKey === "ai-video";
        topVideo.classList.toggle("is-active", isVideo);
        topMusic.classList.toggle("is-active", !isVideo);
      }
    } catch (e) {
      // sessiz geç – UI kırılmasın
    }
  }

  /* ---- SIDEBAR TAB CLICK ---- */
  if (musicViews.length && musicTabButtons.length) {
    musicTabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.getAttribute("data-music-tab");
        if (!target) return;

        musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));

        switchMusicView(target);
      });
    });

    /* ---- DEFAULT: GELENEKSEL ---- */
    if (!qs(".music-view.is-active")) {
      switchMusicView("geleneksel");
      const first = qs('.sidebar-sublink[data-music-tab="geleneksel"]');
      if (first) {
        musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === first));
      }
    } else {
      const current = qs(".music-view.is-active")?.getAttribute("data-music-view");
      if (current) {
        switchMusicView(current);
        const btn = qs(`.sidebar-sublink[data-music-tab="${current}"]`);
        if (btn) {
          musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        }
      }
    }
  }

  /* =========================================================
     MUSIC GENERATE
     ========================================================= */
  const musicGenerateBtn = qs("#musicGenerateBtn");
  if (musicGenerateBtn) {
    musicGenerateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setRightPanelMode("music");
      if (musicGenerateBtn.classList.contains("is-loading")) return;

      const originalText = musicGenerateBtn.textContent;
      musicGenerateBtn.classList.add("is-loading");
      musicGenerateBtn.textContent = "Üretiliyor...";

      addPlaceholderAndActivate(musicList, createMusicItem, 1200);

      setTimeout(() => {
        musicGenerateBtn.classList.remove("is-loading");
        musicGenerateBtn.textContent = originalText;
        console.log("Müzik üretim isteği burada API'ye gidecek.");
      }, 1200);
    });
  }

  /* =========================================================
     RECORDING VIEW (UI-only)
     ========================================================= */
  const sesView = qs('.music-view[data-music-view="ses-kaydi"]');
  if (sesView) {
    const mainCard = qs(".record-main-card", sesView);
    const circle = qs(".record-circle", sesView);
    const button = qs(".record-btn", sesView);
    const title = qs(".record-main-title", sesView);
    const timerEl = qs(".record-timer", sesView);

    const resultCard = qs("#recordResult", sesView);
    const resultTimeEl = qs("#recordResultTime", sesView);

    const playBtn = qs('[data-record-action="play"]', sesView);
    const downloadBtn = qs('[data-record-action="download"]', sesView);
    const toMusicBtn = qs('[data-record-action="to-music"]', sesView);
    const deleteBtn = qs('[data-record-action="delete"]', sesView);

    let isRecording = false;
    let timerInterval = null;
    let startTime = 0;
    let lastDurationMs = 0;

    function formatTime(ms) {
      const totalSec = Math.floor(ms / 1000);
      const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
      const sec = String(totalSec % 60).padStart(2, "0");
      return `${min}:${sec}`;
    }

    function setResultVisible(visible) {
      if (!resultCard) return;
      resultCard.style.display = visible ? "flex" : "none";
    }

    function startTimer() {
      if (!timerEl) return;
      startTime = Date.now();
      timerEl.textContent = "00:00";
      if (timerInterval) clearInterval(timerInterval);

      timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        timerEl.textContent = formatTime(diff);
      }, 200);
    }

    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      lastDurationMs = startTime ? Date.now() - startTime : 0;
      startTime = 0;
    }

    function applyUIRecordingState(active) {
      isRecording = active;

      if (circle) circle.classList.toggle("is-recording", isRecording);
      if (mainCard) mainCard.classList.toggle("is-recording", isRecording);

      if (title) title.textContent = isRecording ? "Kayıt Devam Ediyor" : "Ses Kaydetmeye Başlayın";
      if (button) button.textContent = isRecording ? "⏹ Kaydı Durdur" : "⏺ Kaydı Başlat";

      document.body.classList.toggle("is-recording", isRecording);

      if (isRecording) {
        setResultVisible(false);
        startTimer();
      } else {
        stopTimer();

        if (lastDurationMs >= 500 && resultTimeEl) {
          resultTimeEl.textContent = formatTime(lastDurationMs);
          setResultVisible(true);

          setRightPanelMode("record");
          if (recordList) {
            recordList.prepend(createRecordItem({ placeholder: false }));
            refreshEmptyStates();
          }
        } else {
          setResultVisible(false);
        }
      }
    }

    function toggleRecording() {
      applyUIRecordingState(!isRecording);
    }

    setResultVisible(false);

    if (circle) {
      circle.style.cursor = "pointer";
      circle.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRecording();
      });
    }

    if (button) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRecording();
      });
    }

    if (playBtn) playBtn.addEventListener("click", () => console.log("Play (placeholder)"));
    if (downloadBtn) downloadBtn.addEventListener("click", () => console.log("Download (placeholder)"));
    if (toMusicBtn)
      toMusicBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchPage("music");
        switchMusicView("geleneksel");
        setRightPanelMode("music");
        console.log("Kayıt, müzik referansına taşınacak (backend ile).");
      });
    if (deleteBtn)
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setResultVisible(false);
      });

    recordController = {
      forceStopAndReset() {
        if (isRecording) applyUIRecordingState(false);

        document.body.classList.remove("is-recording");
        if (circle) circle.classList.remove("is-recording");
        if (mainCard) mainCard.classList.remove("is-recording");
        if (title) title.textContent = "Ses Kaydetmeye Başlayın";
        if (button) button.textContent = "⏺ Kaydı Başlat";
        if (timerEl) timerEl.textContent = "00:00";
        setResultVisible(false);

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        startTime = 0;
        lastDurationMs = 0;
        isRecording = false;
      },
    };
  }

  /* =========================================================
     AI VIDEO TABS + COUNTERS + GENERATE
     ========================================================= */
  const videoTabs = qsa(".video-tab[data-video-tab]");
  const videoViews = qsa(".video-view[data-video-view]");

  function switchVideoTab(target) {
    videoTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.videoTab === target));
    videoViews.forEach((view) => view.classList.toggle("is-active", view.dataset.videoView === target));
  }
  function ensureVideoDefaultTab() {
    // Eğer hiçbir video-view aktif değilse, ilk tab/view'i otomatik aç
    const hasActive = document.querySelector(".video-view.is-active");
    if (hasActive) return;

    const firstTab = videoTabs[0]?.dataset.videoTab;
    if (firstTab) switchVideoTab(firstTab);
  }

  videoTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      // Sayfa ilk yüklenince de default tab'ı seç
      ensureVideoDefaultTab();

      const target = tab.dataset.videoTab;
      if (!target) return;
      switchVideoTab(target);
    });
  });

  function bindCounter(textareaId, counterId, max) {
    const textarea = qs(`#${textareaId}`);
    const counter = qs(`#${counterId}`);
    if (!textarea || !counter) return;

    const update = () => {
      counter.textContent = `${textarea.value.length} / ${max}`;
    };
    textarea.addEventListener("input", update);
    update();
  }

  bindCounter("videoPrompt", "videoPromptCounter", 1000);
  bindCounter("videoImagePrompt", "videoImagePromptCounter", 500);

  function attachVideoGenerate(btnId, loadingText, delay = 1400) {
    const btn = qs(`#${btnId}`);
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setRightPanelMode("video");
      if (btn.classList.contains("is-loading")) return;

      const original = btn.textContent;
      btn.classList.add("is-loading");
      btn.textContent = loadingText;

      addPlaceholderAndActivate(videoList, createVideoItem, delay);

      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.textContent = original;
        console.log("AI Video isteği burada API'ye gidecek.");
      }, delay);
    });
  }

  attachVideoGenerate("videoGenerateTextBtn", "🎬 Video Oluşturuluyor...", 1400);
  attachVideoGenerate("videoGenerateImageBtn", "🎞 Video Oluşturuluyor...", 1600);

  const imageInput = qs("#videoImageInput");
  if (imageInput) {
    imageInput.addEventListener("change", () => {
      if (!imageInput.files || !imageInput.files[0]) return;
      console.log("Seçilen görsel:", imageInput.files[0].name);
    });
  }

  /* =========================================================
     COVER GENERATE + GALLERY ITEMS
     ========================================================= */
  const coverGenerateBtn = qs("#coverGenerateBtn");
  const coverGallery = qs("#coverGallery");

  function createCoverGalleryItem({ placeholder = false } = {}) {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.dataset.status = placeholder ? "pending" : "ready";

    const thumb = document.createElement("div");
    thumb.className = "gallery-thumb";
    thumb.style.background = placeholder
      ? "rgba(108,92,231,0.18)"
      : "linear-gradient(135deg, rgba(108,92,231,0.85), rgba(0,206,201,0.75))";

    const overlay = document.createElement("div");
    overlay.className = "media-overlay";

    const expandBtn = document.createElement("button");
    expandBtn.className = "media-ico";
    expandBtn.type = "button";
    expandBtn.textContent = "🔍";
    expandBtn.setAttribute("aria-label", "Büyüt");

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "media-ico";
    downloadBtn.type = "button";
    downloadBtn.textContent = "⬇";
    downloadBtn.setAttribute("aria-label", "İndir");

    const delBtn = document.createElement("button");
    delBtn.className = "media-ico danger";
    delBtn.type = "button";
    delBtn.textContent = "✖";
    delBtn.setAttribute("aria-label", "Sil");

    overlay.appendChild(expandBtn);
    overlay.appendChild(downloadBtn);
    overlay.appendChild(delBtn);

    card.appendChild(thumb);
    card.appendChild(overlay);

    if (placeholder) {
      expandBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      expandBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const img = document.createElement("img");
        openMediaModal(img);
      });

      downloadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Cover download (placeholder)");
      });

      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.remove();
      });
    }

    return card;
  }

  if (coverGenerateBtn) {
    coverGenerateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (coverGenerateBtn.classList.contains("is-loading")) return;

      const originalText = coverGenerateBtn.textContent;
      coverGenerateBtn.classList.add("is-loading");
      coverGenerateBtn.textContent = "Üretiliyor...";

      if (coverGallery) {
        const placeholder = createCoverGalleryItem({ placeholder: true });
        coverGallery.prepend(placeholder);

        setTimeout(() => {
          const ready = createCoverGalleryItem({ placeholder: false });
          placeholder.replaceWith(ready);
          coverGenerateBtn.classList.remove("is-loading");
          coverGenerateBtn.textContent = originalText;
          console.log("Kapak üretim isteği burada görsel AI API'ye gidecek.");
        }, 1400);
      } else {
        setTimeout(() => {
          coverGenerateBtn.classList.remove("is-loading");
          coverGenerateBtn.textContent = originalText;
        }, 1000);
      }
    });
  }

  /* =========================================================
     INITIAL SYNC (active page)
     ========================================================= */
  const initialActive = getActivePageKey();

  if (!initialActive) {
    // ✅ HTML'de is-active yoksa: ilk açılış music
    switchPage("music");
  } else {
    setTopnavActive(initialActive);
    setSidebarsActive(initialActive);

    if (initialActive === "music") {
      const currentView = qs(".music-view.is-active")?.getAttribute("data-music-view") || "geleneksel";
      switchMusicView(currentView);
    }
  }

  refreshEmptyStates();

  /* =========================================================
     SIDEBAR TEXT PATCH (accordion / subview uyumlu)
     - "Müzik Üret" başlığını: "AI Üret"
     - "Geleneksel": "AI Müzik (Geleneksel)"
     - "Ses Kaydı": "AI Ses Kaydı"
     - "Kapak Üret": "AI Kapak Üret"
     ========================================================= */
  (function patchSidebarTexts() {
    const mapExact = new Map([
      ["Geleneksel", "AI Müzik (Geleneksel)"],
      ["Ses Kaydı", "AI Ses Kaydı"],
      ["Kapak Üret", "AI Kapak Üret"],
      // zaten AI ile gelenler (dokunmasak da olur)
      ["AI Video Üret", "AI Video Üret"],
      ["AI Kapak Üret", "AI Kapak Üret"],
    ]);

    function normalize(s) {
      return (s || "").replace(/\s+/g, " ").trim();
    }

    function applyOnce(root) {
      if (!root) return;

      const nodes = root.querySelectorAll("button, a, span, div");
      nodes.forEach((node) => {
        const raw = normalize(node.textContent);
        if (!raw) return;

        // 1) Birebir eşleşenleri değiştir
        if (mapExact.has(raw)) {
          const span = node.querySelector && node.querySelector("span");
          if (span && normalize(span.textContent) === raw) {
            span.textContent = mapExact.get(raw);
          } else if (node.childElementCount === 0) {
            node.textContent = mapExact.get(raw);
          }
          return; // ✅ eşleştiyse devam etme
        }

        // 2) Başlık ikon/ok yüzünden birebir olmayabilir:
        // İçinde "Müzik Üret" geçiyorsa "AI Üret" yap
        if (raw.includes("Müzik Üret")) {
          const span2 = node.querySelector && node.querySelector("span");
          if (span2 && normalize(span2.textContent).includes("Müzik Üret")) {
            span2.textContent = "AI Üret";
          } else if (node.childElementCount === 0) {
            node.textContent = "AI Üret";
          }
        }
      });
    }

    function run() {
      const sidebar =
        document.querySelector(".page.is-active .sidebar") || document.querySelector(".sidebar");
      if (!sidebar) return;
      applyOnce(sidebar);
    }

    run();

    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      const obs = new MutationObserver(() => run());
      obs.observe(sidebar, { childList: true, subtree: true, characterData: true });
    }

    setTimeout(run, 50);
    setTimeout(run, 250);
    setTimeout(run, 600);
  })();
  /* =========================================================
   GLOBAL PLAYER (Music + Record only)
   ========================================================= */
const gp = {
  root: qs("#globalPlayer"),
  audio: qs("#gpAudio"),
  title: qs("#gpTitle"),
  sub: qs("#gpSub"),
  play: qs("#gpPlay"),
  prev: qs("#gpPrev"),
  next: qs("#gpNext"),
  close: qs("#gpClose"),
  seek: qs("#gpSeek"),
  cur: qs("#gpCur"),
  dur: qs("#gpDur"),
  vol: qs("#gpVol"),
  queue: [],
  idx: -1,
};

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function gpShow() {
  if (!gp.root) return;
  gp.root.classList.remove("is-hidden");
  gp.root.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-global-player");
}

function gpHide() {
  if (!gp.root) return;
  gp.root.classList.add("is-hidden");
  gp.root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-global-player");
}

function gpSetTrack(track) {
  if (!track) return;
  if (gp.title) gp.title.textContent = track.title || "Parça";
  if (gp.sub) gp.sub.textContent = track.sub || "AI Müzik / Ses Kaydı";

  // src yoksa sadece UI açılır (backend bağlanınca src gelecek)
  if (gp.audio && track.src) {
    gp.audio.src = track.src;
  }
}

function gpPlayPause(forcePlay = null) {
  if (!gp.audio) return;

  const shouldPlay = forcePlay === null ? gp.audio.paused : forcePlay;

  if (shouldPlay) {
    gp.audio.play().catch(() => {});
    if (gp.play) gp.play.textContent = "❚❚";
  } else {
    gp.audio.pause();
    if (gp.play) gp.play.textContent = "▶";
  }
}

function gpOpenWithQueue(queue, startIndex = 0) {
  gp.queue = Array.isArray(queue) ? queue : [];
  gp.idx = Math.max(0, Math.min(startIndex, gp.queue.length - 1));

  const t = gp.queue[gp.idx];
  gpSetTrack(t);
  gpShow();
  gpPlayPause(true);
}

/* Player butonları */
if (gp.play) gp.play.addEventListener("click", () => gpPlayPause(null));
if (gp.close) gp.close.addEventListener("click", () => { gpPlayPause(false); gpHide(); });

if (gp.prev) gp.prev.addEventListener("click", () => {
  if (!gp.queue.length) return;
  gp.idx = (gp.idx - 1 + gp.queue.length) % gp.queue.length;
  gpSetTrack(gp.queue[gp.idx]);
  gpPlayPause(true);
});

if (gp.next) gp.next.addEventListener("click", () => {
  if (!gp.queue.length) return;
  gp.idx = (gp.idx + 1) % gp.queue.length;
  gpSetTrack(gp.queue[gp.idx]);
  gpPlayPause(true);
});

if (gp.vol && gp.audio) {
  gp.audio.volume = Number(gp.vol.value || 0.9);
  gp.vol.addEventListener("input", () => {
    gp.audio.volume = Number(gp.vol.value || 0.9);
  });
}

/* Seek + zaman */
if (gp.audio) {
  gp.audio.addEventListener("loadedmetadata", () => {
    if (gp.dur) gp.dur.textContent = fmtTime(gp.audio.duration);
  });

  gp.audio.addEventListener("timeupdate", () => {
    if (gp.cur) gp.cur.textContent = fmtTime(gp.audio.currentTime);
    if (gp.seek && isFinite(gp.audio.duration) && gp.audio.duration > 0) {
      gp.seek.value = String((gp.audio.currentTime / gp.audio.duration) * 100);
    }
  });

  gp.audio.addEventListener("ended", () => {
    if (!gp.queue.length) { gpPlayPause(false); return; }
    gp.idx = (gp.idx + 1) % gp.queue.length;
    gpSetTrack(gp.queue[gp.idx]);
    gpPlayPause(true);
  });
}

if (gp.seek && gp.audio) {
  gp.seek.addEventListener("input", () => {
    if (!isFinite(gp.audio.duration) || gp.audio.duration <= 0) return;
    const pct = Number(gp.seek.value || 0);
    gp.audio.currentTime = (pct / 100) * gp.audio.duration;
  });
}

/* =========================================================
   Yalnızca: geleneksel + ses-kaydi ekranlarında player göster
   - Suno gibi: bu ekranlarda bar görünür (track seçilince çalar)
   ========================================================= */
function shouldPlayerBeAllowed() {
  const activeView = qs(".music-view.is-active")?.getAttribute("data-music-view");
  return activeView === "geleneksel" || activeView === "ses-kaydi";
}

/* switchMusicView çalışınca görünürlük kontrolü */
const _origSwitchMusicView = typeof switchMusicView === "function" ? switchMusicView : null;
if (_origSwitchMusicView) {
  window.switchMusicView = function patchedSwitchMusicView(key) {
    _origSwitchMusicView(key);

    const allow = shouldPlayerBeAllowed();

    // ✅ İzinli ekranlarda bar görünsün (track yoksa "Bir parça seç" yazar)
    if (allow) {
      gpShow();
      if (gp.play) gp.play.textContent = gp.audio && !gp.audio.paused ? "❚❚" : "▶";
    } else {
      // ✅ İzinli değilsek kapat/gizle
      gpPlayPause(false);
      gpHide();
    }
  };
}

/* =========================================================
   Şimdilik demo: Music/Record list item tıklanınca player aç
   - Backend gelince item.dataset.src gibi bir yerden src verirsin.
   ========================================================= */
function bindGlobalPlayerToLists() {
  // Music list: play ikonuna basınca
  if (musicList) {
    musicList.addEventListener("click", (e) => {
      const btn = e.target.closest(".media-ico");
      const item = e.target.closest(".media-item.music-item");
      if (!btn || !item) return;

      if (!shouldPlayerBeAllowed()) return;

      const src = item.dataset.src || "";
      gpOpenWithQueue([{ title: "Üretilen Müzik", sub: "AI Müzik (Geleneksel)", src }], 0);
    });
  }

  // Record list: play ikonuna basınca
  if (recordList) {
    recordList.addEventListener("click", (e) => {
      const btn = e.target.closest(".media-ico, button");
      const item = e.target.closest(".media-item.record-item");
      if (!btn || !item) return;

      if (!shouldPlayerBeAllowed()) return;

      const src = item.dataset.src || "";
      gpOpenWithQueue([{ title: "Ses Kaydı", sub: "AI Ses Kaydı", src }], 0);
    });
  }
}

bindGlobalPlayerToLists();

/* ✅ İlk açılışta da doğru görünürlük */
if (shouldPlayerBeAllowed()) gpShow();
else gpHide();

}); // ✅ SADECE 1 TANE KAPANIŞ (DOMContentLoaded)
/* =========================================================
   AI SES KAYDI – Timer + UI Toggle (record-btn / recBadge)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const view = document.querySelector('.music-view[data-music-view="ses-kaydi"]');
  if (!view) return;

  const card     = view.querySelector(".record-main-card");
  const btn      = view.querySelector(".record-btn");
  const circle   = view.querySelector(".record-circle");
  const badge    = view.querySelector("#recBadge");

  // Eğer buton yoksa çık
  if (!btn) return;

  let isRecording = false;
  let startTs = 0;
  let tickId = null;

  // --- yardımcılar ---
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmt = (ms) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  };

  const setRecordingUI = (on) => {
    isRecording = on;

    // Ring / sayfa class (CSS'in bunu kullanıyor)
    view.classList.toggle("is-recording", on);
    card?.classList.toggle("is-recording", on);

    // Badge görünür/gizli
    if (badge) {
      badge.style.display = on ? "block" : "none";
      if (!on) badge.textContent = "00:00";
    }

    // Buton metni
    btn.innerHTML = on ? "⏹ Kaydı Durdur" : "⏺ Kaydı Başlat";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  };

  const startTimer = () => {
    startTs = Date.now();
    if (badge) {
      badge.style.display = "block";
      badge.textContent = "00:00";
    }
    clearInterval(tickId);
    tickId = setInterval(() => {
      const elapsed = Date.now() - startTs;
      if (badge) badge.textContent = fmt(elapsed);
    }, 250);
  };

  const stopTimer = () => {
    clearInterval(tickId);
    tickId = null;
  };

  // --- Ana toggle ---
  const toggleRecording = async () => {
    if (!isRecording) {
      // BAŞLAT
      setRecordingUI(true);
      startTimer();

      // Eğer ileride gerçek MediaRecorder bağlamak istersen:
      // burada navigator.mediaDevices.getUserMedia / MediaRecorder start olacak.
    } else {
      // DURDUR
      setRecordingUI(false);
      stopTimer();

      // MediaRecorder stop burada olacak.
    }
  };

  // Buton tıklayınca
  btn.addEventListener("click", toggleRecording);

  // İstersen circle tıklaması da başlat/durdur yapsın (opsiyonel)
  if (circle) {
    circle.addEventListener("click", toggleRecording);
  }

  // İlk yükleme
  setRecordingUI(false);
});
