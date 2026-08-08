(function AIVO_MOBILE_RADIO_AD_NARRATION(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_NARRATION_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_NARRATION_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  const preview = view && view.querySelector("[data-mobile-radio-preview]");
  if (!root || !view || !preview) return;

  const fields = {
    text: view.querySelector("#mobileRadioNarrationText"),
    language: view.querySelector("#mobileRadioLanguage"),
    voiceStyle: view.querySelector("#mobileRadioVoiceStyle"),
    voice: view.querySelector("#mobileRadioVoice"),
    speed: view.querySelector("#mobileRadioSpeed"),
    flow: view.querySelector("#mobileRadioFlow"),
    duration: view.querySelector("#mobileRadioDuration")
  };

  const statusNode = preview.querySelector(".mobile-adfilm-voice-preview-status");
  const playButton = preview.querySelector(".mobile-adfilm-voice-play");
  const volumeButton = preview.querySelector(".mobile-adfilm-voice-volume");
  const deleteButton = preview.querySelector(".mobile-adfilm-voice-delete");
  const createButton = preview.querySelector(".mobile-adfilm-voice-create");
  const approveButton = preview.querySelector(".mobile-adfilm-voice-approve");
  const progressLine = preview.querySelector(".mobile-adfilm-voice-preview-line");
  const timeNode = preview.querySelector(".mobile-adfilm-voice-time");

  const RATE = {
    slow: { target: 1.45, max: 1.62 },
    balanced: { target: 1.82, max: 2.02 },
    fast: { target: 2.18, max: 2.42 }
  };

  let currentProject = null;
  let currentAudioUrl = "";
  let operation = "";
  let pollToken = 0;

  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.setAttribute("data-mobile-radio-narration-audio", "");
  audio.hidden = true;
  preview.appendChild(audio);

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function delay(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function notify(message, type){
    try{
      const fn = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof fn === "function") fn(message, type || "info");
    }catch(_){ }
  }

  function projectSync(){
    return window.AIVOMobileRadioAdProjectSync || null;
  }

  function projectId(){
    const sync = projectSync();
    return clean(
      sync && typeof sync.getProjectId === "function" ? sync.getProjectId() : root.dataset.radioAdProjectId
    );
  }

  function latestProject(){
    const sync = projectSync();
    return sync && typeof sync.getProject === "function"
      ? sync.getProject()
      : window.AIVOMobileRadioAdProject || currentProject;
  }

  function applyProject(project){
    if (!project) return;
    const sync = projectSync();
    if (sync && typeof sync.applyProject === "function"){
      sync.applyProject(project);
      return;
    }
    currentProject = project;
    window.AIVOMobileRadioAdProject = project;
    if (project.id) root.dataset.radioAdProjectId = project.id;
    try{
      document.dispatchEvent(new CustomEvent("aivo:mobile-radioad-project-sync", {
        detail: { project: project, projectId: project.id || "" }
      }));
    }catch(_){ }
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

  function words(text){
    const value = clean(text);
    if (!value) return [];
    try{
      return value.match(/[\p{L}\p{N}]+(?:[’'\-.][\p{L}\p{N}]+)*/gu) || [];
    }catch(_){
      return value.split(/\s+/).filter(Boolean);
    }
  }

  function narrationSettings(){
    return {
      text: clean(fields.text && fields.text.value),
      language: clean(fields.language && fields.language.value) || "tr",
      voice: clean(fields.voice && fields.voice.value) || "warm_female",
      voiceStyle: clean(fields.voiceStyle && fields.voiceStyle.value) || "warm",
      speed: clean(fields.speed && fields.speed.value) || "fast",
      flow: clean(fields.flow && fields.flow.value) || "natural",
      duration: Number(fields.duration && fields.duration.value) || 30
    };
  }

  function validate(settings){
    if (!settings.text || settings.text.length < 3){
      return { ok:false, message:"Reklam seslendirme metnini yaz." };
    }
    const rate = RATE[settings.speed] || RATE.balanced;
    const count = words(settings.text).length;
    const commas = (settings.text.match(/[,;:]/g) || []).length;
    const stops = (settings.text.match(/[.!?…]/g) || []).length;
    const estimatedSeconds = count / rate.target + commas * 0.12 + stops * 0.28;
    const usableSeconds = Math.max(1, settings.duration - 0.35);
    const maxWords = Math.max(5, Math.floor(usableSeconds * rate.max));
    if (count > maxWords || estimatedSeconds > usableSeconds){
      return {
        ok:false,
        message:"Metin " + settings.duration + " saniyeye sığmıyor. En fazla " + maxWords + " kelime kullan."
      };
    }
    return { ok:true };
  }

  function generationMatchesDraft(project){
    const input = project && project.narrationGeneration && project.narrationGeneration.input;
    if (!input) return false;
    const current = narrationSettings();
    return clean(input.text) === current.text
      && clean(input.language || "tr") === current.language
      && clean(input.voice || "warm_female") === current.voice
      && clean(input.voiceStyle || "warm") === current.voiceStyle
      && clean(input.speed || "fast") === current.speed
      && clean(input.flow || "natural") === current.flow
      && Number(input.duration || 0) === Number(current.duration || 0);
  }

  function formatTime(value){
    const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function syncPlayer(){
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const percent = duration ? Math.max(0, Math.min(100, current / duration * 100)) : 0;
    if (timeNode) timeNode.textContent = formatTime(current) + " / " + formatTime(duration);
    if (progressLine){
      progressLine.style.background = "linear-gradient(90deg,#8b5cf6 0%,#ec4899 " + percent + "%,rgba(255,255,255,.08) " + percent + "%,rgba(255,255,255,.08) 100%)";
    }
    if (playButton){
      const playing = !audio.paused && !audio.ended && !!currentAudioUrl;
      playButton.classList.toggle("is-playing", playing);
      playButton.setAttribute("aria-label", playing ? "Sesi duraklat" : "Sesi oynat");
    }
  }

  function stopAudio(){
    audio.pause();
    try{ audio.currentTime = 0; }catch(_){ }
    syncPlayer();
  }

  function setAudioSource(audioData){
    const nextUrl = clean(audioData && (audioData.previewUrl || audioData.url));
    if (!nextUrl){
      if (currentAudioUrl){
        stopAudio();
        audio.removeAttribute("src");
        audio.load();
      }
      currentAudioUrl = "";
      if (timeNode) timeNode.textContent = "0:00 / 0:00";
      if (progressLine) progressLine.style.background = "rgba(255,255,255,.08)";
      return;
    }
    if (nextUrl === currentAudioUrl) return;
    stopAudio();
    currentAudioUrl = nextUrl;
    audio.src = nextUrl;
    audio.load();
  }

  function lockNarrationFields(locked){
    Object.keys(fields).forEach(function(key){
      const node = fields[key];
      if (node) node.disabled = !!locked;
    });
  }

  function setStatus(text, state){
    preview.dataset.state = state || "idle";
    if (statusNode) statusNode.textContent = text;
  }

  function setOperation(next, label){
    operation = next || "";
    const busy = !!operation;
    lockNarrationFields(busy);
    if (createButton) createButton.disabled = busy;
    if (approveButton) approveButton.disabled = true;
    if (deleteButton) deleteButton.disabled = busy || !currentAudioUrl;
    if (playButton) playButton.disabled = busy || !currentAudioUrl;
    if (volumeButton) volumeButton.disabled = busy || !currentAudioUrl;
    if (busy && label) setStatus(label, "loading");
  }

  function setControlOpacity(hasAudio){
    if (playButton) playButton.style.opacity = hasAudio ? "1" : "";
    if (volumeButton) volumeButton.style.opacity = hasAudio ? "1" : "";
    if (deleteButton) deleteButton.style.opacity = hasAudio ? "1" : "";
  }

  function setIdle(message){
    operation = "";
    lockNarrationFields(false);
    setAudioSource(null);
    setControlOpacity(false);
    if (playButton) playButton.disabled = true;
    if (volumeButton) volumeButton.disabled = true;
    if (deleteButton) deleteButton.disabled = true;
    if (approveButton){
      approveButton.disabled = true;
      approveButton.classList.remove("is-approved");
      approveButton.textContent = "Sesi onayla";
    }
    const check = validate(narrationSettings());
    if (createButton){
      createButton.disabled = !check.ok;
      createButton.textContent = "Sesi oluştur";
    }
    setStatus(message || "Henüz ses oluşturulmadı.", "idle");
  }

  function setReady(audioData){
    operation = "";
    lockNarrationFields(false);
    setAudioSource(audioData);
    const approved = !!(audioData && audioData.approved);
    setControlOpacity(true);
    if (playButton) playButton.disabled = false;
    if (volumeButton) volumeButton.disabled = false;
    if (deleteButton) deleteButton.disabled = false;
    if (createButton){
      createButton.disabled = !validate(narrationSettings()).ok;
      createButton.textContent = "Sesi yeniden üret";
    }
    if (approveButton){
      approveButton.disabled = approved;
      approveButton.classList.toggle("is-approved", approved);
      approveButton.textContent = approved ? "Onaylandı" : "Sesi onayla";
    }
    setStatus(approved ? "Ses onaylandı." : "Ses hazır · onay bekliyor.", approved ? "approved" : "ready");
  }

  function setStale(){
    operation = "";
    lockNarrationFields(false);
    setAudioSource(null);
    setControlOpacity(false);
    if (playButton) playButton.disabled = true;
    if (volumeButton) volumeButton.disabled = true;
    if (deleteButton) deleteButton.disabled = true;
    if (approveButton){
      approveButton.disabled = true;
      approveButton.classList.remove("is-approved");
      approveButton.textContent = "Sesi onayla";
    }
    const check = validate(narrationSettings());
    if (createButton){
      createButton.disabled = !check.ok;
      createButton.textContent = "Sesi yeniden üret";
    }
    setStatus("Ses ayarları değişti · yeniden oluştur.", "stale");
  }

  function errorMessage(error){
    const data = error && error.data || {};
    const code = clean(data.error || error && error.message);
    if (code === "missing_narration_text") return "Reklam seslendirme metnini yaz.";
    if (code === "narration_too_long"){
      return "Metin seçilen süreye sığmıyor" + (data.max_words ? ". En fazla " + data.max_words + " kelime kullan." : ".");
    }
    if (code === "narration_generation_in_progress") return "Ses üretimi zaten devam ediyor.";
    if (code === "narration_text_changed") return "Metin değişti. Sesi yeniden oluştur.";
    if (code === "narration_audio_missing") return "Ses kaydı bulunamadı. Sesi yeniden oluştur.";
    if (code === "narration_mastering_required") return "Ses düzenleme işlemi tamamlanmadı.";
    if (code === "missing_fal_key") return "Ses motoru sunucuda hazır değil.";
    if (code === "narration_r2_copy_failed") return "Ses dosyası kaydedilemedi. Tekrar deneyebilirsin.";
    if (code === "narration_master_failed") return "Ses düzenleme işlemi tamamlanamadı.";
    if (code === "unauthorized") return "Devam etmek için AIVO hesabına giriş yapmalısın.";
    return "Ses oluşturulamadı: " + (code || "Bilinmeyen hata");
  }

  async function fetchProject(id){
    const data = await request("/api/radio-ad/project?id=" + encodeURIComponent(id), { method:"GET" });
    if (data.project) applyProject(data.project);
    return data.project || null;
  }

  async function masterNarration(id){
    if (!id) return;
    setOperation("mastering", "Ses düzenleniyor...");
    try{
      const data = await request("/api/radio-ad/narration/master", {
        method:"POST",
        body:JSON.stringify({ projectId:id })
      });
      if (data.project) applyProject(data.project);
      else if (data.audio) setReady(data.audio);
      notify("Ses ön izlemesi hazır.", "success");
    }catch(error){
      console.error("[MOBILE RADIO AD] narration master", error);
      operation = "";
      setIdle("Ses düzenlenemedi.");
      notify(errorMessage(error), "error");
    }
  }

  async function pollNarration(id){
    if (!id || operation === "polling") return;
    const token = ++pollToken;
    setOperation("polling", "Ses hazırlanıyor...");
    try{
      for (let attempt = 0; attempt < 450; attempt += 1){
        if (token !== pollToken) return;
        const data = await request("/api/radio-ad/narration/status?projectId=" + encodeURIComponent(id), { method:"GET" });
        const status = clean(data.status).toUpperCase();
        if (status === "COMPLETED"){
          operation = "";
          await masterNarration(id);
          return;
        }
        if (status === "FAILED"){
          const error = new Error(data.error || "narration_generation_failed");
          error.data = data;
          throw error;
        }
        setStatus(data.fallback_used ? "Ses alternatif motorla hazırlanıyor..." : "Ses hazırlanıyor...", "loading");
        await delay(2000);
      }
      throw new Error("narration_generation_timeout");
    }catch(error){
      if (token !== pollToken) return;
      console.error("[MOBILE RADIO AD] narration poll", error);
      operation = "";
      lockNarrationFields(false);
      const check = validate(narrationSettings());
      if (createButton){
        createButton.disabled = !check.ok;
        createButton.textContent = "Sesi yeniden dene";
      }
      setStatus("Ses oluşturulamadı.", "error");
      notify(errorMessage(error), "error");
    }
  }

  async function createNarration(){
    if (operation) return;
    const settings = narrationSettings();
    const check = validate(settings);
    if (!check.ok){
      notify(check.message, "error");
      return;
    }

    setOperation("creating", "Ses üretimi başlatılıyor...");
    stopAudio();

    try{
      const sync = projectSync();
      if (sync && typeof sync.save === "function") await sync.save();
      const id = projectId();
      if (!id) throw new Error("missing_project_id");

      const fresh = narrationSettings();
      const validFresh = validate(fresh);
      if (!validFresh.ok) throw new Error(validFresh.message);

      await request("/api/radio-ad/narration/create", {
        method:"POST",
        body:JSON.stringify({
          projectId:id,
          text:fresh.text,
          language:fresh.language,
          voice:fresh.voice,
          voiceStyle:fresh.voiceStyle,
          speed:fresh.speed,
          flow:fresh.flow,
          duration:fresh.duration
        })
      });

      operation = "";
      await pollNarration(id);
    }catch(error){
      if (error && error.data && error.data.error === "narration_generation_in_progress"){
        operation = "";
        await pollNarration(projectId());
        return;
      }
      console.error("[MOBILE RADIO AD] narration create", error);
      operation = "";
      lockNarrationFields(false);
      const valid = validate(narrationSettings());
      if (createButton){
        createButton.disabled = !valid.ok;
        createButton.textContent = "Sesi oluştur";
      }
      setStatus("Ses üretimi başlatılamadı.", "error");
      notify(errorMessage(error), "error");
    }
  }

  async function approveNarration(){
    if (operation || !currentProject) return;
    const id = projectId();
    if (!id) return;

    setOperation("approving", "Ses onaylanıyor...");
    try{
      const sync = projectSync();
      if (sync && typeof sync.save === "function") await sync.save();
      const latest = latestProject();
      if (!latest || !latest.narration || !latest.narration.audio || latest.narration.audio.mastered !== true){
        throw new Error("narration_audio_missing");
      }
      const data = await request("/api/radio-ad/narration/approve", {
        method:"POST",
        body:JSON.stringify({ projectId:id })
      });
      if (data.project) applyProject(data.project);
      notify("Ses onaylandı.", "success");
    }catch(error){
      console.error("[MOBILE RADIO AD] narration approve", error);
      operation = "";
      renderProject(latestProject());
      notify(errorMessage(error), "error");
    }
  }

  async function deleteNarration(){
    if (operation || !projectId()) return;
    const id = projectId();
    setOperation("deleting", "Ses kaydı kaldırılıyor...");
    stopAudio();
    try{
      const data = await request("/api/radio-ad/narration/delete", {
        method:"POST",
        body:JSON.stringify({ projectId:id })
      });
      ++pollToken;
      if (data.project) applyProject(data.project);
      notify("Ses kaydı kaldırıldı.", "success");
    }catch(error){
      console.error("[MOBILE RADIO AD] narration delete", error);
      operation = "";
      renderProject(latestProject());
      notify(errorMessage(error), "error");
    }
  }

  function renderProject(project){
    if (!project) return;
    currentProject = project;

    const generation = project.narrationGeneration || null;
    const audioData = project.narration && project.narration.audio || null;
    const generationStatus = clean(generation && generation.status).toLowerCase();
    const active = generation && (generationStatus === "queued" || generationStatus === "processing");

    if (active){
      setOperation("polling", "Ses hazırlanıyor...");
      const id = clean(project.id || projectId());
      const token = ++pollToken;
      operation = "";
      pollToken = token - 1;
      pollNarration(id);
      return;
    }

    if (audioData && generation && generationStatus === "completed" && audioData.mastered !== true){
      if (operation !== "mastering") masterNarration(clean(project.id || projectId()));
      return;
    }

    if (audioData && audioData.mastered === true){
      if (!generationMatchesDraft(project)){
        setStale();
        return;
      }
      setReady(audioData);
      return;
    }

    if (!operation) setIdle();
  }

  function syncDraftState(){
    if (operation) return;
    const project = latestProject();
    if (!project){
      setIdle();
      return;
    }
    currentProject = project;
    const audioData = project.narration && project.narration.audio;
    if (audioData && audioData.mastered === true && !generationMatchesDraft(project)){
      setStale();
      return;
    }
    if (!audioData){
      const valid = validate(narrationSettings());
      if (createButton) createButton.disabled = !valid.ok;
    }
  }

  if (createButton) createButton.addEventListener("click", createNarration);
  if (approveButton) approveButton.addEventListener("click", approveNarration);
  if (deleteButton) deleteButton.addEventListener("click", deleteNarration);

  if (playButton){
    playButton.addEventListener("click", function(){
      if (!currentAudioUrl) return;
      if (audio.paused || audio.ended) audio.play().catch(function(){ notify("Ses oynatılamadı.", "error"); });
      else audio.pause();
    });
  }

  if (volumeButton){
    volumeButton.addEventListener("click", function(){
      if (!currentAudioUrl) return;
      audio.muted = !audio.muted;
      volumeButton.classList.toggle("is-muted", audio.muted);
      volumeButton.setAttribute("aria-label", audio.muted ? "Sesi aç" : "Sesi kapat");
      volumeButton.style.opacity = "1";
    });
  }

  audio.addEventListener("loadedmetadata", syncPlayer);
  audio.addEventListener("durationchange", syncPlayer);
  audio.addEventListener("timeupdate", syncPlayer);
  audio.addEventListener("play", syncPlayer);
  audio.addEventListener("pause", syncPlayer);
  audio.addEventListener("ended", syncPlayer);

  Object.keys(fields).forEach(function(key){
    const node = fields[key];
    if (!node) return;
    node.addEventListener(node.tagName === "TEXTAREA" ? "input" : "change", syncDraftState);
  });

  document.addEventListener("aivo:mobile-radioad-project-sync", function(event){
    const project = event && event.detail && event.detail.project;
    if (project) renderProject(project);
  });

  window.AIVOMobileRadioAdNarration = {
    create: createNarration,
    approve: approveNarration,
    remove: deleteNarration,
    render: renderProject,
    getAudioElement: function(){ return audio; }
  };

  const initial = latestProject();
  if (initial) renderProject(initial);
  else setIdle();
})();