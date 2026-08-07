(function(){
  const root = document.getElementById("mobileAdFilmSection");
  if (!root || root.__mobileAdFilmBound) return;
  root.__mobileAdFilmBound = true;

  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-adfilm-mode]"));
  const views = Array.from(root.querySelectorAll("[data-mobile-adfilm-view]"));
  const description = root.querySelector("#mobileAdFilmDescription");
  const descriptionCount = root.querySelector("#mobileAdFilmDescriptionCount");
  const creativeBrief = root.querySelector("#mobileAdFilmCreativeBrief");
  const creativeBriefCount = root.querySelector("#mobileAdFilmCreativeBriefCount");

  const referenceTotal = root.querySelector("#mobileAdFilmReferenceTotal");
  const referenceGallery = root.querySelector("#mobileAdFilmReferenceGallery");
  const primaryInput = root.querySelector("#mobileAdFilmPrimaryImage");
  const angleInput = root.querySelector("#mobileAdFilmAngleImages");
  const sceneInput = root.querySelector("#mobileAdFilmSceneImages");
  const logoInput = root.querySelector("#mobileAdFilmLogoImage");

  const voiceEnabled = root.querySelector("#mobileAdFilmVoiceEnabled");
  const voiceState = root.querySelector("#mobileAdFilmVoiceState");
  const voiceBody = root.querySelector("#mobileAdFilmVoiceBody");
  const voiceCard = root.querySelector(".mobile-adfilm-voice-card");
  const narrationText = root.querySelector("#mobileAdFilmNarrationText");
  const narrationCount = root.querySelector("#mobileAdFilmNarrationCount");
  const narrationDuration = root.querySelector("#mobileAdFilmDuration");
  const voiceSpeed = root.querySelector("#mobileAdFilmVoiceSpeed");
  const budgetRecommendation = root.querySelector("#mobileAdFilmBudgetRecommendation");
  const budgetSpeed = root.querySelector("#mobileAdFilmBudgetSpeed");
  const budgetMeter = root.querySelector("#mobileAdFilmBudgetMeter");
  const budgetStatus = root.querySelector("#mobileAdFilmBudgetStatus");
  const budgetMessage = root.querySelector("#mobileAdFilmBudgetMessage");
  const budgetEstimate = root.querySelector("#mobileAdFilmBudgetEstimate");

  const speechRates = {
    slow: { min: 1.25, target: 1.45, max: 1.60, label: "Yavaş" },
    balanced: { min: 1.60, target: 1.80, max: 2.00, label: "Dengeli" },
    fast: { min: 1.90, target: 2.15, max: 2.40, label: "Hızlı" }
  };

  const uploadState = {
    primary: [],
    angles: [],
    scene: [],
    logo: []
  };

  const uploadConfig = {
    primary: {
      count: root.querySelector("#mobileAdFilmPrimaryCount"),
      input: primaryInput,
      limit: 1,
      label: function(){ return "@Image1"; }
    },
    angles: {
      count: root.querySelector("#mobileAdFilmAngleCount"),
      input: angleInput,
      limit: 3,
      label: function(index){ return "@Image" + (index + 2); }
    },
    scene: {
      count: root.querySelector("#mobileAdFilmSceneCount"),
      input: sceneInput,
      limit: 5,
      label: function(index){ return "@Image" + (index + 5); }
    },
    logo: {
      count: root.querySelector("#mobileAdFilmLogoCount"),
      input: logoInput,
      limit: 1,
      label: function(){ return "Overlay"; }
    }
  };

  function ensureVideoSettingsStyles(){
    if (document.querySelector('link[data-mobile-adfilm-video-settings-style]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/mobile/css/mobile.adfilm.video-settings.css?v=1";
    link.setAttribute("data-mobile-adfilm-video-settings-style", "");
    document.head.appendChild(link);
  }

  function buildDurationOptions(){
    if (!narrationDuration) return;
    narrationDuration.innerHTML = "";
    for (let second = 5; second <= 15; second += 1){
      const option = document.createElement("option");
      option.value = String(second);
      option.textContent = second + " sn";
      narrationDuration.appendChild(option);
    }
    narrationDuration.value = "5";
  }

  function setFormat(format){
    root.querySelectorAll("[data-mobile-adfilm-format]").forEach(function(button){
      const active = button.getAttribute("data-mobile-adfilm-format") === format;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function installVideoSettings(){
    if (!voiceCard || !narrationDuration) return;
    if (root.querySelector("[data-mobile-adfilm-video-settings]")) return;

    ensureVideoSettingsStyles();
    buildDurationOptions();

    const oldDurationPill = narrationDuration.closest(".mobile-adfilm-duration-pill");
    const card = document.createElement("article");
    card.className = "mobile-adfilm-card mobile-adfilm-video-settings-card";
    card.setAttribute("data-mobile-adfilm-video-settings", "");
    card.innerHTML = `
      <div class="mobile-adfilm-card-head">
        <span class="mobile-adfilm-video-settings-icon" aria-hidden="true"></span>
        <div class="mobile-adfilm-card-copy">
          <span class="mobile-adfilm-step">05</span>
          <h4>Video Ayarları</h4>
          <p>Yalnız süreyi ve yayın formatını seç.</p>
        </div>
      </div>

      <div class="mobile-adfilm-video-setting-row">
        <span class="mobile-adfilm-video-setting-label">Süre</span>
        <label class="mobile-adfilm-video-duration-select" id="mobileAdFilmVideoDurationMount" aria-label="Video süresi"></label>
      </div>

      <div class="mobile-adfilm-video-setting-row mobile-adfilm-video-format-row">
        <span class="mobile-adfilm-video-setting-label">Format</span>
        <div class="mobile-adfilm-video-format-grid" role="group" aria-label="Video formatı">
          <button type="button" data-mobile-adfilm-format="9:16" aria-pressed="false"><span class="is-vertical"></span>9:16</button>
          <button type="button" data-mobile-adfilm-format="1:1" aria-pressed="false"><span class="is-square"></span>1:1</button>
          <button type="button" data-mobile-adfilm-format="16:9" class="is-active" aria-pressed="true"><span class="is-wide"></span>16:9</button>
          <button type="button" data-mobile-adfilm-format="4:5" aria-pressed="false"><span class="is-portrait"></span>4:5</button>
          <button type="button" data-mobile-adfilm-format="3:4" aria-pressed="false"><span class="is-portrait"></span>3:4</button>
          <button type="button" data-mobile-adfilm-format="4:3" aria-pressed="false"><span class="is-landscape"></span>4:3</button>
          <button type="button" data-mobile-adfilm-format="21:9" aria-pressed="false"><span class="is-ultrawide"></span>21:9</button>
        </div>
      </div>

      <p class="mobile-adfilm-video-settings-note">Seçtiğin formata göre final video güvenli kadrajla hazırlanır.</p>
    `;

    voiceCard.insertAdjacentElement("afterend", card);

    const durationMount = card.querySelector("#mobileAdFilmVideoDurationMount");
    if (durationMount){
      durationMount.appendChild(narrationDuration);
    }
    if (oldDurationPill) oldDurationPill.remove();

    card.addEventListener("click", function(event){
      const formatButton = event.target.closest("[data-mobile-adfilm-format]");
      if (!formatButton) return;
      setFormat(formatButton.getAttribute("data-mobile-adfilm-format"));
    });

    narrationDuration.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setMode(mode){
    modeButtons.forEach(function(button){
      const active = button.getAttribute("data-mobile-adfilm-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    views.forEach(function(view){
      const active = view.getAttribute("data-mobile-adfilm-view") === mode;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
  }

  modeButtons.forEach(function(button){
    button.addEventListener("click", function(){
      setMode(button.getAttribute("data-mobile-adfilm-mode"));
    });
  });

  function syncDescriptionCount(){
    if (!description || !descriptionCount) return;
    descriptionCount.textContent = String(description.value.length);
  }

  function syncCreativeBriefCount(){
    if (!creativeBrief || !creativeBriefCount) return;
    creativeBriefCount.textContent = String(creativeBrief.value.length);
  }

  function revokeGroup(group){
    uploadState[group].forEach(function(item){
      if (item.url) URL.revokeObjectURL(item.url);
    });
    uploadState[group] = [];
  }

  function fileKey(file){
    return [file.name, file.size, file.lastModified, file.type].join("|");
  }

  function setFiles(group, fileList, limit, append){
    const files = Array.from(fileList || []);

    if (!append){
      revokeGroup(group);
    }

    const existingKeys = new Set(uploadState[group].map(function(item){
      return fileKey(item.file);
    }));

    files.forEach(function(file){
      if (uploadState[group].length >= limit) return;
      const key = fileKey(file);
      if (existingKeys.has(key)) return;

      uploadState[group].push({
        file: file,
        url: URL.createObjectURL(file)
      });
      existingKeys.add(key);
    });

    const config = uploadConfig[group];
    if (config && config.input){
      config.input.value = "";
    }

    renderReferences();
  }

  function removeReference(group, index){
    const item = uploadState[group][index];
    if (!item) return;

    if (item.url) URL.revokeObjectURL(item.url);
    uploadState[group].splice(index, 1);

    const config = uploadConfig[group];
    if (config && config.input && uploadState[group].length === 0){
      config.input.value = "";
    }

    renderReferences();
  }

  function renderReferences(){
    Object.keys(uploadConfig).forEach(function(group){
      const config = uploadConfig[group];
      const amount = uploadState[group].length;

      if (config.count){
        config.count.textContent = amount + " / " + config.limit;
      }

      const uploadItem = root.querySelector('[data-adfilm-upload-item="' + group + '"]');
      if (uploadItem){
        uploadItem.classList.toggle("is-filled", amount > 0);
      }
    });

    syncReferenceTotal();

    if (!referenceGallery) return;
    referenceGallery.innerHTML = "";

    ["primary", "angles", "scene", "logo"].forEach(function(group){
      const config = uploadConfig[group];

      uploadState[group].forEach(function(item, index){
        const thumb = document.createElement("div");
        thumb.className = "mobile-adfilm-reference-thumb";
        thumb.setAttribute("data-reference-group", group);
        thumb.setAttribute("data-reference-index", String(index));

        const image = document.createElement("img");
        image.src = item.url;
        image.alt = config.label(index) + " referansı";
        thumb.appendChild(image);

        const label = document.createElement("span");
        label.className = "mobile-adfilm-reference-thumb-label";
        label.textContent = config.label(index);
        thumb.appendChild(label);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "mobile-adfilm-reference-delete";
        removeButton.setAttribute("aria-label", config.label(index) + " görselini sil");
        removeButton.addEventListener("click", function(event){
          event.preventDefault();
          event.stopPropagation();
          removeReference(group, index);
        });
        thumb.appendChild(removeButton);

        referenceGallery.appendChild(thumb);
      });
    });
  }

  function syncReferenceTotal(){
    if (!referenceTotal) return;
    const total = uploadState.primary.length + uploadState.angles.length + uploadState.scene.length;
    referenceTotal.textContent = String(total);
  }

  function syncVoiceEnabled(){
    if (!voiceEnabled) return;
    const enabled = !!voiceEnabled.checked;
    if (voiceState) voiceState.textContent = enabled ? "Açık" : "Kapalı";
    if (voiceBody) voiceBody.classList.toggle("is-disabled", !enabled);
  }

  function narrationWords(text){
    const clean = String(text || "").trim();
    if (!clean) return [];
    try {
      return clean.match(/[\p{L}\p{N}]+(?:[’'\-.][\p{L}\p{N}]+)*/gu) || [];
    } catch (e) {
      return clean.split(/\s+/).filter(Boolean);
    }
  }

  function narrationEstimate(text, rate){
    const count = narrationWords(text).length;
    if (!count) return 0;
    const commas = (String(text).match(/[,;:]/g) || []).length;
    const stops = (String(text).match(/[.!?…]/g) || []).length;
    return count / rate.target + commas * 0.12 + stops * 0.28;
  }

  function formatSeconds(value){
    if (!value) return "0";
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  function syncNarrationBudget(){
    if (!narrationText || !narrationDuration || !voiceSpeed) return;

    const duration = Math.max(5, Math.min(15, Number(narrationDuration.value) || 5));
    const speedKey = speechRates[voiceSpeed.value] ? voiceSpeed.value : "balanced";
    const rate = speechRates[speedKey];
    const minWords = Math.max(3, Math.floor(duration * rate.min));
    const maxWords = Math.max(5, Math.floor(duration * rate.max));
    const wordCount = narrationWords(narrationText.value).length;
    const estimatedSeconds = narrationEstimate(narrationText.value, rate);
    const percent = narrationText.value.trim()
      ? Math.min(100, Math.round((estimatedSeconds / duration) * 100))
      : 0;

    if (budgetRecommendation) budgetRecommendation.textContent = minWords + "–" + maxWords + " kelime önerilir";
    if (budgetSpeed) budgetSpeed.textContent = rate.label;
    if (budgetMeter) budgetMeter.style.width = percent + "%";
    if (budgetEstimate) budgetEstimate.textContent = wordCount + " kelime · tahmini " + formatSeconds(estimatedSeconds) + " sn";

    let state = "empty";
    let message = "Metnini yazdıkça süre hesabı burada görünecek.";

    if (narrationText.value.trim()) {
      const overLimit = wordCount > maxWords || estimatedSeconds > duration + 0.25;
      const nearLimit = wordCount >= Math.max(minWords, Math.floor(maxWords * 0.86)) || estimatedSeconds >= duration * 0.88;
      const shortText = wordCount < minWords;

      if (overLimit) {
        state = "error";
        message = "Bu metin " + duration + " saniyeye sığmıyor. En fazla " + maxWords + " kelime kullan.";
      } else if (nearLimit) {
        state = "warning";
        message = "Sınıra yakın. Doğal duraklar için birkaç kelime kısaltmak daha güvenli.";
      } else if (shortText) {
        state = "short";
        message = "Metin kısa; reklamda nefes, müzik veya sessiz vurgu alanı kalır.";
      } else {
        state = "success";
        message = "Metin seçilen süreye uygun.";
      }
    }

    if (budgetStatus) budgetStatus.className = "mobile-adfilm-narration-status is-" + state;
    if (budgetMessage) budgetMessage.textContent = message;
  }

  function syncNarrationCount(){
    if (!narrationText || !narrationCount) return;
    narrationCount.textContent = String(narrationText.value.length);
    syncNarrationBudget();
  }

  if (description){
    description.addEventListener("input", syncDescriptionCount);
    syncDescriptionCount();
  }

  if (creativeBrief){
    creativeBrief.addEventListener("input", syncCreativeBriefCount);
    syncCreativeBriefCount();
  }

  if (primaryInput){
    primaryInput.addEventListener("change", function(){
      setFiles("primary", primaryInput.files, 1, false);
    });
  }

  if (angleInput){
    angleInput.addEventListener("change", function(){
      setFiles("angles", angleInput.files, 3, true);
    });
  }

  if (sceneInput){
    sceneInput.addEventListener("change", function(){
      setFiles("scene", sceneInput.files, 5, true);
    });
  }

  if (logoInput){
    logoInput.addEventListener("change", function(){
      setFiles("logo", logoInput.files, 1, false);
    });
  }

  if (voiceEnabled){
    voiceEnabled.addEventListener("change", syncVoiceEnabled);
    syncVoiceEnabled();
  }

  if (narrationText){
    narrationText.addEventListener("input", syncNarrationCount);
    syncNarrationCount();
  }

  if (narrationDuration){
    narrationDuration.addEventListener("change", syncNarrationBudget);
  }

  if (voiceSpeed){
    voiceSpeed.addEventListener("change", syncNarrationBudget);
  }

  window.addEventListener("beforeunload", function(){
    Object.keys(uploadState).forEach(revokeGroup);
  }, { once: true });

  renderReferences();
  installVideoSettings();
  syncNarrationBudget();
  setMode("video");
})();
