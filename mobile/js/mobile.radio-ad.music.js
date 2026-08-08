(function AIVO_MOBILE_RADIO_AD_MUSIC(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_MUSIC_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_MUSIC_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  const card = view && view.querySelector('[data-mobile-radio-card="music"]');
  if (!root || !view || !card) return;

  function ensureStyles(){
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(function(link){
      return String(link.getAttribute("href") || "").indexOf("/mobile/css/mobile.adfilm.music.css") >= 0;
    });
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/mobile/css/mobile.adfilm.music.css?v=1";
    link.setAttribute("data-mobile-radio-music-style", "");
    document.head.appendChild(link);
  }

  ensureStyles();

  const oldGrid = card.querySelector(".mobile-adfilm-form-grid");
  const oldTip = card.querySelector(".mobile-adfilm-tip");
  const modeSelect = card.querySelector("#mobileRadioMusicMode");
  const styleSelect = card.querySelector("#mobileRadioMusicStyle");
  const energySelect = card.querySelector("#mobileRadioMusicEnergy");
  const styleLabel = styleSelect && styleSelect.closest("label");
  const energyLabel = energySelect && energySelect.closest("label");
  const head = card.querySelector(".mobile-adfilm-card-head");

  if (!modeSelect || !styleSelect || !energySelect || !head) return;

  modeSelect.hidden = true;
  modeSelect.setAttribute("aria-hidden", "true");
  modeSelect.tabIndex = -1;
  card.appendChild(modeSelect);

  if (styleLabel) styleLabel.className = "mobile-adfilm-music-field";
  if (energyLabel) energyLabel.className = "mobile-adfilm-music-field";

  if (oldGrid) oldGrid.remove();
  if (oldTip) oldTip.remove();

  const shell = document.createElement("div");
  shell.className = "mobile-radio-music-shell";
  shell.setAttribute("data-mobile-radio-music-shell", "");
  shell.innerHTML = `
    <div class="mobile-adfilm-music-modes" role="group" aria-label="Reklam müziği seçimi">
      <button type="button" data-mobile-radio-music-mode="ai">AIVO müziği hazırlasın</button>
      <button type="button" data-mobile-radio-music-mode="upload">Kendi müziğim / jingle'ım</button>
      <button type="button" data-mobile-radio-music-mode="off">Müzik olmasın</button>
    </div>

    <section class="mobile-adfilm-music-panel" data-mobile-radio-music-panel="ai">
      <div class="mobile-adfilm-music-fields" data-mobile-radio-music-fields></div>
      <div class="mobile-adfilm-music-engine">
        <span>Öneri: seçtiğin stile göre otomatik hazırlanır.</span>
        <b>Stable Audio 3 Small</b>
      </div>
    </section>

    <section class="mobile-adfilm-music-panel" data-mobile-radio-music-panel="upload" hidden>
      <label class="mobile-adfilm-music-upload" data-mobile-radio-music-picker>
        <input id="mobileRadioMusicFile" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg">
        <span class="mobile-adfilm-music-upload-icon" aria-hidden="true"></span>
        <span>
          <b>Müzik veya jingle yükle</b>
          <small>MP3, WAV, M4A, AAC veya OGG · En fazla 20 MB</small>
        </span>
      </label>

      <div class="mobile-adfilm-music-file" data-mobile-radio-music-file-view hidden>
        <div class="mobile-adfilm-music-file-head">
          <span class="mobile-adfilm-music-file-note" aria-hidden="true"></span>
          <div class="mobile-adfilm-music-file-copy">
            <b data-mobile-radio-music-name></b>
            <small data-mobile-radio-music-size></small>
          </div>
          <button class="mobile-adfilm-music-remove" type="button" data-mobile-radio-music-remove aria-label="Müzik dosyasını kaldır">×</button>
        </div>
        <div class="mobile-adfilm-music-player">
          <button class="mobile-adfilm-music-play" type="button" data-mobile-radio-music-play aria-label="Müziği oynat"></button>
          <input class="mobile-adfilm-music-progress" type="range" min="0" max="1000" value="0" step="1" data-mobile-radio-music-progress aria-label="Müzik ilerleme çubuğu">
          <span class="mobile-adfilm-music-time" data-mobile-radio-music-time>0:00 / 0:00</span>
          <audio preload="metadata" data-mobile-radio-music-audio></audio>
        </div>
      </div>

      <p class="mobile-adfilm-music-rights">Yüklediğin müziğin kullanım ve telif hakkına sahip olmalısın.</p>
    </section>
  `;
  head.insertAdjacentElement("afterend", shell);

  const fieldsMount = shell.querySelector("[data-mobile-radio-music-fields]");
  if (styleLabel) fieldsMount.appendChild(styleLabel);
  if (energyLabel) fieldsMount.appendChild(energyLabel);

  const modeButtons = Array.from(shell.querySelectorAll("[data-mobile-radio-music-mode]"));
  const panels = Array.from(shell.querySelectorAll("[data-mobile-radio-music-panel]"));
  const fileInput = shell.querySelector("#mobileRadioMusicFile");
  const picker = shell.querySelector("[data-mobile-radio-music-picker]");
  const fileView = shell.querySelector("[data-mobile-radio-music-file-view]");
  const fileName = shell.querySelector("[data-mobile-radio-music-name]");
  const fileSize = shell.querySelector("[data-mobile-radio-music-size]");
  const removeButton = shell.querySelector("[data-mobile-radio-music-remove]");
  const playButton = shell.querySelector("[data-mobile-radio-music-play]");
  const progress = shell.querySelector("[data-mobile-radio-music-progress]");
  const time = shell.querySelector("[data-mobile-radio-music-time]");
  const audio = shell.querySelector("[data-mobile-radio-music-audio]");

  let objectUrl = "";
  let currentAsset = null;
  let uploading = false;
  let restoring = false;

  function clean(value){ return String(value == null ? "" : value).trim(); }

  function toast(type, message, duration){
    try{
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration == null ? 3200 : duration });
      }
      const fn = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof fn === "function") return fn(message, type || "info");
    }catch(_){ }
    return null;
  }

  async function request(url, options){
    const response = await fetch(url, Object.assign({
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" }
    }, options || {}));
    const data = await response.json().catch(function(){ return {}; });
    if (!response.ok){
      const error = new Error(data.message || data.error || ("HTTP " + response.status));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function syncController(){ return window.AIVOMobileRadioAdProjectSync || null; }
  function project(){
    const sync = syncController();
    return sync && typeof sync.getProject === "function" ? sync.getProject() : window.AIVOMobileRadioAdProject || null;
  }
  function projectId(){
    const sync = syncController();
    return clean(sync && typeof sync.getProjectId === "function" ? sync.getProjectId() : root.dataset.radioAdProjectId);
  }

  function formatTime(value){
    const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
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

  function clearObjectUrl(){
    if (!objectUrl) return;
    try{ URL.revokeObjectURL(objectUrl); }catch(_){ }
    objectUrl = "";
  }

  function clearPlayer(){
    if (audio){
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    clearObjectUrl();
    if (progress) progress.value = "0";
    if (time) time.textContent = "0:00 / 0:00";
    if (playButton) playButton.classList.remove("is-playing");
  }

  function sizeLabel(bytes, state){
    const mb = Math.max(.1, Number(bytes || 0) / 1024 / 1024).toFixed(1) + " MB";
    return state ? mb + " · " + state : mb;
  }

  function renderAsset(asset, localFile, state){
    currentAsset = asset || null;
    const hasFile = !!(asset && asset.url) || !!localFile;
    if (picker) picker.hidden = hasFile;
    if (fileView) fileView.hidden = !hasFile;

    if (!hasFile){
      if (fileName) fileName.textContent = "";
      if (fileSize) fileSize.textContent = "";
      clearPlayer();
      return;
    }

    const name = clean(localFile && localFile.name || asset && asset.name || "Reklam müziği");
    const size = Number(localFile && localFile.size || asset && asset.size || 0);
    if (fileName) fileName.textContent = name;
    if (fileSize) fileSize.textContent = sizeLabel(size, state || (asset && asset.key ? "Buluta kaydedildi" : ""));

    clearPlayer();
    if (!audio) return;
    if (localFile){
      objectUrl = URL.createObjectURL(localFile);
      audio.src = objectUrl;
    }else if (asset && asset.url){
      audio.src = asset.url;
    }
    audio.load();
  }

  function setMode(mode, shouldSave){
    const next = mode === "upload" || mode === "off" ? mode : "ai";
    modeButtons.forEach(function(button){
      button.classList.toggle("is-active", button.getAttribute("data-mobile-radio-music-mode") === next);
    });
    panels.forEach(function(panel){
      panel.hidden = panel.getAttribute("data-mobile-radio-music-panel") !== next;
    });
    if (next !== "upload" && audio) audio.pause();

    const changed = modeSelect.value !== next;
    modeSelect.value = next;
    root.dataset.radioAdMusicMode = next;

    if (shouldSave !== false && changed){
      modeSelect.dispatchEvent(new Event("change", { bubbles:true }));
    }

    if (next === "upload"){
      const source = project();
      const upload = source && source.music && source.music.upload;
      if (upload && upload.url) renderAsset(upload, null, "Buluta kaydedildi");
      else if (!fileInput.files || !fileInput.files[0]) renderAsset(null, null, "");
    }
  }

  function validAudioFile(file){
    if (!file) return false;
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) return false;
    const type = clean(file.type).toLowerCase();
    const allowedTypes = ["audio/mpeg","audio/wav","audio/x-wav","audio/mp4","audio/aac","audio/ogg","audio/x-m4a"];
    if (allowedTypes.includes(type)) return true;
    return /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name || "");
  }

  function normalizedType(file){
    const type = clean(file && file.type).toLowerCase();
    if (type === "audio/mp3") return "audio/mpeg";
    if (type === "audio/m4a" || (!type && /\.m4a$/i.test(file.name || ""))) return "audio/x-m4a";
    if (type) return type;
    if (/\.mp3$/i.test(file.name || "")) return "audio/mpeg";
    if (/\.wav$/i.test(file.name || "")) return "audio/wav";
    if (/\.aac$/i.test(file.name || "")) return "audio/aac";
    if (/\.ogg$/i.test(file.name || "")) return "audio/ogg";
    return "application/octet-stream";
  }

  async function saveUploadedAsset(asset){
    const sync = syncController();
    const id = projectId();
    if (!sync || typeof sync.collect !== "function" || typeof sync.applyProject !== "function" || !id) {
      throw new Error("project_sync_not_ready");
    }
    const payload = sync.collect();
    payload.music = Object.assign({}, payload.music || {}, { mode:"upload", upload:asset });
    const data = await request("/api/radio-ad/project?id=" + encodeURIComponent(id), {
      method:"PATCH",
      body:JSON.stringify({ project:payload })
    });
    if (data.project) sync.applyProject(data.project);
    return data.project || null;
  }

  async function uploadFile(file){
    if (uploading || !file) return;
    const id = projectId();
    if (!id){
      toast("error", "Radyo reklamı projesi henüz hazır değil.", 3600);
      return;
    }
    if (!validAudioFile(file)){
      if (fileInput) fileInput.value = "";
      renderAsset(null, null, "");
      toast("warning", "MP3, WAV, M4A, AAC veya OGG dosyası seç. En fazla 20 MB.", 4200);
      return;
    }

    uploading = true;
    renderAsset(null, file, "Yükleniyor");
    try{
      const contentType = normalizedType(file);
      const signed = await request("/api/radio-ad/upload-url", {
        method:"POST",
        body:JSON.stringify({
          projectId:id,
          filename:file.name,
          contentType:contentType,
          size:file.size,
          kind:"music-track"
        })
      });

      const uploaded = await fetch(signed.upload_url, {
        method:"PUT",
        headers:signed.required_headers || { "Content-Type":contentType },
        body:file
      });
      if (!uploaded.ok) throw new Error("r2_upload_failed_" + uploaded.status);

      const asset = {
        key:signed.key,
        url:signed.public_url || signed.read_url,
        name:file.name,
        contentType:contentType,
        size:file.size,
        uploadedAt:new Date().toISOString()
      };
      await saveUploadedAsset(asset);
      renderAsset(asset, null, "Buluta kaydedildi");
      toast("success", "Müzik dosyası projeye kaydedildi.", 2800);
    }catch(error){
      console.error("[MOBILE RADIO AD] music upload", error, error && error.data || "");
      renderAsset(null, file, "Yükleme başarısız");
      toast("error", "Müzik dosyası yüklenemedi. Tekrar seçebilirsin.", 4200);
    }finally{
      uploading = false;
    }
  }

  async function removeUploadedAsset(){
    if (uploading) return;
    if (fileInput) fileInput.value = "";
    clearPlayer();
    renderAsset(null, null, "");

    const sync = syncController();
    const id = projectId();
    if (!sync || typeof sync.collect !== "function" || typeof sync.applyProject !== "function" || !id) return;

    try{
      const payload = sync.collect();
      payload.music = Object.assign({}, payload.music || {}, { mode:"upload", upload:null });
      const data = await request("/api/radio-ad/project?id=" + encodeURIComponent(id), {
        method:"PATCH",
        body:JSON.stringify({ project:payload })
      });
      if (data.project) sync.applyProject(data.project);
    }catch(error){
      console.error("[MOBILE RADIO AD] music remove", error);
      toast("error", "Müzik kaydı projeden kaldırılamadı.", 3800);
    }
  }

  function restoreFromProject(source){
    if (restoring || !source) return;
    restoring = true;
    try{
      const music = source.music || {};
      const mode = clean(music.mode || modeSelect.value || "ai");
      setMode(mode, false);
      if (mode === "upload"){
        if (music.upload && music.upload.url) renderAsset(music.upload, null, "Buluta kaydedildi");
        else if (!fileInput.files || !fileInput.files[0]) renderAsset(null, null, "");
      }
    }finally{
      restoring = false;
    }
  }

  modeButtons.forEach(function(button){
    button.addEventListener("click", function(){
      setMode(button.getAttribute("data-mobile-radio-music-mode"), true);
    });
  });

  if (fileInput){
    fileInput.addEventListener("change", function(){
      const file = fileInput.files && fileInput.files[0];
      if (file) uploadFile(file);
      else renderAsset(null, null, "");
    });
  }

  if (removeButton) removeButton.addEventListener("click", removeUploadedAsset);

  if (playButton){
    playButton.addEventListener("click", function(){
      if (!audio || !audio.src) return;
      if (audio.paused) audio.play().catch(function(){ toast("error", "Müzik oynatılamadı.", 3000); });
      else audio.pause();
    });
  }

  if (progress){
    progress.addEventListener("input", function(){
      if (!audio || !audio.duration) return;
      audio.currentTime = Number(progress.value) / 1000 * audio.duration;
    });
  }

  if (audio){
    ["loadedmetadata","durationchange","timeupdate","play","pause","ended"].forEach(function(name){
      audio.addEventListener(name, syncPlayer);
    });
  }

  document.addEventListener("aivo:mobile-radioad-project-sync", function(event){
    restoreFromProject(event && event.detail && event.detail.project);
  });

  window.addEventListener("pagehide", function(){
    clearPlayer();
  }, { once:true });

  window.AIVOMobileRadioAdMusic = {
    setMode:setMode,
    restore:restoreFromProject,
    upload:uploadFile
  };

  const initial = project();
  setMode(clean(initial && initial.music && initial.music.mode || modeSelect.value || "ai"), false);
  restoreFromProject(initial);
})();