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
    // Aynı target’a bağlı birden fazla topnav linki varsa (ör: hepsi "music" ise)
    // hepsini active yapar; mapping düzeltildiğinde doğal olarak tek active kalır.
    qsa(".topnav-link[data-page-link]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-page-link") === target);
    });
  }

  function setSidebarsActive(target) {
    // Birden fazla sayfada sidebar olduğundan önce hepsini temizle
    qsa(".sidebar [data-page-link]").forEach((b) => b.classList.remove("is-active"));

    const activePage = qs(".page.is-active");
    if (!activePage) return;

    qsa(".sidebar [data-page-link]", activePage).forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-page-link") === target);
    });
  }

  function switchPage(target) {
    if (!target) return;

    // Fallback: HTML'de page yoksa ama bazı butonlar "video" gibi hedef veriyorsa
    // sayfayı boşa düşürmeyelim.
    if (!pageExists(target)) {
      if (target === "video") {
        // video ayrı page değil; AI Video müzik içindeki view
        switchPage("music");
        switchMusicView("ai-video");
        return;
      }
      console.warn("[AIVO] switchPage: hedef sayfa yok:", target);
      return;
    }

    qsa(".page").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-page") === target);
    });

    setTopnavActive(target);
    setSidebarsActive(target);

    // Sayfa değişince en üste
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Music sayfasına gelindiyse sağ panel modunu aktif view'e göre toparla
    if (target === "music") {
      const activeMusicView = qs('.music-view.is-active')?.getAttribute("data-music-view") || "geleneksel";
      if (activeMusicView === "geleneksel") setRightPanelMode("music");
      if (activeMusicView === "ses-kaydi") setRightPanelMode("record");
      if (activeMusicView === "ai-video") setRightPanelMode("video");
      refreshEmptyStates();
    }
  }

  /* =========================================================
     GLOBAL CLICK HANDLER (NAV + MODALS)
     ========================================================= */
  document.addEventListener("click", (e) => {
    // 1) Pricing modal trigger
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

  // Varsayılan
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

    musicViews.forEach((view) => {
      const key = view.getAttribute("data-music-view");
      view.classList.toggle("is-active", key === targetKey);
    });

    // Sağ panel modu
    if (targetKey === "geleneksel") setRightPanelMode("music");
    if (targetKey === "ai-video") setRightPanelMode("video");
    if (targetKey === "ses-kaydi") setRightPanelMode("record");

    // Kayıttan çıkınca reset
    if (recordController && targetKey !== "ses-kaydi") recordController.forceStopAndReset();
    refreshEmptyStates();
  }

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

    // Varsayılan: geleneksel
    if (!qs('.music-view.is-active')) {
      switchMusicView("geleneksel");
      const first = qs('.sidebar-sublink[data-music-tab="geleneksel"]');
      if (first) {
        musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === first));
      }
    } else {
      const current = qs('.music-view.is-active')?.getAttribute("data-music-view");
      if (current) {
        switchMusicView(current);
        const btn = qs(`.sidebar-sublink[data-music-tab="${current}"]`);
        if (btn) musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
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
    if (toMusicBtn) toMusicBtn.addEventListener("click", (e) => {
      e.preventDefault();
      switchPage("music");
      switchMusicView("geleneksel");
      setRightPanelMode("music");
      console.log("Kayıt, müzik referansına taşınacak (backend ile).");
    });
    if (deleteBtn) deleteBtn.addEventListener("click", (e) => {
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

  videoTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
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
    // Hiç aktif yoksa music
    switchPage("music");
  } else {
    setTopnavActive(initialActive);
    setSidebarsActive(initialActive);

    // music içindeysek view senkron
    if (initialActive === "music") {
      const currentView = qs(".music-view.is-active")?.getAttribute("data-music-view") || "geleneksel";
      switchMusicView(currentView);
    }
  }

  refreshEmptyStates();
});
