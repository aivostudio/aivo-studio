(function AIVO_MOBILE_RADIO_AD_PROJECT_SYNC(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_PROJECT_SYNC_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_PROJECT_SYNC_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  if (!root || !view) return;

  const PROJECT_KEY = "aivo_radioad_active_project_id_v1";
  const LOCAL_DRAFT_KEY = "aivo_mobile_radioad_local_draft_v1";
  const CREDIT_PRICES = {
    mp3: { 10:10, 15:12, 30:20, 45:28, 60:36 },
    wav: { 10:13, 15:15, 30:25, 45:35, 60:45 }
  };

  const fields = {
    text: view.querySelector("#mobileRadioNarrationText"),
    language: view.querySelector("#mobileRadioLanguage"),
    voiceStyle: view.querySelector("#mobileRadioVoiceStyle"),
    voice: view.querySelector("#mobileRadioVoice"),
    speed: view.querySelector("#mobileRadioSpeed"),
    flow: view.querySelector("#mobileRadioFlow"),
    duration: view.querySelector("#mobileRadioDuration"),
    format: view.querySelector("#mobileRadioOutputFormat"),
    musicMode: view.querySelector("#mobileRadioMusicMode"),
    musicStyle: view.querySelector("#mobileRadioMusicStyle"),
    musicEnergy: view.querySelector("#mobileRadioMusicEnergy")
  };

  const wordRange = view.querySelector("[data-mobile-radio-word-range]");
  const durationBadge = view.querySelector("[data-mobile-radio-duration-badge]");
  const wordCount = view.querySelector("[data-mobile-radio-word-count]");
  const estimate = view.querySelector("[data-mobile-radio-estimate]");
  const copyCount = view.querySelector("[data-mobile-radio-copy-count]");
  const budgetFill = view.querySelector(".mobile-adfilm-narration-meter i");
  const action = view.querySelector("[data-mobile-radio-action]");
  const actionSummary = action && action.querySelector(".mobile-adfilm-action-copy small");
  const actionButton = action && action.querySelector(".mobile-adfilm-create-button");
  const actionStatus = action && action.querySelector(".mobile-adfilm-action-status");

  let projectId = "";
  let project = null;
  let applying = false;
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let draftRevision = 0;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function readStorage(key){
    try{ return localStorage.getItem(key) || ""; }catch(_){ return ""; }
  }

  function writeStorage(key, value){
    try{
      if (value == null || value === "") localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    }catch(_){ }
  }

  function writeLocalDraft(value){
    try{
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(Object.assign({}, value || {}, {
        _clientSavedAt: new Date().toISOString()
      })));
    }catch(_){ }
  }

  function readLocalDraft(){
    try{
      const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
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

  function setStatus(mode, text){
    if (!actionStatus) return;
    actionStatus.dataset.state = mode || "idle";
    actionStatus.textContent = text || "";
  }

  function normalizeDuration(value){
    const duration = Number(value) || 30;
    return [10,15,30,45,60].includes(duration) ? duration : 30;
  }

  function normalizeFormat(value){
    return clean(value).toLowerCase() === "wav" ? "wav" : "mp3";
  }

  function creditCost(duration, format){
    const d = normalizeDuration(duration);
    const f = normalizeFormat(format);
    return Number(CREDIT_PRICES[f][d] || 0);
  }

  function words(text){
    const value = clean(text);
    return value ? value.split(/\s+/).filter(Boolean) : [];
  }

  function speechRate(speed){
    if (speed === "slow") return 1.55;
    if (speed === "balanced") return 1.90;
    return 2.20;
  }

  function collect(){
    return {
      title: "Radyo Reklamı",
      narration: {
        text: clean(fields.text && fields.text.value),
        language: clean(fields.language && fields.language.value) || "tr",
        voice: clean(fields.voice && fields.voice.value) || "warm_female",
        voiceStyle: clean(fields.voiceStyle && fields.voiceStyle.value) || "warm",
        speed: clean(fields.speed && fields.speed.value) || "fast",
        flow: clean(fields.flow && fields.flow.value) || "natural"
      },
      music: {
        mode: clean(fields.musicMode && fields.musicMode.value) || "ai",
        style: clean(fields.musicStyle && fields.musicStyle.value) || "auto",
        energy: clean(fields.musicEnergy && fields.musicEnergy.value) || "balanced"
      },
      output: {
        duration: normalizeDuration(fields.duration && fields.duration.value),
        format: normalizeFormat(fields.format && fields.format.value)
      }
    };
  }

  function setValue(node, value, fallback){
    if (!node) return;
    const next = value == null || value === "" ? fallback : String(value);
    const hasOption = node.tagName === "SELECT"
      ? Array.from(node.options).some(function(option){ return option.value === next; })
      : true;
    if (hasOption) node.value = next;
  }

  function syncDerived(){
    const payload = collect();
    const duration = payload.output.duration;
    const format = payload.output.format;
    const count = words(payload.narration.text).length;
    const rate = speechRate(payload.narration.speed);
    const maxWords = Math.max(5, Math.floor(duration * rate));
    const minWords = Math.max(5, Math.floor(maxWords * 0.72));
    const estimated = count ? Math.ceil(count / rate) : 0;
    const credits = creditCost(duration, format);

    if (wordRange) wordRange.textContent = minWords + "–" + maxWords + " kelime önerilir";
    if (durationBadge) durationBadge.textContent = duration + " sn";
    if (wordCount) wordCount.textContent = String(count);
    if (estimate) estimate.textContent = String(estimated);
    if (copyCount) copyCount.textContent = String(payload.narration.text.length);
    if (budgetFill) budgetFill.style.width = Math.min(100, maxWords ? count / maxWords * 100 : 0) + "%";

    if (actionSummary){
      const musicLabel = payload.music.mode === "off"
        ? "Müziksiz"
        : payload.music.mode === "upload"
          ? "Yüklenen müzik"
          : "AIVO müziği";
      actionSummary.textContent = duration + " sn · Seslendirme · " + musicLabel + " · " + format.toUpperCase() + (format === "mp3" ? " 320 kbps" : "");
    }

    if (actionButton){
      actionButton.textContent = "Radyo Reklamını Oluştur (" + credits + " Kredi)";
      actionButton.setAttribute("data-credit-cost", String(credits));
      actionButton.setAttribute("data-credit-duration", String(duration));
      actionButton.setAttribute("data-credit-format", format);
    }
  }

  function applyProject(nextProject){
    if (!nextProject) return;
    applying = true;
    try{
      project = nextProject;
      projectId = clean(nextProject.id || projectId);
      if (projectId) writeStorage(PROJECT_KEY, projectId);

      const narration = nextProject.narration || {};
      const music = nextProject.music || {};
      const output = nextProject.output || {};

      setValue(fields.text, narration.text, "");
      setValue(fields.language, narration.language, "tr");
      setValue(fields.voice, narration.voice, "warm_female");
      setValue(fields.voiceStyle, narration.voiceStyle, "warm");
      setValue(fields.speed, narration.speed, "fast");
      setValue(fields.flow, narration.flow, "natural");
      setValue(fields.musicMode, music.mode, "ai");
      setValue(fields.musicStyle, music.style, "auto");
      setValue(fields.musicEnergy, music.energy, "balanced");
      setValue(fields.duration, output.duration, "30");
      setValue(fields.format, output.format, "mp3");

      root.dataset.radioAdProjectId = projectId;
      window.AIVOMobileRadioAdProject = nextProject;
      syncDerived();
      writeLocalDraft(nextProject);

      try{
        document.dispatchEvent(new CustomEvent("aivo:mobile-radioad-project-sync", {
          detail: { project: nextProject, projectId: projectId }
        }));
      }catch(_){ }
    }finally{
      applying = false;
    }
  }

  function localIsNewer(localProject, cloudProject){
    const localTime = Date.parse(localProject && localProject._clientSavedAt || "");
    const cloudTime = Date.parse(cloudProject && cloudProject.updatedAt || "");
    return Number.isFinite(localTime) && (!Number.isFinite(cloudTime) || localTime > cloudTime + 250);
  }

  function localPayload(){
    const payload = collect();
    return Object.assign({}, project || {}, payload, {
      id: projectId || project && project.id || null,
      narration: Object.assign({}, project && project.narration || {}, payload.narration),
      music: Object.assign({}, project && project.music || {}, payload.music),
      output: Object.assign({}, project && project.output || {}, payload.output)
    });
  }

  function persistLocalImmediately(){
    if (applying) return;
    draftRevision += 1;
    const next = localPayload();
    project = next;
    writeLocalDraft(next);
    syncDerived();
  }

  async function save(){
    if (applying || !projectId) return;
    const payload = collect();
    const revision = draftRevision;
    const targetProjectId = projectId;
    setStatus("saving", "Taslak buluta kaydediliyor...");

    saveChain = saveChain.catch(function(){}).then(async function(){
      try{
        const data = await request("/api/radio-ad/project?id=" + encodeURIComponent(targetProjectId), {
          method: "PATCH",
          body: JSON.stringify({ project: payload })
        });

        if (revision !== draftRevision){
          setStatus("saving", "Yeni değişiklikler buluta kaydediliyor...");
          return;
        }

        applyProject(data.project);
        setStatus("saved", "Taslak kaydedildi · " + new Date().toLocaleTimeString("tr-TR", {
          hour:"2-digit", minute:"2-digit", second:"2-digit"
        }));
      }catch(error){
        if (revision !== draftRevision){
          setStatus("saving", "Yeni değişiklikler buluta kaydediliyor...");
          return;
        }
        console.error("[MOBILE RADIO AD] save", error);
        setStatus("error", error.status === 401 ? "Oturum gerekli." : "Taslak kaydedilemedi; yerel kopya korunuyor.");
      }
    });

    return saveChain;
  }

  function queueSave(){
    if (applying) return;
    persistLocalImmediately();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }

  async function createProject(seed){
    const data = await request("/api/radio-ad/project", {
      method: "POST",
      body: JSON.stringify({ project: seed || collect() })
    });
    applyProject(data.project);
    return data.project;
  }

  async function bootstrap(){
    setStatus("connecting", "Radyo taslağı buluta bağlanıyor...");

    const localDraft = readLocalDraft();
    if (localDraft) applyProject(localDraft);

    projectId = clean(readStorage(PROJECT_KEY));
    let cloudProject = null;

    if (projectId){
      try{
        cloudProject = (await request("/api/radio-ad/project?id=" + encodeURIComponent(projectId), { method:"GET" })).project;
      }catch(error){
        if (error.status === 404){
          writeStorage(PROJECT_KEY, "");
          projectId = "";
        }else if (error.status === 401){
          setStatus("error", "Devam etmek için AIVO hesabına giriş yapmalısın.");
          return;
        }else{
          setStatus("error", "Bulut bağlantısı kurulamadı; yerel taslak korunuyor.");
          return;
        }
      }
    }

    if (!cloudProject){
      try{
        cloudProject = await createProject(localDraft || collect());
        projectId = clean(cloudProject.id);
      }catch(error){
        console.error("[MOBILE RADIO AD] create project", error);
        setStatus("error", error.status === 401 ? "Devam etmek için AIVO hesabına giriş yapmalısın." : "Radyo taslağı oluşturulamadı.");
        return;
      }
    }

    if (localDraft && localIsNewer(localDraft, cloudProject)){
      try{
        const reconciled = await request("/api/radio-ad/project?id=" + encodeURIComponent(projectId), {
          method:"PATCH",
          body:JSON.stringify({ project: {
            title: localDraft.title || "Radyo Reklamı",
            narration: localDraft.narration || {},
            music: localDraft.music || {},
            output: localDraft.output || {}
          } })
        });
        cloudProject = reconciled.project;
      }catch(error){
        console.error("[MOBILE RADIO AD] local reconcile", error);
      }
    }

    applyProject(cloudProject);
    setStatus("saved", "Proje buluta bağlı.");
  }

  Object.keys(fields).forEach(function(key){
    const node = fields[key];
    if (!node) return;
    const eventName = node.tagName === "TEXTAREA" ? "input" : "change";
    node.addEventListener(eventName, queueSave);
  });

  if (fields.text){
    fields.text.addEventListener("input", syncDerived);
  }

  [fields.duration, fields.format, fields.speed, fields.musicMode].forEach(function(node){
    if (node) node.addEventListener("change", syncDerived);
  });

  window.AIVOMobileRadioAdProjectSync = {
    getProjectId: function(){ return projectId; },
    getProject: function(){ return project; },
    collect: collect,
    save: save,
    syncDerived: syncDerived,
    applyProject: applyProject
  };

  syncDerived();
  bootstrap();
})();