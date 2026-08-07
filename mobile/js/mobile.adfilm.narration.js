(function AIVO_MOBILE_ADFILM_NARRATION(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_NARRATION_V1__) return;
  window.__AIVO_MOBILE_ADFILM_NARRATION_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const preview = root.querySelector("[data-mobile-adfilm-voice-preview]");
  const statusNode = root.querySelector(".mobile-adfilm-voice-preview-status");
  const playButton = root.querySelector(".mobile-adfilm-voice-play");
  const volumeButton = root.querySelector(".mobile-adfilm-voice-volume");
  const deleteButton = root.querySelector(".mobile-adfilm-voice-delete");
  const progressLine = root.querySelector(".mobile-adfilm-voice-preview-line");
  const timeNode = root.querySelector(".mobile-adfilm-voice-time");
  const createButton = root.querySelector(".mobile-adfilm-voice-create");
  const approveButton = root.querySelector(".mobile-adfilm-voice-approve");
  const filmCreateButton = root.querySelector(".mobile-adfilm-create-button");
  const narrationText = root.querySelector("#mobileAdFilmNarrationText");
  const language = root.querySelector("#mobileAdFilmVoiceLanguage");
  const voiceStyle = root.querySelector("#mobileAdFilmVoiceStyle");
  const voiceSelect = root.querySelector("#mobileAdFilmVoice");
  const speed = root.querySelector("#mobileAdFilmVoiceSpeed");
  const duration = root.querySelector("#mobileAdFilmDuration");
  const voiceEnabled = root.querySelector("#mobileAdFilmVoiceEnabled");

  if (!preview || !createButton || !approveButton || !narrationText) return;

  const VOICE_TO_API = {
    "warm-female": "warm_female",
    "warm-male": "energetic_male",
    "premium-female": "clear_female",
    "premium-male": "professional_male",
    "warm_female": "warm_female",
    "energetic_male": "energetic_male",
    "clear_female": "clear_female",
    "professional_male": "professional_male"
  };
  const VOICE_FROM_API = {
    warm_female: "warm-female",
    energetic_male: "warm-male",
    clear_female: "premium-female",
    professional_male: "premium-male"
  };

  let pollTimer = null;
  let busy = false;
  let mastering = false;
  let approving = false;
  let fallbackNotified = false;
  let runToken = 0;
  let currentAudioUrl = "";

  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.hidden = true;
  preview.appendChild(audio);

  const progressFill = document.createElement("i");
  progressFill.setAttribute("aria-hidden", "true");
  progressFill.style.display = "block";
  progressFill.style.width = "0%";
  progressFill.style.height = "100%";
  progressFill.style.borderRadius = "inherit";
  progressFill.style.background = "linear-gradient(90deg,#8b5cf6,#ec4899)";
  progressFill.style.pointerEvents = "none";
  if (progressLine) progressLine.appendChild(progressFill);

  function clean(value){ return String(value == null ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }

  function toast(type, message, duration){
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration == null ? 3400 : duration });
      }
      if (typeof window.showToast === "function") return window.showToast(message, type);
    } catch (_) {}
    return null;
  }

  function project(){
    return window.AIVOAdFilmActiveProject && typeof window.AIVOAdFilmActiveProject === "object"
      ? window.AIVOAdFilmActiveProject
      : null;
  }

  function projectId(){
    const sync = window.AIVOMobileAdFilmProjectSync;
    return clean(root.dataset.adfilmProjectId || (sync && typeof sync.projectId === "function" && sync.projectId()) || (project() && project().id));
  }

  function currentText(){ return clean(narrationText.value); }
  function generatedText(source){
    source = source || project() || {};
    const narration = source.narration || {};
    const generation = source.narrationGeneration || {};
    const audioState = narration.audio || {};
    return clean(audioState.approvedText || (generation.input && generation.input.text) || "");
  }

  function apiVoice(){
    const value = clean(voiceSelect && voiceSelect.value);
    return VOICE_TO_API[value] || "warm_female";
  }

  function setMobileVoice(apiValue){
    if (!voiceSelect) return;
    const next = VOICE_FROM_API[clean(apiValue)];
    if (next && Array.from(voiceSelect.options).some(function(option){ return option.value === next; })) {
      voiceSelect.value = next;
    }
  }

  function request(path, options){
    return fetch(path, Object.assign({
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" }
    }, options || {})).then(async function(response){
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) {
        const error = new Error(data.message || data.error || ("HTTP " + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    });
  }

  function stopPolling(){
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function setPreviewState(state, message){
    preview.dataset.state = state;
    if (statusNode) statusNode.textContent = message;
  }

  function formatTime(value){
    const seconds = Number.isFinite(value) && value > 0 ? value : 0;
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function syncPlayer(){
    const total = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const percent = total ? Math.max(0, Math.min(100, current / total * 100)) : 0;
    if (progressFill) progressFill.style.width = percent + "%";
    if (timeNode) timeNode.textContent = formatTime(current) + " / " + formatTime(total);
    const playing = !audio.paused && !audio.ended;
    if (playButton) {
      playButton.classList.toggle("is-playing", playing);
      playButton.setAttribute("aria-label", playing ? "Ses ön izlemeyi duraklat" : "Ses ön izlemeyi oynat");
    }
  }

  function clearAudio(){
    try { audio.pause(); } catch (_) {}
    audio.removeAttribute("src");
    audio.load();
    currentAudioUrl = "";
    if (progressFill) progressFill.style.width = "0%";
    if (timeNode) timeNode.textContent = "0:00 / 0:00";
    if (playButton) {
      playButton.disabled = true;
      playButton.classList.remove("is-playing");
      playButton.style.opacity = ".48";
    }
    if (volumeButton) {
      volumeButton.disabled = true;
      volumeButton.style.opacity = ".45";
    }
  }

  function loadAudio(url){
    url = clean(url);
    if (!url) {
      clearAudio();
      return;
    }
    if (currentAudioUrl !== url) {
      try { audio.pause(); } catch (_) {}
      currentAudioUrl = url;
      audio.src = url;
      audio.load();
    }
    if (playButton) {
      playButton.disabled = false;
      playButton.style.opacity = "1";
    }
    if (volumeButton) {
      volumeButton.disabled = false;
      volumeButton.style.opacity = "1";
    }
  }

  function createButtonLabel(){
    const source = project() || {};
    const sourceAudio = source.narration && source.narration.audio;
    const changed = !!(sourceAudio && sourceAudio.url && generatedText(source) && generatedText(source) !== currentText());
    return sourceAudio && sourceAudio.url ? (changed ? "Güncel sesi yeniden üret" : "Sesi yeniden üret") : "Sesi oluştur";
  }

  function canStart(){
    if (busy || approving) return false;
    if (voiceEnabled && !voiceEnabled.checked) return false;
    if (!projectId()) return false;
    return currentText().length >= 3;
  }

  function setBusy(nextBusy, state){
    busy = !!nextBusy;
    if (createButton) {
      createButton.disabled = busy || !canStart();
      createButton.setAttribute("aria-busy", busy ? "true" : "false");
      createButton.textContent = busy ? (state === "mastering" ? "Ses işleniyor…" : "Ses üretiliyor…") : createButtonLabel();
    }
    window.__AIVO_MOBILE_ADFILM_NARRATION_BUSY__ = busy;
  }

  function narrationState(source){
    source = source || project() || {};
    if (voiceEnabled && !voiceEnabled.checked) return { ready: true, code: "off", reason: "" };
    const audioState = source.narration && source.narration.audio;
    const generation = source.narrationGeneration || {};
    const approvedSourceText = clean((audioState && audioState.approvedText) || (generation.input && generation.input.text) || "");
    if (!audioState || !clean(audioState.url)) return { ready: false, code: "missing", reason: "Önce reklam sesini oluştur, dinle ve onayla." };
    if (audioState.mastered !== true || Number(audioState.masteringVersion) < 2) return { ready: false, code: "mastering", reason: "Ses profesyonel olarak işleniyor. Tamamlanmasını bekle." };
    if (approvedSourceText && approvedSourceText !== currentText()) return { ready: false, code: "changed", reason: "Onaylanan ses eski metne ait. Güncel metin için sesi yeniden üretip onayla." };
    if (audioState.approved !== true) return { ready: false, code: "approval", reason: "Reklam filmini oluşturmadan önce sesi dinleyip onayla." };
    return { ready: true, code: "ready", reason: "" };
  }

  function syncFilmGuard(){
    const check = narrationState();
    root.dataset.adfilmNarrationGuard = check.ready ? "ready" : "blocked";
    root.dataset.adfilmNarrationGuardCode = check.code;
    if (filmCreateButton) {
      filmCreateButton.dataset.audioApprovalGuard = check.ready ? "ready" : "blocked";
      filmCreateButton.title = check.ready ? "" : check.reason;
    }
    return check;
  }

  function render(source){
    source = source || project() || {};
    const narration = source.narration || {};
    const generation = source.narrationGeneration || {};
    const audioState = narration.audio || null;
    const status = clean(generation.status).toLowerCase();

    setMobileVoice(narration.voice);

    if (status === "queued" || status === "processing") {
      clearAudio();
      setPreviewState(status, status === "queued" ? "Reklam sesi sıraya alındı…" : "Reklam sesi üretiliyor…");
      setBusy(true, status);
      schedulePoll(0, runToken);
      syncFilmGuard();
      return;
    }

    const changed = !!(audioState && audioState.url && generatedText(source) && generatedText(source) !== currentText());
    if (audioState && audioState.url && audioState.mastered === true && Number(audioState.masteringVersion) >= 2) {
      loadAudio(audioState.url);
      if (changed) {
        setPreviewState("changed", "Metin değişti. Güncel metin için sesi yeniden üret.");
        approveButton.disabled = true;
        approveButton.textContent = "Sesi onayla";
        approveButton.classList.remove("is-approved");
      } else if (audioState.approved === true) {
        setPreviewState("approved", "Ses onaylandı.");
        approveButton.disabled = true;
        approveButton.textContent = "Onaylandı";
        approveButton.classList.add("is-approved");
      } else {
        setPreviewState("ready", "Reklam sesi hazır. Dinleyip onaylayabilirsin.");
        approveButton.disabled = false;
        approveButton.textContent = "Sesi onayla";
        approveButton.classList.remove("is-approved");
      }
    } else {
      clearAudio();
      approveButton.disabled = true;
      approveButton.textContent = "Sesi onayla";
      approveButton.classList.remove("is-approved");
      setPreviewState("idle", "Henüz ses oluşturulmadı.");
    }

    setBusy(false);
    syncFilmGuard();
  }

  function emitProject(nextProject){
    if (!nextProject) return;
    window.AIVOAdFilmActiveProject = nextProject;
    try {
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync", {
        detail: {
          project: nextProject,
          projectId: nextProject.id || projectId(),
          media: nextProject.media || {},
          mobile: true,
          narration: true
        }
      }));
    } catch (_) {}
  }

  function payload(){
    return {
      projectId: projectId(),
      text: currentText(),
      language: clean(language && language.value) || "tr",
      voice: apiVoice(),
      voiceStyle: clean(voiceStyle && voiceStyle.value) || "warm",
      speed: clean(speed && speed.value) || "balanced",
      flow: "natural",
      duration: Math.max(5, Math.min(15, Math.round(Number(duration && duration.value) || 5)))
    };
  }

  async function masterAndPresent(token){
    if (mastering || token !== runToken) return;
    mastering = true;
    setBusy(true, "mastering");
    setPreviewState("mastering", "Ses profesyonel olarak işleniyor…");
    try {
      const data = await request("/api/ad-film/narration/master", {
        method: "POST",
        body: JSON.stringify({ projectId: projectId() })
      });
      if (token !== runToken) return;
      if (!data.project || !data.audio || data.audio.mastered !== true) throw new Error("narration_master_incomplete");
      stopPolling();
      mastering = false;
      setBusy(false);
      emitProject(data.project);
      render(data.project);
      toast("success", "Ses hazır. Dinleyip onaylayabilirsin.", 3000);
    } catch (error) {
      if (token !== runToken) return;
      console.error("[MOBILE ADFILM] narration mastering", error);
      stopPolling();
      mastering = false;
      setBusy(false);
      setPreviewState("failed", "Ses profesyonel olarak hazırlanamadı. Tekrar deneyebilirsin.");
      toast("warning", "Ses profesyonel olarak hazırlanamadı. Tekrar deneyebilirsin.", 4200);
      syncFilmGuard();
    }
  }

  function schedulePoll(attempt, token){
    stopPolling();
    pollTimer = setTimeout(function(){ poll(attempt || 0, token); }, 1800);
  }

  async function poll(attempt, token){
    token = token == null ? runToken : token;
    if (token !== runToken || !projectId()) return;
    try {
      const data = await request("/api/ad-film/narration/status?projectId=" + encodeURIComponent(projectId()), { method: "GET" });
      if (token !== runToken) return;
      if (data.fallback_used && !fallbackNotified) {
        fallbackNotified = true;
        toast("info", "Ana ses servisi geçici sorun yaşadı; AIVO yedek motorla devam ediyor.", 3600);
      }
      if (data.status === "COMPLETED") {
        stopPolling();
        const active = project() || {};
        const next = Object.assign({}, active, {
          narration: Object.assign({}, active.narration || {}, { audio: data.audio || (active.narration && active.narration.audio) || null }),
          narrationGeneration: Object.assign({}, active.narrationGeneration || {}, { status: "completed" })
        });
        window.AIVOAdFilmActiveProject = next;
        if (data.audio && data.audio.mastered === true && Number(data.audio.masteringVersion) >= 2) {
          setBusy(false);
          render(next);
          toast("success", "Ses hazır. Dinleyip onaylayabilirsin.", 3000);
        } else {
          await masterAndPresent(token);
        }
        return;
      }
      if (data.status === "FAILED") {
        stopPolling();
        setBusy(false);
        setPreviewState("failed", "Ses hazırlanamadı. Tekrar deneyebilirsin.");
        syncFilmGuard();
        return;
      }
      setBusy(true, data.status === "IN_QUEUE" ? "queued" : "running");
      setPreviewState(data.status === "IN_QUEUE" ? "queued" : "running", data.status === "IN_QUEUE" ? "Reklam sesi sıraya alındı…" : "Reklam sesi üretiliyor…");
      if ((attempt || 0) < 180) schedulePoll((attempt || 0) + 1, token);
      else {
        stopPolling();
        setBusy(false);
        setPreviewState("failed", "Ses üretim durumu alınamadı.");
        toast("warning", "Ses üretim durumu alınamadı.", 4200);
      }
    } catch (error) {
      if (token !== runToken) return;
      console.error("[MOBILE ADFILM] narration status", error);
      if ((attempt || 0) < 3) schedulePoll((attempt || 0) + 1, token);
      else {
        stopPolling();
        setBusy(false);
        setPreviewState("failed", "Ses üretim durumu alınamadı.");
        toast("warning", "Ses üretim durumu alınamadı.", 4200);
      }
    }
  }

  async function createNarration(){
    if (busy || approving) return;
    const data = payload();
    if (!data.projectId) {
      toast("warning", "Bulut proje bağlantısı henüz hazır değil.", 3600);
      return;
    }
    if (data.text.length < 3) {
      toast("warning", "Önce seslendirme metnini tamamla.", 3400);
      narrationText.focus();
      return;
    }

    runToken += 1;
    const token = runToken;
    fallbackNotified = false;
    stopPolling();
    clearAudio();
    approveButton.disabled = true;
    approveButton.classList.remove("is-approved");
    setBusy(true, "creating");
    setPreviewState("creating", "Reklam sesi üretiliyor…");

    try {
      const result = await request("/api/ad-film/narration/create", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (token !== runToken) return;
      const active = project() || {};
      window.AIVOAdFilmActiveProject = Object.assign({}, active, {
        narration: result.narration || active.narration,
        narrationGeneration: Object.assign({}, active.narrationGeneration || {}, {
          status: "queued",
          input: data
        })
      });
      setBusy(true, "queued");
      setPreviewState("queued", "Reklam sesi sıraya alındı…");
      schedulePoll(0, token);
    } catch (error) {
      if (token !== runToken) return;
      console.error("[MOBILE ADFILM] narration create", error);
      setBusy(false);
      setPreviewState("failed", "Ses hazırlanamadı. Tekrar deneyebilirsin.");
      const code = error && error.data && error.data.error;
      toast("warning", code === "narration_too_long" ? "Metin seçilen video süresinden uzun." : "Ses üretimi başlatılamadı.", 4200);
      syncFilmGuard();
    }
  }

  async function approveNarration(){
    if (approving || busy) return;
    const id = projectId();
    const source = project() || {};
    const audioState = source.narration && source.narration.audio;
    if (!id) {
      toast("warning", "Bulut proje bağlantısı hazır değil.", 3600);
      return;
    }
    if (!audioState || !audioState.url || audioState.mastered !== true || Number(audioState.masteringVersion) < 2) {
      toast("warning", "Ses henüz hazır değil. Üretimin tamamlanmasını bekle.", 3600);
      return;
    }
    if (generatedText(source) && generatedText(source) !== currentText()) {
      render(source);
      toast("warning", "Ses eski metne ait. Güncel metin için sesi yeniden üret.", 4000);
      return;
    }

    approving = true;
    approveButton.disabled = true;
    approveButton.setAttribute("aria-busy", "true");
    approveButton.textContent = "Onaylanıyor…";
    setPreviewState("approving", "Ses onaylanıyor…");
    try {
      const data = await request("/api/ad-film/narration/approve", {
        method: "POST",
        body: JSON.stringify({ projectId: id })
      });
      if (!data.project) throw new Error("narration_approval_incomplete");
      emitProject(data.project);
      render(data.project);
      toast("success", "Ses onaylandı.", 2600);
    } catch (error) {
      console.error("[MOBILE ADFILM] narration approval", error);
      render(project());
      toast("warning", error && error.data && error.data.error === "narration_text_changed" ? "Metin değişti. Güncel ses için yeniden üret." : "Ses onaylanamadı. Tekrar deneyebilirsin.", 4000);
    } finally {
      approving = false;
      approveButton.setAttribute("aria-busy", "false");
      render(project());
    }
  }

  async function persistVoice(){
    const sync = window.AIVOMobileAdFilmProjectSync;
    const id = projectId();
    if (!sync || !id || typeof sync.collect !== "function" || !window.AIVOMobileAdFilmProjects) return;
    const payload = sync.collect();
    payload.narration = Object.assign({}, payload.narration || {}, { voice: apiVoice() });
    try {
      const data = await window.AIVOMobileAdFilmProjects.updateProject(id, payload);
      if (data && data.project) emitProject(data.project);
    } catch (error) {
      console.warn("[MOBILE ADFILM] voice preference save", error);
    }
  }

  createButton.addEventListener("click", function(event){
    event.preventDefault();
    createNarration();
  });

  approveButton.addEventListener("click", function(event){
    event.preventDefault();
    approveNarration();
  });

  if (playButton) {
    playButton.addEventListener("click", function(){
      if (!audio.src) return;
      if (audio.paused) audio.play().catch(function(){});
      else audio.pause();
    });
  }

  if (volumeButton) {
    volumeButton.addEventListener("click", function(){
      if (!audio.src) return;
      audio.muted = !audio.muted;
      volumeButton.setAttribute("aria-label", audio.muted ? "Sesi aç" : "Sesi kapat");
      volumeButton.style.opacity = audio.muted ? ".62" : "1";
    });
  }

  if (progressLine) {
    progressLine.style.cursor = "pointer";
    progressLine.addEventListener("click", function(event){
      if (!audio.duration) return;
      const rect = progressLine.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
      audio.currentTime = ratio * audio.duration;
      syncPlayer();
    });
  }

  ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"].forEach(function(name){
    audio.addEventListener(name, syncPlayer);
  });

  narrationText.addEventListener("input", function(){
    render(project());
  });

  [language, voiceStyle, speed, duration, voiceEnabled].filter(Boolean).forEach(function(node){
    node.addEventListener("change", function(){
      render(project());
    });
  });

  if (voiceSelect) {
    let voiceSaveTimer = null;
    voiceSelect.addEventListener("change", function(){
      render(project());
      clearTimeout(voiceSaveTimer);
      voiceSaveTimer = setTimeout(persistVoice, 220);
    });
  }

  root.addEventListener("click", function(event){
    const button = event.target.closest(".mobile-adfilm-create-button");
    if (!button) return;
    const check = syncFilmGuard();
    if (check.ready) return;
    event.preventDefault();
    event.stopPropagation();
    toast("warning", check.reason, 4300);
    try { preview.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
  }, true);

  document.addEventListener("aivo:adfilm-project-sync", function(event){
    const nextProject = event && event.detail && event.detail.project;
    if (!nextProject) return;
    window.AIVOAdFilmActiveProject = nextProject;
    render(nextProject);
  });

  window.addEventListener("pagehide", function(){
    stopPolling();
    try { audio.pause(); } catch (_) {}
  });

  window.AIVOMobileAdFilmNarration = {
    create: createNarration,
    status: function(){ return poll(0, runToken); },
    approve: approveNarration,
    state: function(){ return narrationState(); },
    sync: function(){ render(project()); }
  };

  if (deleteButton) deleteButton.disabled = true;
  render(project());
})();