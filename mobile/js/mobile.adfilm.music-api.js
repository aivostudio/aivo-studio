(function AIVO_MOBILE_ADFILM_MUSIC_API(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_MUSIC_API_V1__) return;
  window.__AIVO_MOBILE_ADFILM_MUSIC_API_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const card = root.querySelector("[data-mobile-adfilm-music]");
  if (!card) return;

  const autoPanel = card.querySelector('[data-mobile-adfilm-music-panel="auto"]');
  const uploadPanel = card.querySelector('[data-mobile-adfilm-music-panel="upload"]');
  const styleSelect = card.querySelector("#mobileAdFilmMusicStyle");
  const energySelect = card.querySelector("#mobileAdFilmMusicEnergy");
  const fileInput = card.querySelector("#mobileAdFilmMusicFile");
  const durationSelect = root.querySelector("#mobileAdFilmDuration");
  const statusNode = root.querySelector(".mobile-adfilm-action-status");

  let busy = false;
  let pollTimer = null;
  let generatedAudio = null;
  let generatedObjectUrl = "";

  function clean(value){ return String(value == null ? "" : value).trim(); }
  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

  function toast(type, message, duration){
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration == null ? 3200 : duration });
      }
      if (typeof window.showToast === "function") return window.showToast(message, type);
    } catch (_) {}
    return null;
  }

  function setStatus(mode, message){
    root.dataset.adfilmMusicStatus = mode;
    if (!statusNode) return;
    statusNode.dataset.state = mode;
    statusNode.textContent = message;
  }

  async function request(path, options){
    let response;
    try {
      response = await fetch(path, Object.assign({
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" }
      }, options || {}));
    } catch (error) {
      error.status = 0;
      throw error;
    }

    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.message || data.error || ("HTTP " + response.status));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function syncController(){ return window.AIVOMobileAdFilmProjectSync || null; }
  function project(){
    const sync = syncController();
    return sync && typeof sync.project === "function" ? sync.project() : window.AIVOAdFilmActiveProject || null;
  }
  function projectId(){
    const sync = syncController();
    return clean(root.dataset.adfilmProjectId || (sync && typeof sync.projectId === "function" && sync.projectId()) || (project() && project().id));
  }

  function currentMode(){
    const mode = clean(root.dataset.adfilmMusicMode || "auto");
    return mode === "upload" || mode === "off" ? mode : "auto";
  }

  function serverStyle(){
    const value = clean(styleSelect && styleSelect.value).toLowerCase();
    return ["auto", "pop", "cinematic", "electronic", "classical", "rnb", "latin"].includes(value) ? value : "auto";
  }

  function serverEnergy(){
    const value = clean(energySelect && energySelect.value).toLowerCase();
    if (value === "soft" || value === "calm") return "calm";
    if (value === "strong" || value === "high") return "strong";
    return "balanced";
  }

  function currentDuration(){
    const value = Math.round(Number(durationSelect && durationSelect.value) || 10);
    return Math.max(5, Math.min(15, value));
  }

  function ensureGenerateButton(){
    if (!autoPanel) return null;
    let button = autoPanel.querySelector("[data-mobile-adfilm-music-generate]");
    if (button) return button;

    button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-adfilm-music-generate";
    button.setAttribute("data-mobile-adfilm-music-generate", "");
    button.innerHTML = '<span class="mobile-adfilm-music-generate-icon" aria-hidden="true"></span><span class="mobile-adfilm-music-generate-copy"><b>Reklam müziğini hazırla</b><small>Stable Audio ile seçtiğin stile göre üret.</small></span>';
    autoPanel.appendChild(button);
    return button;
  }

  function ensureGeneratedPlayer(){
    if (!autoPanel) return null;
    let holder = autoPanel.querySelector("[data-mobile-adfilm-generated-music]");
    if (holder) return holder;

    holder = document.createElement("div");
    holder.className = "mobile-adfilm-music-file mobile-adfilm-music-generated";
    holder.setAttribute("data-mobile-adfilm-generated-music", "");
    holder.hidden = true;
    holder.innerHTML = `
      <div class="mobile-adfilm-music-file-head">
        <span class="mobile-adfilm-music-file-note" aria-hidden="true"></span>
        <div class="mobile-adfilm-music-file-copy">
          <b data-mobile-adfilm-generated-name>Reklam müziği hazır</b>
          <small class="mobile-adfilm-music-cloud-state" data-mobile-adfilm-generated-meta>Buluta kaydedildi</small>
        </div>
      </div>
      <div class="mobile-adfilm-music-player">
        <button class="mobile-adfilm-music-play" type="button" data-mobile-adfilm-generated-play aria-label="Müziği oynat"></button>
        <input class="mobile-adfilm-music-progress" type="range" min="0" max="1000" value="0" step="1" data-mobile-adfilm-generated-progress aria-label="Müzik ilerleme çubuğu">
        <span class="mobile-adfilm-music-time" data-mobile-adfilm-generated-time>0:00 / 0:00</span>
        <audio preload="metadata" data-mobile-adfilm-generated-audio></audio>
      </div>
    `;
    autoPanel.appendChild(holder);

    const audio = holder.querySelector("[data-mobile-adfilm-generated-audio]");
    const play = holder.querySelector("[data-mobile-adfilm-generated-play]");
    const progress = holder.querySelector("[data-mobile-adfilm-generated-progress]");
    const time = holder.querySelector("[data-mobile-adfilm-generated-time]");

    function formatTime(value){
      const seconds = Number.isFinite(value) ? value : 0;
      return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
    }

    function syncPlayer(){
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      progress.value = duration ? String(Math.round(current / duration * 1000)) : "0";
      time.textContent = formatTime(current) + " / " + formatTime(duration);
      const playing = !audio.paused && !audio.ended;
      play.classList.toggle("is-playing", playing);
      play.setAttribute("aria-label", playing ? "Müziği duraklat" : "Müziği oynat");
    }

    play.addEventListener("click", function(){
      if (!audio.src) return;
      if (audio.paused) audio.play().catch(function(){});
      else audio.pause();
    });
    progress.addEventListener("input", function(){
      if (!audio.duration) return;
      audio.currentTime = Number(progress.value) / 1000 * audio.duration;
    });
    ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"].forEach(function(name){
      audio.addEventListener(name, syncPlayer);
    });

    return holder;
  }

  function renderGenerated(audioAsset){
    const holder = ensureGeneratedPlayer();
    if (!holder) return;
    const audio = holder.querySelector("[data-mobile-adfilm-generated-audio]");
    const meta = holder.querySelector("[data-mobile-adfilm-generated-meta]");
    const url = clean(audioAsset && audioAsset.url);
    holder.hidden = !url;
    if (!url) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    if (audio.src !== url) {
      audio.pause();
      audio.src = url;
      audio.load();
    }
    const duration = Number(audioAsset && audioAsset.duration);
    if (meta) meta.textContent = (duration ? duration + " sn · " : "") + "Buluta kaydedildi";
  }

  function setBusy(on, message){
    busy = !!on;
    const button = ensureGenerateButton();
    if (button) {
      button.disabled = busy;
      button.classList.toggle("is-busy", busy);
      const title = button.querySelector("b");
      const detail = button.querySelector("small");
      if (title) title.textContent = busy ? "Reklam müziği hazırlanıyor..." : "Reklam müziğini hazırla";
      if (detail) detail.textContent = busy ? (message || "Müzik motorundan sonuç bekleniyor.") : "Stable Audio ile seçtiğin stile göre üret.";
    }
  }

  async function uploadCustomTrack(){
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return null;
    const id = projectId();
    if (!id) throw new Error("project_not_ready");

    const api = window.AIVOMobileAdFilmProjects || window.AIVOAdFilmProjects;
    if (!api || typeof api.uploadFile !== "function") throw new Error("upload_api_not_ready");

    setStatus("uploading", "Müzik dosyası buluta yükleniyor...");
    const uploaded = await api.uploadFile(id, file, "music-track");
    const sync = syncController();
    const source = project();
    if (!sync || !source) throw new Error("project_sync_not_ready");

    source.media = Object.assign({}, source.media || {}, {
      musicTrack: {
        key: uploaded.key,
        url: uploaded.publicUrl || uploaded.url,
        name: uploaded.name,
        contentType: uploaded.contentType,
        size: uploaded.size,
        kind: uploaded.kind,
        uploadedAt: uploaded.uploadedAt
      }
    });
    source.music = Object.assign({}, source.music || {}, { mode: "upload", track: source.media.musicTrack });
    await sync.save();
    setStatus("saved", "Müzik dosyası buluta kaydedildi.");
    toast("success", "Müzik dosyası projeye bağlandı.", 2600);
    return source.media.musicTrack;
  }

  async function createAutoMusic(){
    const id = projectId();
    if (!id) throw new Error("project_not_ready");
    const sync = syncController();
    if (sync && typeof sync.save === "function") await sync.save();

    const body = {
      projectId: id,
      musicStyle: serverStyle(),
      musicEnergy: serverEnergy(),
      duration: currentDuration()
    };

    setBusy(true, "Müzik üretimi başlatılıyor.");
    setStatus("music", "Reklam müziği hazırlanıyor...");
    let result = await request("/api/ad-film/music/create", { method: "POST", body: JSON.stringify(body) });
    if (result.project) {
      window.AIVOAdFilmActiveProject = result.project;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync", { detail: { project: result.project, projectId: id, media: result.project.media || {}, mobile: true } }));
    }

    if (result.status === "DISABLED") return result;
    if (result.status === "COMPLETED" && result.project && result.project.music && result.project.music.audio) {
      renderGenerated(result.project.music.audio);
      return result;
    }

    for (let index = 0; index < 120; index += 1) {
      setBusy(true, "Müzik motorundan sonuç bekleniyor · " + (index + 1));
      await sleep(1800);
      result = await request("/api/ad-film/music/status?projectId=" + encodeURIComponent(id), { method: "GET" });
      if (result.project) {
        window.AIVOAdFilmActiveProject = result.project;
        document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync", { detail: { project: result.project, projectId: id, media: result.project.media || {}, mobile: true } }));
      }
      if (result.status === "FAILED") throw new Error(clean(result.error) || "music_generation_failed");
      if (result.status === "COMPLETED") {
        const audio = result.audio || (result.project && result.project.music && result.project.music.audio);
        if (!audio || !audio.url) throw new Error("music_audio_missing");
        renderGenerated(audio);
        return result;
      }
    }
    throw new Error("music_generation_timeout");
  }

  async function prepareMusic(){
    if (busy) return;
    try {
      const mode = currentMode();
      if (mode === "off") {
        const sync = syncController();
        if (sync && typeof sync.save === "function") await sync.save();
        renderGenerated(null);
        setStatus("saved", "Müzik kullanılmayacak.");
        toast("success", "Bu reklamda müzik kullanılmayacak.", 2200);
        return;
      }
      if (mode === "upload") {
        setBusy(true, "Müzik dosyası yükleniyor.");
        await uploadCustomTrack();
        return;
      }

      const result = await createAutoMusic();
      const audio = result && (result.audio || result.project && result.project.music && result.project.music.audio);
      renderGenerated(audio || null);
      setStatus("saved", "Reklam müziği hazır.");
      toast("success", "Reklam müziği hazır ve projeye kaydedildi.", 3000);
    } catch (error) {
      console.error("[MOBILE ADFILM] music API", error, error && error.data || "");
      const code = clean(error && error.data && error.data.error || error && error.message).toLowerCase();
      if (error && error.status === 401) toast("warning", "Reklam müziği için AIVO hesabına giriş yapmalısın.", 4200);
      else if (code.indexOf("invalid_music_duration") >= 0) toast("warning", "Müzik süresi 5–15 saniye arasında olmalı.", 4200);
      else toast("error", "Reklam müziği hazırlanamadı. Tekrar deneyebilirsin.", 4400);
      setStatus("error", "Reklam müziği hazırlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  function restoreFromProject(source){
    source = source || project();
    const mode = clean(source && source.music && source.music.mode || currentMode());
    if (mode === "auto" && source && source.music && source.music.audio && source.music.audio.url) {
      renderGenerated(source.music.audio);
    } else if (mode !== "auto") {
      renderGenerated(null);
    }
  }

  function install(){
    const button = ensureGenerateButton();
    ensureGeneratedPlayer();
    if (button && !button.__musicApiBound) {
      button.__musicApiBound = true;
      button.addEventListener("click", prepareMusic);
    }

    if (fileInput && !fileInput.__musicApiBound) {
      fileInput.__musicApiBound = true;
      fileInput.addEventListener("change", function(){
        if (currentMode() === "upload" && fileInput.files && fileInput.files[0]) {
          setTimeout(function(){ prepareMusic(); }, 0);
        }
      });
    }

    restoreFromProject(project());
  }

  document.addEventListener("aivo:adfilm-project-sync", function(event){
    restoreFromProject(event && event.detail && event.detail.project);
  });

  window.addEventListener("pagehide", function(){
    clearTimeout(pollTimer);
    if (generatedAudio) generatedAudio.pause();
    if (generatedObjectUrl) {
      try { URL.revokeObjectURL(generatedObjectUrl); } catch (_) {}
    }
  });

  window.AIVOMobileAdFilmMusic = {
    prepare: prepareMusic,
    restore: restoreFromProject,
    currentMode: currentMode
  };

  install();
})();