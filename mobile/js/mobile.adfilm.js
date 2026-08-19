(function(){
  const root = document.getElementById("mobileAdFilmSection");
  if (!root || root.__mobileAdFilmBound) return;
  root.__mobileAdFilmBound = true;

  let adfilmTrafficActive = false;

  function mobileAdFilmTrafficMeta(){
    const path = String(window.location.pathname || "/studio.mobile.html");
    const lower = path.toLowerCase();

    if (lower.includes("studio.ios.html")) {
      return { platform: "ios_app", source: "ios_adfilm", page: path + "#adfilm" };
    }

    if (lower.includes("studio.play.html")) {
      return { platform: "android_app", source: "play_adfilm", page: path + "#adfilm" };
    }

    return { platform: "mobile_web", source: "mobile_adfilm", page: path + "#adfilm" };
  }

  function syncMobileAdFilmTraffic(){
    const active = String(window.location.hash || "").toLowerCase() === "#adfilm";

    if (active && !adfilmTrafficActive) {
      const meta = mobileAdFilmTrafficMeta();

      try {
        fetch("/api/traffic/hit", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            platform: meta.platform,
            source: meta.source,
            visibilityState: document.visibilityState || "unknown",
            referrer: document.referrer || "",
            page: meta.page
          })
        }).catch(function(){});
      } catch (_) {}
    }

    adfilmTrafficActive = active;
  }

  window.addEventListener("hashchange", syncMobileAdFilmTraffic);
  setTimeout(syncMobileAdFilmTraffic, 0);

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

(function(){
  const root = document.getElementById("mobileAdFilmSection");
  if (!root || root.querySelector("[data-mobile-adfilm-music]")) return;

  const videoSettings = root.querySelector("[data-mobile-adfilm-video-settings]");
  if (!videoSettings) return;

  if (!document.querySelector('link[data-mobile-adfilm-music-style]')){
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/mobile/css/mobile.adfilm.music.css?v=1";
    link.setAttribute("data-mobile-adfilm-music-style", "");
    document.head.appendChild(link);
  }

  const card = document.createElement("article");
  card.className = "mobile-adfilm-card mobile-adfilm-music-card";
  card.setAttribute("data-mobile-adfilm-music", "");
  card.innerHTML = `
    <div class="mobile-adfilm-card-head">
      <span class="mobile-adfilm-music-icon" aria-hidden="true"></span>
      <div class="mobile-adfilm-card-copy">
        <span class="mobile-adfilm-step">06</span>
        <h4>Reklam Müziği</h4>
        <p>Müziğin nasıl hazırlanacağını seç.</p>
      </div>
      <em class="mobile-adfilm-music-optional">İsteğe bağlı</em>
    </div>

    <div class="mobile-adfilm-music-modes" role="group" aria-label="Reklam müziği seçimi">
      <button type="button" class="is-active" data-mobile-adfilm-music-mode="auto">AIVO müziği hazırlasın</button>
      <button type="button" data-mobile-adfilm-music-mode="upload">Kendi müziğim / jingle'ım</button>
      <button type="button" data-mobile-adfilm-music-mode="off">Müzik olmasın</button>
    </div>

    <section class="mobile-adfilm-music-panel" data-mobile-adfilm-music-panel="auto">
      <div class="mobile-adfilm-music-fields">
        <label class="mobile-adfilm-music-field">
          <span>Müzik Tarzı</span>
          <select id="mobileAdFilmMusicStyle">
            <option value="auto">AIVO otomatik seçsin</option>
            <option value="cinematic" selected>Sinematik</option>
            <option value="corporate">Kurumsal</option>
            <option value="electronic">Elektronik</option>
            <option value="acoustic">Akustik</option>
          </select>
        </label>
        <label class="mobile-adfilm-music-field">
          <span>Enerji</span>
          <select id="mobileAdFilmMusicEnergy">
            <option value="balanced">Dengeli</option>
            <option value="soft">Yumuşak</option>
            <option value="strong" selected>Güçlü</option>
            <option value="high">Yüksek</option>
          </select>
        </label>
      </div>
      <div class="mobile-adfilm-music-engine">
        <span>Öneri: seçtiğin stile göre otomatik hazırlanır.</span>
        <b>Stable Audio 3 Small</b>
      </div>
    </section>

    <section class="mobile-adfilm-music-panel" data-mobile-adfilm-music-panel="upload" hidden>
      <label class="mobile-adfilm-music-upload" data-mobile-adfilm-music-picker>
        <input id="mobileAdFilmMusicFile" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg">
        <span class="mobile-adfilm-music-upload-icon" aria-hidden="true"></span>
        <span>
          <b>Müzik veya jingle yükle</b>
          <small>MP3, WAV, M4A, AAC veya OGG · En fazla 20 MB</small>
        </span>
      </label>
      <div class="mobile-adfilm-music-file" data-mobile-adfilm-music-file-view hidden>
        <div class="mobile-adfilm-music-file-head">
          <span class="mobile-adfilm-music-file-note" aria-hidden="true"></span>
          <div class="mobile-adfilm-music-file-copy">
            <b data-mobile-adfilm-music-name></b>
            <small data-mobile-adfilm-music-size></small>
          </div>
          <button class="mobile-adfilm-music-remove" type="button" aria-label="Müzik dosyasını kaldır">×</button>
        </div>
        <div class="mobile-adfilm-music-player">
          <button class="mobile-adfilm-music-play" type="button" data-mobile-adfilm-music-play aria-label="Müziği oynat"></button>
          <input class="mobile-adfilm-music-progress" type="range" min="0" max="1000" value="0" step="1" data-mobile-adfilm-music-progress aria-label="Müzik ilerleme çubuğu">
          <span class="mobile-adfilm-music-time" data-mobile-adfilm-music-time>0:00 / 0:00</span>
          <audio preload="metadata" data-mobile-adfilm-music-audio></audio>
        </div>
      </div>
      <p class="mobile-adfilm-music-rights">Yüklediğin müziğin kullanım ve telif hakkına sahip olmalısın.</p>
    </section>
  `;

  videoSettings.insertAdjacentElement("afterend", card);

  const modeButtons = Array.from(card.querySelectorAll("[data-mobile-adfilm-music-mode]"));
  const panels = Array.from(card.querySelectorAll("[data-mobile-adfilm-music-panel]"));
  const fileInput = card.querySelector("#mobileAdFilmMusicFile");
  const picker = card.querySelector("[data-mobile-adfilm-music-picker]");
  const fileView = card.querySelector("[data-mobile-adfilm-music-file-view]");
  const fileName = card.querySelector("[data-mobile-adfilm-music-name]");
  const fileSize = card.querySelector("[data-mobile-adfilm-music-size]");
  const removeButton = card.querySelector(".mobile-adfilm-music-remove");
  const audio = card.querySelector("[data-mobile-adfilm-music-audio]");
  const playButton = card.querySelector("[data-mobile-adfilm-music-play]");
  const progress = card.querySelector("[data-mobile-adfilm-music-progress]");
  const time = card.querySelector("[data-mobile-adfilm-music-time]");
  let musicObjectUrl = "";

  function formatTime(value){
    const seconds = Number.isFinite(value) ? value : 0;
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function syncPlayer(){
    if (!audio || !playButton || !progress || !time) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    progress.value = duration ? String(Math.round(current / duration * 1000)) : "0";
    time.textContent = formatTime(current) + " / " + formatTime(duration);
    const playing = !audio.paused && !audio.ended;
    playButton.classList.toggle("is-playing", playing);
    playButton.setAttribute("aria-label", playing ? "Müziği duraklat" : "Müziği oynat");
  }

  function clearPlayerSource(){
    if (audio){
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (musicObjectUrl){
      URL.revokeObjectURL(musicObjectUrl);
      musicObjectUrl = "";
    }
    if (progress) progress.value = "0";
    if (time) time.textContent = "0:00 / 0:00";
    if (playButton) playButton.classList.remove("is-playing");
  }

  function setMusicMode(mode){
    modeButtons.forEach(function(button){
      button.classList.toggle("is-active", button.getAttribute("data-mobile-adfilm-music-mode") === mode);
    });
    panels.forEach(function(panel){
      panel.hidden = panel.getAttribute("data-mobile-adfilm-music-panel") !== mode;
    });
    if (mode !== "upload" && audio) audio.pause();
    root.dataset.adfilmMusicMode = mode;
    try{ localStorage.setItem("aivo_adfilm_music_mode_v1", mode); }catch(_){ }
  }

  function renderFile(){
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (picker) picker.hidden = !!file;
    if (fileView) fileView.hidden = !file;

    if (!file){
      if (fileName) fileName.textContent = "";
      if (fileSize) fileSize.textContent = "";
      clearPlayerSource();
      return;
    }

    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = Math.max(.1, file.size / 1024 / 1024).toFixed(1) + " MB";

    clearPlayerSource();
    if (audio){
      musicObjectUrl = URL.createObjectURL(file);
      audio.src = musicObjectUrl;
      audio.load();
    }
  }

  modeButtons.forEach(function(button){
    button.addEventListener("click", function(){
      setMusicMode(button.getAttribute("data-mobile-adfilm-music-mode"));
    });
  });

  if (fileInput){
    fileInput.addEventListener("change", function(){
      const file = fileInput.files && fileInput.files[0];
      if (file && file.size > 20 * 1024 * 1024){
        fileInput.value = "";
      }
      renderFile();
    });
  }

  if (removeButton){
    removeButton.addEventListener("click", function(){
      if (fileInput) fileInput.value = "";
      renderFile();
    });
  }

  if (playButton){
    playButton.addEventListener("click", function(){
      if (!audio || !audio.src) return;
      if (audio.paused){
        audio.play().catch(function(){});
      }else{
        audio.pause();
      }
    });
  }

  if (progress){
    progress.addEventListener("input", function(){
      if (!audio || !audio.duration) return;
      audio.currentTime = Number(progress.value) / 1000 * audio.duration;
    });
  }

  if (audio){
    ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"].forEach(function(name){
      audio.addEventListener(name, syncPlayer);
    });
  }

  window.addEventListener("beforeunload", function(){
    clearPlayerSource();
  }, { once: true });

  let initialMode = "auto";
  try{
    const stored = localStorage.getItem("aivo_adfilm_music_mode_v1");
    if (stored === "upload" || stored === "off") initialMode = stored;
  }catch(_){ }
  setMusicMode(initialMode);
})();

(function(){
  const root = document.getElementById("mobileAdFilmSection");
  if (!root || root.__mobileAdFilmCreditPricingBound) return;
  root.__mobileAdFilmCreditPricingBound = true;

  const BASE_CREDITS = { "720p": 145, "1080p": 290, "4k": 575 };
  const durationSelect = root.querySelector("#mobileAdFilmDuration");
  const qualityRadios = Array.from(root.querySelectorAll('input[name="mobileAdFilmQuality"]'));
  const createButton = root.querySelector(".mobile-adfilm-create-button");
  const summary = root.querySelector(".mobile-adfilm-action-copy small");
  const voiceToggle = root.querySelector("#mobileAdFilmVoiceEnabled");

  function normalizeDuration(value){
    const duration = Math.round(Number(value) || 5);
    return Math.max(5, Math.min(15, duration));
  }

  function normalizeQuality(value){
    const quality = String(value || "").toLowerCase();
    if (quality === "720p" || quality === "4k") return quality;
    return "1080p";
  }

  function calculate(quality, duration){
    const normalizedQuality = normalizeQuality(quality);
    const normalizedDuration = normalizeDuration(duration);
    const base = Number(BASE_CREDITS[normalizedQuality] || BASE_CREDITS["1080p"]);
    return Math.ceil((base * normalizedDuration / 15) / 5) * 5;
  }

  function currentQuality(){
    const checked = qualityRadios.find(function(radio){ return radio.checked; });
    return normalizeQuality(checked && checked.value);
  }

  function currentFormat(){
    const active = root.querySelector("[data-mobile-adfilm-format].is-active");
    return String(active && active.getAttribute("data-mobile-adfilm-format") || "16:9");
  }

  function creditNode(quality){
    const option = root.querySelector('.mobile-adfilm-quality-option[data-quality="' + quality + '"]');
    return option && option.querySelector(".mobile-adfilm-quality-credit");
  }

  function sync(){
    if (!durationSelect || !qualityRadios.length) return null;

    const duration = normalizeDuration(durationSelect.value);
    const quality = currentQuality();
    const credits = calculate(quality, duration);
    const format = currentFormat();
    const voiceLabel = !voiceToggle || voiceToggle.checked ? "Sesli" : "Sessiz";

    ["720p", "1080p", "4k"].forEach(function(itemQuality){
      const node = creditNode(itemQuality);
      if (node) node.textContent = calculate(itemQuality, duration) + " Kredi";
    });

    if (createButton){
      createButton.textContent = "Reklam Filmini Oluştur (" + credits + " Kredi)";
      createButton.setAttribute("data-credit-cost", String(credits));
      createButton.setAttribute("data-credit-quality", quality);
      createButton.setAttribute("data-credit-duration", String(duration));
    }

    if (summary){
      summary.textContent = duration + " sn · " + format + " · " + (quality === "4k" ? "4K" : quality) + " · " + voiceLabel;
    }

    root.dataset.adfilmCreditCost = String(credits);
    root.dataset.adfilmCreditQuality = quality;
    root.dataset.adfilmCreditDuration = String(duration);

    try{
      window.dispatchEvent(new CustomEvent("aivo:mobile-adfilm-credit-change", {
        detail: { quality: quality, duration: duration, credits: credits, aspectRatio: format }
      }));
    }catch(_){ }

    return { quality: quality, duration: duration, credits: credits, aspectRatio: format };
  }

  if (durationSelect){
    durationSelect.addEventListener("change", sync);
  }

  qualityRadios.forEach(function(radio){
    radio.addEventListener("change", sync);
  });

  if (voiceToggle){
    voiceToggle.addEventListener("change", sync);
  }

  root.addEventListener("click", function(event){
    if (event.target.closest("[data-mobile-adfilm-format]")){
      setTimeout(sync, 0);
    }
  });

  window.AIVOMobileAdFilmCreditPricing = {
    baseCredits: Object.assign({}, BASE_CREDITS),
    calculate: calculate,
    current: sync,
    sync: sync
  };

  sync();
})();

(function loadMobileAdFilmProjectSync(){
  if (window.__AIVO_MOBILE_ADFILM_PROJECT_SYNC_LOADER__) return;
  window.__AIVO_MOBILE_ADFILM_PROJECT_SYNC_LOADER__ = true;
  if (document.querySelector('script[data-mobile-adfilm-project-sync]')) return;
  const script = document.createElement("script");
  script.src = "/mobile/js/mobile.adfilm.project-sync.js?v=1";
  script.defer = true;
  script.setAttribute("data-mobile-adfilm-project-sync", "");
  document.body.appendChild(script);
})();