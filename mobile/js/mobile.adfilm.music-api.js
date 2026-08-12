(function AIVO_MOBILE_ADFILM_MUSIC_API(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_MUSIC_API_V2__) return;
  window.__AIVO_MOBILE_ADFILM_MUSIC_API_V2__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const card = root.querySelector("[data-mobile-adfilm-music]");
  if (!card) return;

  const MUSIC_MODE_KEY = "aivo_adfilm_music_mode_v1";

  function clean(value){ return String(value == null ? "" : value).trim(); }

  function toast(type, message, duration){
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration == null ? 3200 : duration });
      }
      if (typeof window.showToast === "function") return window.showToast(message, type);
    } catch (_) {}
    return null;
  }

  function syncController(){ return window.AIVOMobileAdFilmProjectSync || null; }

  function project(){
    const sync = syncController();
    return sync && typeof sync.project === "function"
      ? sync.project()
      : window.AIVOAdFilmActiveProject || null;
  }

  function projectId(){
    const sync = syncController();
    return clean(
      root.dataset.adfilmProjectId ||
      (sync && typeof sync.projectId === "function" && sync.projectId()) ||
      (project() && project().id)
    );
  }

  function storedMode(){
    try { return clean(localStorage.getItem(MUSIC_MODE_KEY)) || "auto"; }
    catch (_) { return "auto"; }
  }

  function normalizeMode(value){
    const mode = clean(value).toLowerCase();
    return mode === "upload" || mode === "off" ? mode : "auto";
  }

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
  let remoteTrack = null;
  let uploading = false;

  function formatTime(value){
    const seconds = Number.isFinite(value) ? value : 0;
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function formatSize(bytes){
    const size = Number(bytes) || 0;
    return size > 0 ? Math.max(0.1, size / 1024 / 1024).toFixed(1) + " MB" : "Buluta kaydedildi";
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
    if (!musicObjectUrl) return;
    try { URL.revokeObjectURL(musicObjectUrl); } catch (_) {}
    musicObjectUrl = "";
  }

  function clearPlayer(){
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    clearObjectUrl();
    if (progress) progress.value = "0";
    if (time) time.textContent = "0:00 / 0:00";
    if (playButton) playButton.classList.remove("is-playing");
  }

  function showTrack(name, size, url){
    if (picker) picker.hidden = true;
    if (fileView) fileView.hidden = false;
    if (fileName) fileName.textContent = clean(name) || "Reklam müziği";
    if (fileSize) fileSize.textContent = formatSize(size);
    if (audio && clean(url)) {
      audio.pause();
      audio.src = url;
      audio.load();
    }
    syncPlayer();
  }

  function showEmptyUpload(){
    if (picker) picker.hidden = false;
    if (fileView) fileView.hidden = true;
    if (fileName) fileName.textContent = "";
    if (fileSize) fileSize.textContent = "";
    remoteTrack = null;
    clearPlayer();
  }

  function renderSelectedFile(){
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      if (remoteTrack && clean(remoteTrack.url)) {
        showTrack(remoteTrack.name, remoteTrack.size, remoteTrack.url);
      } else {
        showEmptyUpload();
      }
      return;
    }

    if (!/^audio\//i.test(file.type) && !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name || "")) {
      fileInput.value = "";
      toast("warning", "Desteklenen bir ses dosyası seç: MP3, WAV, M4A, AAC veya OGG.", 3600);
      renderSelectedFile();
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      fileInput.value = "";
      toast("warning", "Müzik dosyası en fazla 20 MB olabilir.", 3600);
      renderSelectedFile();
      return;
    }

    remoteTrack = null;
    clearPlayer();
    musicObjectUrl = URL.createObjectURL(file);
    showTrack(file.name, file.size, musicObjectUrl);
  }

  function setMode(value, persist){
    const mode = normalizeMode(value);
    root.dataset.adfilmMusicMode = mode;

    modeButtons.forEach(function(button){
      const active = button.getAttribute("data-mobile-adfilm-music-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    panels.forEach(function(panel){
      panel.hidden = panel.getAttribute("data-mobile-adfilm-music-panel") !== mode;
    });

    if (mode !== "upload" && audio) audio.pause();

    if (persist !== false) {
      try { localStorage.setItem(MUSIC_MODE_KEY, mode); } catch (_) {}
    }
  }

  async function uploadCustomTrack(){
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      if (remoteTrack && clean(remoteTrack.url)) return remoteTrack;
      const source = project();
      const existing = source && source.media && source.media.musicTrack;
      if (existing && clean(existing.url)) return existing;
      throw new Error("music_upload_required");
    }

    if (uploading) throw new Error("music_upload_in_progress");
    const id = projectId();
    if (!id) throw new Error("project_not_ready");

    const api = window.AIVOMobileAdFilmProjects || window.AIVOAdFilmProjects;
    if (!api || typeof api.uploadFile !== "function") throw new Error("upload_api_not_ready");

    uploading = true;
    try {
      const uploaded = await api.uploadFile(id, file, "music-track");
      const sync = syncController();
      const source = project();
      if (!sync || !source) throw new Error("project_sync_not_ready");

      const track = {
        key: uploaded.key,
        url: uploaded.publicUrl || uploaded.url,
        publicUrl: uploaded.publicUrl || null,
        readUrl: uploaded.readUrl || null,
        name: uploaded.name,
        contentType: uploaded.contentType,
        size: uploaded.size,
        kind: uploaded.kind,
        uploadedAt: uploaded.uploadedAt
      };

      source.media = Object.assign({}, source.media || {}, { musicTrack: track });
      source.music = Object.assign({}, source.music || {}, {
        mode: "upload",
        style: "auto",
        energy: "balanced",
        track: track
      });

      remoteTrack = track;
      if (typeof sync.save === "function") await sync.save();
      showTrack(track.name, track.size, track.url);
      return track;
    } finally {
      uploading = false;
    }
  }

  async function prepareMusic(){
    const mode = normalizeMode(root.dataset.adfilmMusicMode || storedMode());
    const sync = syncController();

    if (mode === "upload") return uploadCustomTrack();

    if (sync && typeof sync.save === "function") await sync.save();
    return project();
  }

  function restoreFromProject(source){
    source = source || project();
    const music = source && source.music || {};
    const mode = normalizeMode(music.mode || storedMode());
    const track = source && source.media && source.media.musicTrack;

    setMode(mode, true);

    if (mode === "upload" && track && clean(track.url)) {
      remoteTrack = track;
      showTrack(track.name, track.size, track.url);
    } else if (mode !== "upload") {
      remoteTrack = null;
      clearPlayer();
    }
  }

  modeButtons.forEach(function(button){
    button.addEventListener("click", function(){
      setMode(button.getAttribute("data-mobile-adfilm-music-mode"), true);
    });
  });

  if (fileInput) fileInput.addEventListener("change", renderSelectedFile);

  if (removeButton) {
    removeButton.addEventListener("click", function(){
      if (fileInput) fileInput.value = "";
      remoteTrack = null;
      showEmptyUpload();
      toast("success", "Müzik dosyası kaldırıldı.", 2200);
    });
  }

  if (playButton && audio) {
    playButton.addEventListener("click", function(){
      if (!audio.src) return;
      if (audio.paused) audio.play().catch(function(){});
      else audio.pause();
    });
  }

  if (progress && audio) {
    progress.addEventListener("input", function(){
      if (!audio.duration) return;
      audio.currentTime = Number(progress.value) / 1000 * audio.duration;
    });
  }

  if (audio) {
    ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"].forEach(function(name){
      audio.addEventListener(name, syncPlayer);
    });
  }

  document.addEventListener("aivo:adfilm-project-sync", function(event){
    const source = event && event.detail && event.detail.project;
    if (source) restoreFromProject(source);
  });

  window.addEventListener("pagehide", function(){
    if (audio) audio.pause();
    clearObjectUrl();
  }, { once: true });

  window.AIVOMobileAdFilmMusic = {
    prepare: prepareMusic,
    restore: restoreFromProject,
    currentMode: function(){ return normalizeMode(root.dataset.adfilmMusicMode || storedMode()); }
  };

  restoreFromProject(project());
})();