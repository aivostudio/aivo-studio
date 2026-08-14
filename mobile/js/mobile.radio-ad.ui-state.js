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
  const narrationStatus = preview && preview.querySelector(".mobile-adfilm-voice-preview-status");

  const CREDIT_PRICES = {
    mp3: { 10:10, 15:12, 30:20, 45:28, 60:36 },
    wav: { 10:13, 15:15, 30:25, 45:35, 60:45 }
  };

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function t(key, params, fallback){
    try{
      if (typeof window.t === "function"){
        const value = window.t(key, params);
        if (value && value !== key) return String(value);
      }
    }catch(_){ }
    return fallback == null ? key : String(fallback);
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
    if (mode === "off") return t("radioad.music.modeNoMusic", null, "Müziksiz");
    if (mode === "upload") return t("radioad.music.modeUploaded", null, "Yüklenen müzik");
    return t("radioad.music.modeAivo", null, "AIVO müziği");
  }

  function syncFormatOptionLabels(){
    if (!formatSelect) return;
    const seconds = duration();
    const mp3 = formatSelect.querySelector('option[value="mp3"]');
    const wav = formatSelect.querySelector('option[value="wav"]');
    if (mp3) mp3.textContent = t("radioad.settings.mp3", { credits:price("mp3", seconds) }, "MP3 · 320 kbps · " + price("mp3", seconds) + " Kredi");
    if (wav) wav.textContent = t("radioad.settings.wav", { credits:price("wav", seconds) }, "WAV · Kayıpsız · " + price("wav", seconds) + " Kredi");
  }

  function syncProductionPrice(){
    const seconds = duration();
    const fmt = format();
    const amount = price(fmt, seconds);

    syncFormatOptionLabels();

    if (actionButton){
      actionButton.textContent = t("radioad.action.create", { credits:amount }, "Radyo Reklamını Oluştur (" + amount + " Kredi)");
      actionButton.setAttribute("data-credit-cost", String(amount));
      actionButton.setAttribute("data-credit-duration", String(seconds));
      actionButton.setAttribute("data-credit-format", fmt);
    }

    if (actionSummary){
      const formatLabel = fmt.toUpperCase() + (fmt === "mp3" ? " 320 kbps" : "");
      actionSummary.textContent = t("radioad.action.summary", {
        duration:seconds,
        music:musicLabel(),
        format:formatLabel
      }, seconds + " sn · Seslendirme · " + musicLabel() + " · " + formatLabel);
    }

    try{
      const production = window.AIVOMobileRadioAdProduction;
      if (production && typeof production.syncButton === "function") {
        const sync = window.AIVOMobileRadioAdProjectSync;
        const project = sync && typeof sync.getProject === "function" ? sync.getProject() : window.AIVOMobileRadioAdProject;
        production.syncButton(project || null);
      }
    }catch(_){ }
  }

  function syncNarrationLoadingLabel(){
    if (!preview || !narrationCreateButton) return;
    if (preview.dataset.state !== "loading") return;

    const status = clean(narrationStatus && narrationStatus.textContent);
    const masteringTr = t("radioad.narration.mastering", null, "Ses düzenleniyor...");
    const masteringEn = "Processing voice...";
    const isMastering = status === masteringTr || status === masteringEn || /düzenlen|processing voice/i.test(status);
    const nextLabel = isMastering
      ? t("radioad.narration.mastering", null, "Ses düzenleniyor...")
      : t("radioad.narration.loadingCreate", null, "Ses oluşturuluyor...");

    if (narrationCreateButton.textContent !== nextLabel) {
      narrationCreateButton.textContent = nextLabel;
    }
  }

  function routeRadioBuild(event){
    if (!actionButton || !event || !event.target || !event.target.closest) return;
    const clicked = event.target.closest("[data-mobile-radio-action] .mobile-adfilm-create-button");
    if (clicked !== actionButton) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    Promise.resolve().then(function(){
      const production = window.AIVOMobileRadioAdProduction;
      if (production && typeof production.run === "function") {
        production.run();
      }
    });
  }

  document.addEventListener("click", routeRadioBuild, true);

  if (durationSelect){
    durationSelect.addEventListener("change", syncProductionPrice);
    durationSelect.addEventListener("input", syncProductionPrice);
  }

  if (formatSelect){
    formatSelect.addEventListener("change", syncProductionPrice);
    formatSelect.addEventListener("input", syncProductionPrice);
  }

  if (musicModeSelect){
    musicModeSelect.addEventListener("change", syncProductionPrice);
  }

  document.addEventListener("aivo:mobile-radioad-project-sync", syncProductionPrice);
  document.addEventListener("aivo:language-change", function(){
    syncProductionPrice();
    syncNarrationLoadingLabel();
  });

  if (preview){
    const narrationObserver = new MutationObserver(syncNarrationLoadingLabel);
    narrationObserver.observe(preview, {
      attributes:true,
      attributeFilter:["data-state"],
      childList:true,
      characterData:true,
      subtree:true
    });
  }

  window.addEventListener("pagehide", function(){
    document.removeEventListener("click", routeRadioBuild, true);
  }, { once:true });

  syncProductionPrice();
  syncNarrationLoadingLabel();
})();