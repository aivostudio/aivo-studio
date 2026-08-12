(function AIVO_MOBILE_RADIO_AD_UI_STATE(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_UI_STATE_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_UI_STATE_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  if (!root || !view) return;

  const durationSelect = view.querySelector("#mobileRadioDuration");
  const formatSelect = view.querySelector("#mobileRadioOutputFormat");
  const action = view.querySelector("[data-mobile-radio-action]");
  const actionButton = action && action.querySelector(".mobile-adfilm-create-button");
  const actionSummary = action && action.querySelector(".mobile-adfilm-action-copy small");
  const musicModeSelect = view.querySelector("#mobileRadioMusicMode");

  const preview = view.querySelector("[data-mobile-radio-preview]");
  const narrationCreateButton = preview && preview.querySelector(".mobile-adfilm-voice-create");
  const narrationApproveButton = preview && preview.querySelector(".mobile-adfilm-voice-approve");
  const narrationStatus = preview && preview.querySelector(".mobile-adfilm-voice-preview-status");
  const narrationProgressLine = preview && preview.querySelector(".mobile-adfilm-voice-preview-line");

  const CREDIT_PRICES = {
    mp3: { 10:10, 15:12, 30:20, 45:28, 60:36 },
    wav: { 10:13, 15:15, 30:25, 45:35, 60:45 }
  };

  let durationTouched = false;
  let narrationProgressRaf = 0;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function notify(message, type){
    try{
      const fn = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof fn === "function") fn(message, type || "info");
    }catch(_){ }
  }

  function currentProject(){
    try{
      const sync = window.AIVOMobileRadioAdProjectSync;
      if (sync && typeof sync.getProject === "function") return sync.getProject();
    }catch(_){ }
    return window.AIVOMobileRadioAdProject || null;
  }

  function duration(){
    const value = Number(durationSelect && durationSelect.value || 10);
    return [10,15,30,45,60].includes(value) ? value : 10;
  }

  function format(){
    return clean(formatSelect && formatSelect.value).toLowerCase() === "wav" ? "wav" : "mp3";
  }

  function price(fmt, seconds){
    const table = CREDIT_PRICES[fmt] || CREDIT_PRICES.mp3;
    return Number(table[seconds] || 0);
  }

  function musicLabel(){
    const mode = clean(musicModeSelect && musicModeSelect.value).toLowerCase();
    if (mode === "off") return "Müziksüz";
    if (mode === "upload") return "Yüklenen müzik";
    return "AIVO müziği";
  }

  function syncFormatOptionLabels(){
    if (!formatSelect) return;
    const seconds = duration();
    const mp3 = formatSelect.querySelector('option[value="mp3"]');
    const wav = formatSelect.querySelector('option[value="wav"]');
    if (mp3) mp3.textContent = "MP3 · 320 kbps · " + price("mp3", seconds) + " Kredi";
    if (wav) wav.textContent = "WAV · Kayıpsız · " + price("wav", seconds) + " Kredi";
  }

  function narrationRequirement(){
    const project = currentProject();
    const audioData = project && project.narration && project.narration.audio;
    const previewState = clean(preview && preview.dataset.state).toLowerCase();
    const hasAudio = !!clean(audioData && (audioData.previewUrl || audioData.url));

    if (previewState === "loading") return "loading";
    if (previewState === "stale") return "regenerate";
    if (!hasAudio) return "generate";
    if (audioData.approved !== true) return "approve";
    return "";
  }

  function syncBuildGuidance(){
    if (!actionButton) return;
    const requirement = narrationRequirement();
    if (requirement && actionButton.disabled) actionButton.disabled = false;
  }

  function guideNarrationRequirement(requirement){
    if (!requirement || !preview) return;

    let message = "Önce konuşma sesini üret.";
    let targetButton = narrationCreateButton;

    if (requirement === "loading") {
      message = "Konuşma sesi hazırlanıyor. Tamamlanmasını bekle.";
    } else if (requirement === "regenerate") {
      message = "Süre veya metin değişti. Konuşma sesini yeniden üret.";
    } else if (requirement === "approve") {
      message = "Önce sesi onayla.";
      targetButton = narrationApproveButton;
    }

    notify(message, "warning");

    try{
      preview.scrollIntoView({ behavior:"smooth", block:"center" });
    }catch(_){
      try{ preview.scrollIntoView(); }catch(__){ }
    }

    if (targetButton){
      setTimeout(function(){
        try{ targetButton.focus({ preventScroll:true }); }catch(_){ }
      }, 420);
    }
  }

  function syncProductionPrice(){
    const seconds = duration();
    const fmt = format();
    const amount = price(fmt, seconds);

    syncFormatOptionLabels();

    if (actionButton){
      actionButton.textContent = "Radyo Reklamını Oluştur (" + amount + " Kredi)";
      actionButton.setAttribute("data-credit-cost", String(amount));
      actionButton.setAttribute("data-credit-duration", String(seconds));
      actionButton.setAttribute("data-credit-format", fmt);
    }

    if (actionSummary){
      actionSummary.textContent = seconds + " sn · Seslendirme · " + musicLabel() + " · " + fmt.toUpperCase() + (fmt === "mp3" ? " 320 kbps" : " Kayıpsız");
    }

    try{
      const production = window.AIVOMobileRadioAdProduction;
      if (production && typeof production.syncButton === "function") {
        const sync = window.AIVOMobileRadioAdProjectSync;
        const project = sync && typeof sync.getProject === "function" ? sync.getProject() : window.AIVOMobileRadioAdProject;
        production.syncButton(project || null);
      }
    }catch(_){ }

    setTimeout(syncBuildGuidance, 0);
  }

  function keepInitialDurationAtTen(){
    if (!durationSelect || durationTouched) return;
    if (durationSelect.value !== "10") durationSelect.value = "10";
    syncProductionPrice();
  }

  function syncNarrationLoadingLabel(){
    if (!preview || !narrationCreateButton) return;
    if (preview.dataset.state !== "loading") return;

    const status = clean(narrationStatus && narrationStatus.textContent).toLowerCase();
    const nextLabel = status.indexOf("düzenlen") >= 0
      ? "Ses düzenleniyor..."
      : "Ses oluşturuluyor...";

    if (narrationCreateButton.textContent !== nextLabel) {
      narrationCreateButton.textContent = nextLabel;
    }
  }

  function narrationAudio(){
    if (!preview) return null;
    return preview.querySelector("[data-mobile-radio-narration-audio]");
  }

  function narrationProgressFill(){
    if (!narrationProgressLine) return null;
    let fill = narrationProgressLine.querySelector("[data-ios-radio-progress-fill]");
    if (fill) return fill;

    narrationProgressLine.style.position = "relative";
    fill = document.createElement("span");
    fill.setAttribute("data-ios-radio-progress-fill", "");
    fill.setAttribute("aria-hidden", "true");
    fill.style.cssText = "position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:inherit;background:linear-gradient(90deg,#8b5cf6,#ec4899);pointer-events:none;transition:width .08s linear;";
    narrationProgressLine.appendChild(fill);
    return fill;
  }

  function stopNarrationProgressRaf(){
    if (!narrationProgressRaf) return;
    cancelAnimationFrame(narrationProgressRaf);
    narrationProgressRaf = 0;
  }

  function syncNarrationProgress(){
    const audio = narrationAudio();
    const fill = narrationProgressFill();
    if (!audio || !fill) return;

    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0;
    const percent = total ? Math.max(0, Math.min(100, current / total * 100)) : 0;
    fill.style.width = percent + "%";
  }

  function runNarrationProgressRaf(){
    stopNarrationProgressRaf();

    function frame(){
      const audio = narrationAudio();
      syncNarrationProgress();
      if (audio && !audio.paused && !audio.ended) {
        narrationProgressRaf = requestAnimationFrame(frame);
      } else {
        narrationProgressRaf = 0;
      }
    }

    narrationProgressRaf = requestAnimationFrame(frame);
  }

  function bindNarrationProgress(){
    const audio = narrationAudio();
    if (!audio || audio.__aivoIosRadioProgressBound) return;
    audio.__aivoIosRadioProgressBound = true;

    narrationProgressFill();
    audio.addEventListener("loadedmetadata", syncNarrationProgress);
    audio.addEventListener("durationchange", syncNarrationProgress);
    audio.addEventListener("timeupdate", syncNarrationProgress);
    audio.addEventListener("play", runNarrationProgressRaf);
    audio.addEventListener("pause", function(){
      stopNarrationProgressRaf();
      syncNarrationProgress();
    });
    audio.addEventListener("ended", function(){
      stopNarrationProgressRaf();
      syncNarrationProgress();
    });

    syncNarrationProgress();
  }

  if (actionButton){
    actionButton.addEventListener("click", function(event){
      const requirement = narrationRequirement();
      if (!requirement) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      guideNarrationRequirement(requirement);
    }, true);
  }

  if (durationSelect){
    durationSelect.value = "10";
    durationSelect.addEventListener("change", function(){
      durationTouched = true;
      syncProductionPrice();
      setTimeout(syncBuildGuidance, 0);
    });
    durationSelect.addEventListener("input", function(){
      durationTouched = true;
      syncProductionPrice();
      setTimeout(syncBuildGuidance, 0);
    });
  }

  if (formatSelect){
    formatSelect.addEventListener("change", syncProductionPrice);
    formatSelect.addEventListener("input", syncProductionPrice);
  }

  if (musicModeSelect){
    musicModeSelect.addEventListener("change", syncProductionPrice);
  }

  document.addEventListener("aivo:mobile-radioad-project-sync", function(){
    keepInitialDurationAtTen();
    bindNarrationProgress();
    syncNarrationProgress();
    setTimeout(syncBuildGuidance, 0);
  });

  if (preview){
    const narrationObserver = new MutationObserver(function(){
      syncNarrationLoadingLabel();
      bindNarrationProgress();
      syncNarrationProgress();
      setTimeout(syncBuildGuidance, 0);
    });
    narrationObserver.observe(preview, {
      attributes:true,
      attributeFilter:["data-state"],
      childList:true,
      characterData:true,
      subtree:true
    });
  }

  keepInitialDurationAtTen();
  syncNarrationLoadingLabel();
  bindNarrationProgress();
  syncNarrationProgress();
  setTimeout(syncBuildGuidance, 0);
})();