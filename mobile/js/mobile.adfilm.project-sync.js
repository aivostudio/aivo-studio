(function AIVO_MOBILE_ADFILM_PROJECT_SYNC(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_PROJECT_SYNC_V1__) return;
  window.__AIVO_MOBILE_ADFILM_PROJECT_SYNC_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const PROJECT_KEY = "aivo_adfilm_active_project_id_v2";
  const LEGACY_PROJECT_KEY = "aivo_adfilm_active_project_id_v1";
  const SAVE_DELAY = 650;

  const statusNode = root.querySelector(".mobile-adfilm-action-status");
  const productName = root.querySelector("#mobileAdFilmProductName");
  const brandName = root.querySelector("#mobileAdFilmBrandName");
  const description = root.querySelector("#mobileAdFilmDescription");
  const voiceEnabled = root.querySelector("#mobileAdFilmVoiceEnabled");
  const voiceLanguage = root.querySelector("#mobileAdFilmVoiceLanguage");
  const voiceStyle = root.querySelector("#mobileAdFilmVoiceStyle");
  const voiceSpeed = root.querySelector("#mobileAdFilmVoiceSpeed");
  const narrationText = root.querySelector("#mobileAdFilmNarrationText");
  const duration = root.querySelector("#mobileAdFilmDuration");
  const musicStyle = root.querySelector("#mobileAdFilmMusicStyle");
  const musicEnergy = root.querySelector("#mobileAdFilmMusicEnergy");
  const qualityRadios = Array.from(root.querySelectorAll('input[name="mobileAdFilmQuality"]'));

  let project = null;
  let projectId = "";
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let applying = false;
  let dirty = false;

  function clean(value){ return String(value == null ? "" : value).trim(); }

  function toast(type, message, duration){
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration == null ? 3000 : duration });
      }
      if (typeof window.showToast === "function") return window.showToast(message, type);
    } catch (_) {}
    return null;
  }

  function setStatus(mode, message){
    root.dataset.adfilmCloudStatus = mode;
    if (!statusNode) return;
    statusNode.dataset.state = mode;
    statusNode.textContent = message;
  }

  async function request(path, options){
    let response;
    try {
      response = await fetch(path, Object.assign({
        credentials: "include",
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

  const api = {
    createProject: function(payload){
      return request("/api/ad-film/project", { method: "POST", body: JSON.stringify({ project: payload }) });
    },
    getProject: function(id){
      return request("/api/ad-film/project?id=" + encodeURIComponent(id), { method: "GET" });
    },
    updateProject: function(id, payload){
      return request("/api/ad-film/project?id=" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ project: payload }) });
    },
    deleteProject: function(id){
      return request("/api/ad-film/project?id=" + encodeURIComponent(id), { method: "DELETE" });
    },
    async uploadFile(id, file, kind){
      const signed = await request("/api/ad-film/upload-url", {
        method: "POST",
        body: JSON.stringify({
          projectId: id,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          kind: kind
        })
      });
      const upload = await fetch(signed.upload_url, {
        method: "PUT",
        headers: signed.required_headers || { "Content-Type": file.type },
        body: file
      });
      if (!upload.ok) throw new Error("r2_upload_failed_" + upload.status);
      return {
        key: signed.key,
        url: signed.read_url || signed.public_url,
        publicUrl: signed.public_url || null,
        readUrl: signed.read_url || null,
        name: file.name,
        contentType: file.type,
        size: file.size,
        kind: kind,
        uploadedAt: new Date().toISOString()
      };
    }
  };

  window.AIVOMobileAdFilmProjects = api;
  if (!window.AIVOAdFilmProjects) window.AIVOAdFilmProjects = api;

  function storedProjectId(){
    try { return clean(localStorage.getItem(PROJECT_KEY) || localStorage.getItem(LEGACY_PROJECT_KEY)); }
    catch (_) { return ""; }
  }

  function storeProjectId(id){
    try {
      if (id) {
        localStorage.setItem(PROJECT_KEY, id);
        localStorage.removeItem(LEGACY_PROJECT_KEY);
      } else {
        localStorage.removeItem(PROJECT_KEY);
        localStorage.removeItem(LEGACY_PROJECT_KEY);
      }
    } catch (_) {}
  }

  function currentFormat(){
    const active = root.querySelector("[data-mobile-adfilm-format].is-active");
    return clean(active && active.getAttribute("data-mobile-adfilm-format")) || "16:9";
  }

  function currentQuality(){
    const checked = qualityRadios.find(function(radio){ return radio.checked; });
    return clean(checked && checked.value) || "1080p";
  }

  function currentMusicMode(){
    const mode = clean(root.dataset.adfilmMusicMode || "auto");
    return mode === "upload" || mode === "off" ? mode : "auto";
  }

  function serverMusicStyle(value){
    const style = clean(value).toLowerCase();
    return ["auto", "pop", "cinematic", "electronic", "classical", "rnb", "latin"].includes(style) ? style : "auto";
  }

  function serverMusicEnergy(value){
    const energy = clean(value).toLowerCase();
    if (energy === "soft" || energy === "calm") return "calm";
    if (energy === "strong" || energy === "high") return "strong";
    return "balanced";
  }

  function serverDuration(value){
    const seconds = String(Math.round(Number(value) || 5));
    return ["5", "10", "15", "20"].includes(seconds) ? seconds : "10";
  }

  function serverAspect(value){
    return ["9:16", "1:1", "16:9", "4:5"].includes(value) ? value : "16:9";
  }

  function collect(){
    const musicMode = currentMusicMode();
    return {
      mode: "basic",
      brief: {
        productName: productName ? productName.value : "",
        brandName: brandName ? brandName.value : "",
        description: description ? description.value : "",
        targetAudience: "",
        cta: ""
      },
      narration: {
        enabled: !voiceEnabled || !!voiceEnabled.checked,
        scriptMode: "manual",
        language: voiceLanguage ? voiceLanguage.value : "tr",
        voiceStyle: voiceStyle ? voiceStyle.value : "warm",
        speed: voiceSpeed ? voiceSpeed.value : "balanced",
        flow: "natural",
        text: narrationText ? narrationText.value : ""
      },
      sceneStyle: "premium",
      music: {
        mode: musicMode,
        style: serverMusicStyle(musicStyle && musicStyle.value),
        energy: serverMusicEnergy(musicEnergy && musicEnergy.value),
        track: project && project.media ? project.media.musicTrack || null : null
      },
      output: {
        duration: serverDuration(duration && duration.value),
        aspectRatio: serverAspect(currentFormat()),
        quality: "1080p",
        subtitles: false,
        music: musicMode !== "off",
        soundEffects: false
      },
      media: project && project.media ? project.media : {
        productImages: [],
        logo: null,
        extraMedia: null,
        musicTrack: null
      }
    };
  }

  function expose(nextProject){
    project = nextProject || project;
    projectId = clean(project && project.id) || projectId;
    root.dataset.adfilmProjectId = projectId;
    window.AIVOAdFilmActiveProject = project || null;
    window.AIVOAdFilmServerMedia = project && project.media ? project.media : {};
    try {
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync", {
        detail: {
          project: project || null,
          projectId: projectId,
          media: window.AIVOAdFilmServerMedia,
          mobile: true
        }
      }));
    } catch (_) {}
  }

  function formMostlyEmpty(){
    return !clean(productName && productName.value) && !clean(description && description.value) && !clean(narrationText && narrationText.value);
  }

  function setValue(node, value, eventName){
    if (!node || value == null) return;
    node.value = String(value);
    node.dispatchEvent(new Event(eventName || (node.tagName === "SELECT" ? "change" : "input"), { bubbles: true }));
  }

  function applyProject(nextProject){
    if (!nextProject) return;
    expose(nextProject);
    if (!formMostlyEmpty()) return;

    applying = true;
    const brief = nextProject.brief || {};
    const narration = nextProject.narration || {};
    const music = nextProject.music || {};

    if (productName) productName.value = brief.productName || "";
    if (brandName) brandName.value = brief.brandName || "";
    if (description) {
      description.value = brief.description || "";
      description.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (voiceEnabled && typeof narration.enabled === "boolean") {
      voiceEnabled.checked = narration.enabled;
      voiceEnabled.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setValue(voiceLanguage, narration.language || "tr", "change");
    setValue(voiceStyle, narration.voiceStyle || "warm", "change");
    setValue(voiceSpeed, narration.speed || "balanced", "change");
    if (narrationText) {
      narrationText.value = narration.text || "";
      narrationText.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (music.mode) {
      const button = root.querySelector('[data-mobile-adfilm-music-mode="' + music.mode + '"]');
      if (button) button.click();
    }
    if (musicStyle && music.style && Array.from(musicStyle.options).some(function(option){ return option.value === music.style; })) {
      setValue(musicStyle, music.style, "change");
    }
    const mobileEnergy = music.energy === "calm" ? "soft" : music.energy === "strong" ? "strong" : "balanced";
    if (musicEnergy && Array.from(musicEnergy.options).some(function(option){ return option.value === mobileEnergy; })) {
      setValue(musicEnergy, mobileEnergy, "change");
    }

    setTimeout(function(){
      applying = false;
      expose(project);
    }, 0);
  }

  function queueSave(delay){
    if (applying || !projectId) return;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, delay == null ? SAVE_DELAY : delay);
  }

  function save(){
    if (applying || !projectId) return Promise.resolve(null);
    const payload = collect();
    saveChain = saveChain.catch(function(){}).then(async function(){
      setStatus("saving", "Buluta kaydediliyor...");
      const result = await api.updateProject(projectId, payload);
      dirty = false;
      expose(result.project);
      setStatus("saved", "Proje buluta kaydedildi.");
      return result.project;
    }).catch(function(error){
      console.error("[MOBILE ADFILM] project save", error);
      setStatus(error.status === 401 || error.status === 0 ? "offline" : "error", error.status === 401 ? "Oturum gerekli." : "Bulut kaydı yapılamadı.");
      if (error.status === 401) toast("warning", "Devam etmek için AIVO hesabına giriş yapmalısın.", 4200);
      else toast("error", "Değişiklikler buluta kaydedilemedi. Yerel ekran korunuyor.", 4200);
      return null;
    });
    return saveChain;
  }

  async function bootstrap(){
    setStatus("connecting", "Proje bağlantısı kuruluyor...");
    let id = storedProjectId();
    let nextProject = null;

    if (id) {
      try {
        const result = await api.getProject(id);
        nextProject = result.project;
      } catch (error) {
        if (error.status === 401) {
          setStatus("offline", "Oturum gerekli.");
          toast("warning", "Devam etmek için AIVO hesabına giriş yapmalısın.", 4200);
          return;
        }
        if (error.status === 404) {
          storeProjectId("");
          id = "";
        } else {
          setStatus(error.status === 0 ? "offline" : "error", "Kayıtlı proje açılamadı.");
          toast(error.status === 0 ? "warning" : "error", "Kayıtlı reklam taslağı açılamadı.", 4000);
        }
      }
    }

    if (!nextProject) {
      try {
        const created = await api.createProject(collect());
        nextProject = created.project;
        id = clean(nextProject && nextProject.id);
        storeProjectId(id);
        toast("success", "Reklam projesi bulutta oluşturuldu.", 2400);
      } catch (error) {
        setStatus(error.status === 401 || error.status === 0 ? "offline" : "error", error.status === 401 ? "Oturum gerekli." : "Proje oluşturulamadı.");
        toast(error.status === 401 ? "warning" : "error", error.status === 401 ? "Devam etmek için AIVO hesabına giriş yapmalısın." : "Reklam projesi oluşturulamadı.", 4200);
        return;
      }
    }

    project = nextProject;
    projectId = clean(nextProject.id);
    storeProjectId(projectId);
    applyProject(nextProject);
    setStatus("saved", "Proje buluta bağlı.");
  }

  function bindAutoSave(){
    [productName, brandName, description, narrationText].filter(Boolean).forEach(function(node){
      node.addEventListener("input", function(){ queueSave(); });
    });

    [voiceEnabled, voiceLanguage, voiceStyle, voiceSpeed, duration, musicStyle, musicEnergy].filter(Boolean).forEach(function(node){
      node.addEventListener("change", function(){ queueSave(180); });
    });

    qualityRadios.forEach(function(node){
      node.addEventListener("change", function(){ queueSave(180); });
    });

    root.addEventListener("click", function(event){
      if (event.target.closest("[data-mobile-adfilm-format],[data-mobile-adfilm-music-mode]")) queueSave(180);
    });

    window.addEventListener("pagehide", function(){
      if (dirty) save();
    });
  }

  window.AIVOMobileAdFilmProjectSync = {
    api: api,
    project: function(){ return project; },
    projectId: function(){ return projectId; },
    collect: collect,
    save: save,
    sync: bootstrap
  };

  bindAutoSave();
  bootstrap();
})();

(function loadMobileAdFilmNarration(){
  if (window.__AIVO_MOBILE_ADFILM_NARRATION_LOADER__) return;
  window.__AIVO_MOBILE_ADFILM_NARRATION_LOADER__ = true;
  if (document.querySelector('script[data-mobile-adfilm-narration]')) return;
  const script = document.createElement("script");
  script.src = "/mobile/js/mobile.adfilm.narration.js?v=1";
  script.defer = true;
  script.setAttribute("data-mobile-adfilm-narration", "");
  document.body.appendChild(script);
})();