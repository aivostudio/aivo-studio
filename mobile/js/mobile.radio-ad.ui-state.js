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

  function duration(){
    const value = Number(durationSelect && durationSelect.value || 30);
    return [10,15,30,45,60].includes(value) ? value : 30;
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
    if (mode === "off") return "Müziksiz";
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

  syncProductionPrice();
  syncNarrationLoadingLabel();
})();