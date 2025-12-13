// AIVO STUDIO – STUDIO.JS (FINAL)
// - Sayfa geçişleri stabil
// - Sol menü sekmeleri: Geleneksel / Ses Kaydı / AI Video
// - Sağ panel sadece aktif bölümün çıktısını gösterir (müzik/video/kayıt ayrı)
// - "Üretiliyor" placeholder metinsiz: aynı kart aktifleşir
// - Animasyon minimum (CSS tarafında)
// - Media preview modal (video + kapak)

document.addEventListener("DOMContentLoaded", () => {
  /* =========================================
     SAYFA GEÇİŞLERİ (MÜZİK / KAPAK)
     ========================================= */
  const pages = document.querySelectorAll(".page");
  const pageLinks = document.querySelectorAll("[data-page-link]");

  function switchPage(target) {
    pages.forEach((p) => p.classList.toggle("is-active", p.dataset.page === target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  pageLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = link.getAttribute("data-page-link");
      if (!target) return;
      e.preventDefault();

      pageLinks.forEach((l) => {
        if (!l.hasAttribute("data-open-pricing")) l.classList.remove("is-active");
      });

      if (!link.hasAttribute("data-open-pricing")) link.classList.add("is-active");
      switchPage(target);
    });
  });

  /* =========================================
     ÇALIŞMA MODU (BASİT / GELİŞMİŞ)
     ========================================= */
  const body = document.body;
  const modeButtons = document.querySelectorAll("[data-mode-button]");
  const advancedSections = document.querySelectorAll("[data-visible-in='advanced']");
  const basicSections = document.querySelectorAll("[data-visible-in='basic']");

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

  updateMode("advanced");

  /* =========================================
     KREDİ MODALI
     ========================================= */
  const pricingModal = document.getElementById("pricingModal");
  const creditsButton = document.getElementById("creditsButton");
  const closePricing = document.getElementById("closePricing");
  const openPricingLinks = document.querySelectorAll("[data-open-pricing]");

  function openPricing() {
    if (!pricingModal) return;
    pricingModal.classList.add("is-open");
  }
  function closePricingModal() {
    if (!pricingModal) return;
    pricingModal.classList.remove("is-open");
  }

  if (creditsButton) {
    creditsButton.addEventListener("click", (e) => {
      e.preventDefault();
      openPricing();
    });
  }
  openPricingLinks.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openPricing();
    });
  });
  if (closePricing) {
    closePricing.addEventListener("click", (e) => {
      e.preventDefault();
      closePricingModal();
    });
  }
  if (pricingModal) {
    const backdrop = pricingModal.querySelector(".pricing-backdrop");
    if (backdrop) backdrop.addEventListener("click", closePricingModal);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && pricingModal.classList.contains("is-open")) {
        closePricingModal();
      }
    });
  }

  /* =========================================
     MEDIA MODAL (Video + Kapak)
     ========================================= */
  const mediaModal = document.getElementById("mediaModal");
  const mediaStage = document.getElementById("mediaStage");

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
    mediaModal.querySelectorAll("[data-media-close]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeMediaModal();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mediaModal.classList.contains("is-open")) {
        closeMediaModal();
      }
    });
  }

  /* =========================================
     SAĞ PANEL (Müzik / Video / Kayıt listeleri)
     ========================================= */
  const rightTitle = document.getElementById("rightPanelTitle");
  const rightSubtitle = document.getElementById("rightPanelSubtitle");

  const musicList = document.getElementById("musicList");
  const videoList = document.getElementById("videoList");
  const recordList = document.getElementById("recordList");

  const musicEmpty = document.getElementById("musicEmpty");
  const videoEmpty = document.getElementById("videoEmpty");
  const recordEmpty = document.getElementById("recordEmpty");

  function setRightPanelMode(mode) {
    // mode: "music" | "video" | "record"
    const isMusic = mode === "music";
    const isVideo = mode === "video";
    const isRecord = mode === "record";

    if (rightTitle) {
      rightTitle.textContent = isMusic ? "Müziklerim" : isVideo ? "Videolarım" : "Kayıtlarım";
    }
    if (rightSubtitle) {
      rightSubtitle.textContent = isMusic ? "Son üretilen müzikler" : isVideo ? "Son üretilen videolar" : "Son kayıtlar";
    }

    if (musicList) musicList.classList.toggle("hidden", !isMusic);
    if (videoList) videoList.classList.toggle("hidden", !isVideo);
    if (recordList) recordList.classList.toggle("hidden", !isRecord);
  }

  function refreshEmptyStates() {
    if (musicEmpty && musicList) {
      const hasItem = !!musicList.querySelector(".media-item");
      musicEmpty.style.display = hasItem ? "none" : "flex";
    }
    if (videoEmpty && videoList) {
      const hasItem = !!videoList.querySelector(".media-item");
      videoEmpty.style.display = hasItem ? "none" : "flex";
    }
    if (recordEmpty && recordList) {
      const hasItem = !!recordList.querySelector(".media-item");
      recordEmpty.style.display = hasItem ? "none" : "flex";
    }
  }

  /* =========================================
     ÜRETİM KARTLARI (metinsiz)
     ========================================= */
  function createIconButton(symbol, aria, extraClass = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `media-ico ${extraClass}`.trim();
    btn.textContent = symbol;
    btn.setAttribute("aria-label", aria);
    return btn;
  }

  // MUSIC ITEM: play/pause + download + delete
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

    // Play/Pause sadece ikon: ▶ / ❚❚
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

    // Placeholder ise pasif
    if (placeholder) {
      playBtn.classList.add("is-disabled");
      downloadBtn.classList.add("is-disabled");
      delBtn.classList.add("is-disabled");
    } else {
      let isPlaying = false;
      playBtn.addEventListener("click", () => {
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? "❚❚" : "▶";
        // Gerçek audio src API'den gelince burada bağlanır
      });

      downloadBtn.addEventListener("click", () => {
        console.log("Music download (placeholder)");
      });

      delBtn.addEventListener("click", () => {
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  // VIDEO ITEM: play overlay + download + expand + delete
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
      play.addEventListener("click", () => {
        // Gerçek video src API'den gelince burada video element açılır.
        const v = document.createElement("video");
        v.controls = true;
        v.autoplay = true;
        v.muted = true;
        // v.src = item.dataset.src; // backend entegrasyonunda doldur
        openMediaModal(v);
      });

      expandBtn.addEventListener("click", () => {
        const v = document.createElement("video");
        v.controls = true;
        v.autoplay = true;
        v.muted = true;
        openMediaModal(v);
      });

      downloadBtn.addEventListener("click", () => {
        console.log("Video download (placeholder)");
      });

      delBtn.addEventListener("click", () => {
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  // RECORD ITEM: play + download + to-music + delete (sağ panel kayıt listesi)
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
      playBtn.addEventListener("click", () => console.log("Record play (placeholder)"));
      downloadBtn.addEventListener("click", () => console.log("Record download (placeholder)"));

      toMusicBtn.addEventListener("click", () => {
        // Kayıt → müzik formuna referans taşımak (MVP)
        const refInput = document.getElementById("refAudio");
        if (refInput) {
          // Gerçekte dosya set edilemez; burada UX akışını temsil ediyoruz.
          console.log("Kayıt, müzik referansına taşınacak (backend ile).");
        }
        // Müzik sekmesine geç
        switchMusicView("geleneksel");
        setRightPanelMode("music");
      });

      delBtn.addEventListener("click", () => {
        item.remove();
        refreshEmptyStates();
      });
    }

    return item;
  }

  // Placeholder ekle + aynı kartı aktive et (metin yok)
  function addPlaceholderAndActivate(listEl, itemFactory, activateDelay = 1400) {
    if (!listEl) return;

    const placeholder = itemFactory({ placeholder: true });
    listEl.prepend(placeholder);
    refreshEmptyStates();

    setTimeout(() => {
      // placeholder'ı "ready" item ile aynı konumda değiştir
      const ready = itemFactory({ placeholder: false });
      placeholder.replaceWith(ready);
      refreshEmptyStates();
    }, activateDelay);
  }

  /* =========================================
     SOL MENÜ – MÜZİK ALT SEKME GEÇİŞLERİ
     (Geleneksel / Ses Kaydı / AI Video)
     ========================================= */
  const musicViews = document.querySelectorAll(".music-view");
  const musicTabButtons = document.querySelectorAll(".sidebar-sublink[data-music-tab]");

  let recordController = null;

  function switchMusicView(targetKey) {
    musicViews.forEach((view) => {
      const key = view.getAttribute("data-music-view");
      view.classList.toggle("is-active", key === targetKey);
    });

    // Sağ panel sadece ilgili çıktı
    if (targetKey === "geleneksel") setRightPanelMode("music");
    if (targetKey === "ai-video") setRightPanelMode("video");
    if (targetKey === "ses-kaydi") setRightPanelMode("record");

    if (recordController && targetKey !== "ses-kaydi") {
      recordController.forceStopAndReset();
    }

    refreshEmptyStates();
  }

  if (musicViews.length && musicTabButtons.length) {
    musicTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-music-tab");
        if (!target) return;

        musicTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        switchMusicView(target);
      });
    });

    switchMusicView("geleneksel");
  }

  /* =========================================
     MÜZİK ÜRET – "Üretiliyor" sağ panele düşer
     ========================================= */
  const musicGenerateBtn = document.getElementById("musicGenerateBtn");
  if (musicGenerateBtn) {
    musicGenerateBtn.addEventListener("click", () => {
      // doğru panelde olduğundan emin ol
      setRightPanelMode("music");

      // buton UI (metin değişimi burada kalabilir)
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

  /* =========================================
     SES KAYDI – GÖRSEL KAYIT DURUMU + sağ panele kayıt ekleme
     ========================================= */
  const sesView = document.querySelector('.music-view[data-music-view="ses-kaydi"]');
  if (sesView) {
    const mainCard = sesView.querySelector(".record-main-card");
    const circle = sesView.querySelector(".record-circle");
    const button = sesView.querySelector(".record-btn");
    const title = sesView.querySelector(".record-main-title");
    const timerEl = sesView.querySelector(".record-timer");

    const resultCard = sesView.querySelector("#recordResult");
    const resultTimeEl = sesView.querySelector("#recordResultTime");

    const playBtn = sesView.querySelector('[data-record-action="play"]');
    const downloadBtn = sesView.querySelector('[data-record-action="download"]');
    const toMusicBtn = sesView.querySelector('[data-record-action="to-music"]');
    const deleteBtn = sesView.querySelector('[data-record-action="delete"]');

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
      lastDurationMs = startTime ? (Date.now() - startTime) : 0;
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

          // Sağ panelde kayıt listesi: placeholder değil, "ready" gibi ekle
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
      circle.addEventListener("click", toggleRecording);
    }
    if (button) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRecording();
      });
    }

    if (playBtn) playBtn.addEventListener("click", () => console.log("Play (placeholder)"));
    if (downloadBtn) downloadBtn.addEventListener("click", () => console.log("Download (placeholder)"));
    if (toMusicBtn) toMusicBtn.addEventListener("click", () => {
      switchMusicView("geleneksel");
      setRightPanelMode("music");
      console.log("Kayıt, müzik referansına taşınacak (backend ile).");
    });
    if (deleteBtn) deleteBtn.addEventListener("click", () => setResultVisible(false));

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

  /* =========================================
     AI VIDEO – TAB + COUNTER + ÜRETİM PLACEHOLDER
     ========================================= */
  const videoTabs = document.querySelectorAll(".video-tab[data-video-tab]");
  const videoViews = document.querySelectorAll(".video-view[data-video-view]");

  function switchVideoTab(target) {
    videoTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.videoTab === target));
    videoViews.forEach((view) => view.classList.toggle("is-active", view.dataset.videoView === target));
  }

  videoTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.videoTab;
      if (!target) return;
      switchVideoTab(target);
    });
  });

  function bindCounter(textareaId, counterId, max) {
    const textarea = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);
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
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener("click", () => {
      setRightPanelMode("video");

      if (btn.classList.contains("is-loading")) return;

      const original = btn.textContent;
      btn.classList.add("is-loading");
      btn.textContent = loadingText;

      // Sağ panel en üste placeholder video kartı (metinsiz)
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

  const imageInput = document.getElementById("videoImageInput");
  if (imageInput) {
    imageInput.addEventListener("change", () => {
      if (!imageInput.files || !imageInput.files[0]) return;
      console.log("Seçilen görsel:", imageInput.files[0].name);
    });
  }

  /* =========================================
     KAPAK – Galeride placeholder + sade ikon aksiyonları
     ========================================= */
  const coverGenerateBtn = document.getElementById("coverGenerateBtn");
  const coverGallery = document.getElementById("coverGallery");

  function createCoverGalleryItem({ placeholder = false } = {}) {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.dataset.status = placeholder ? "pending" : "ready";

    const thumb = document.createElement("div");
    thumb.className = "gallery-thumb";
    // Placeholder ise daha karanlık
    if (placeholder) {
      thumb.style.background = "rgba(108,92,231,0.18)";
    } else {
      // basit örnek gradient
      thumb.style.backgroundImage = "linear-gradient(135deg, rgba(108,92,231,0.85), rgba(0,206,201,0.75))";
    }

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
      expandBtn.addEventListener("click", () => {
        // Gerçek görsel URL API'den gelince img.src bağlanır
        const img = document.createElement("img");
        // img.src = card.dataset.src;
        openMediaModal(img);
      });

      downloadBtn.addEventListener("click", () => console.log("Cover download (placeholder)"));

      delBtn.addEventListener("click", () => card.remove());
    }

    return card;
  }

  if (coverGenerateBtn) {
    coverGenerateBtn.addEventListener("click", () => {
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

  /* =========================================
     İlk boş durumları ayarla
     ========================================= */
  refreshEmptyStates();
});
