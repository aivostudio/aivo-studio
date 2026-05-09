(function(){
  const root = document.getElementById("mobileCartoonSection");
  if (!root || root.__mobileCartoonBound) return;
  root.__mobileCartoonBound = true;

  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-cartoon-mode]"));
  const views = Array.from(root.querySelectorAll("[data-mobile-cartoon-view]"));

  const characterPromptEl = root.querySelector("#mobileCartoonCharacterPrompt");
  const characterCountEl = root.querySelector("#mobileCartoonCharacterCount");
  const scenePromptEl = root.querySelector("#mobileCartoonScenePrompt");
  const sceneCountEl = root.querySelector("#mobileCartoonSceneCount");

  const characterBtn = root.querySelector("#mobileCartoonCharacterBtn");
  const generateBtn = root.querySelector("#mobileCartoonGenerateBtn");

  const characterStatusEl = root.querySelector("#mobileCartoonCharacterStatus");
  const statusEl = root.querySelector("#mobileCartoonStatus");

  const durationEl = root.querySelector("#mobileCartoonDuration");
  const ratioEl = root.querySelector("#mobileCartoonRatio");
  const characterImageEl = root.querySelector("#mobileCartoonCharacterImage");
const characterImageClearEl = root.querySelector("#mobileCartoonCharacterImageClear");
const characterImageTextEl = root.querySelector("#mobileCartoonCharacterImageText");

const audioFileEl = root.querySelector("#mobileCartoonAudioFile");
const audioClearEl = root.querySelector("#mobileCartoonAudioClear");
const audioTextEl = root.querySelector("#mobileCartoonAudioText");

const logoFileEl = root.querySelector("#mobileCartoonLogoFile");
const logoClearEl = root.querySelector("#mobileCartoonLogoClear");
const logoTextEl = root.querySelector("#mobileCartoonLogoText");

const customFileEl = root.querySelector("#mobileCartoonCustomFile");
const customClearEl = root.querySelector("#mobileCartoonCustomClear");
const customTextEl = root.querySelector("#mobileCartoonCustomText");

 const state = {
  mode: "character",
  characterPrompt: "",
  scenePrompt: "",
  mainCharacter: "red-fish",
  scene: "underwater",
  action: "swimming",
  duration: "4",
  ratio: "16:9",
  characterImageFile: null,
  audioFile: null,
  logoFile: null,
  customCharacterFile: null
};

  function safeText(value){
    return String(value || "").trim();
  }

  function setStatus(message){
    const text = safeText(message);

    if (state.mode === "character") {
      if (characterStatusEl) characterStatusEl.textContent = text;
      return;
    }

    if (statusEl) statusEl.textContent = text;
  }
 function setUploadState(input, clearBtn, textEl, stateKey){
  const file = input && input.files && input.files[0] ? input.files[0] : null;

  state[stateKey] = file;

  if (textEl) {
    textEl.textContent = file ? file.name : "Dosya seçilmedi";
  }

  if (clearBtn) {
    clearBtn.hidden = !file;
  }
}

function clearUpload(input, clearBtn, textEl, stateKey){
  if (input) input.value = "";

  state[stateKey] = null;

  if (textEl) {
    textEl.textContent = "Dosya seçilmedi";
  }

  if (clearBtn) {
    clearBtn.hidden = true;
  }
}
  function setMode(mode){
    const nextMode = mode === "basic" ? "basic" : "character";
    state.mode = nextMode;

    modeButtons.forEach(function(btn){
      const active = btn.getAttribute("data-mobile-cartoon-mode") === nextMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    views.forEach(function(view){
      const active = view.getAttribute("data-mobile-cartoon-view") === nextMode;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });

    setStatus("");
  }

  function bindModeTabs(){
    modeButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        setMode(btn.getAttribute("data-mobile-cartoon-mode"));
      });
    });
  }

  function bindCounters(){
    if (characterPromptEl && characterCountEl) {
      function updateCharacter(){
        const value = String(characterPromptEl.value || "");
        state.characterPrompt = value.trim();
        characterCountEl.textContent = String(value.length);
      }

      characterPromptEl.addEventListener("input", updateCharacter);
      characterPromptEl.addEventListener("change", updateCharacter);
      updateCharacter();
    }

    if (scenePromptEl && sceneCountEl) {
      function updateScene(){
        const value = String(scenePromptEl.value || "");
        state.scenePrompt = value.trim();
        sceneCountEl.textContent = String(value.length);
      }

      scenePromptEl.addEventListener("input", updateScene);
      scenePromptEl.addEventListener("change", updateScene);
      updateScene();
    }
  }

  function bindSingleChoice(selector, key, attr){
    const buttons = Array.from(root.querySelectorAll(selector));

    buttons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute(attr));
        if (!value) return;

        state[key] = value;

        buttons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function bindControls(){
    bindSingleChoice("[data-cartoon-main]", "mainCharacter", "data-cartoon-main");
    bindSingleChoice("[data-cartoon-scene]", "scene", "data-cartoon-scene");
    bindSingleChoice("[data-cartoon-action]", "action", "data-cartoon-action");

    if (durationEl) {
      durationEl.addEventListener("change", function(){
        state.duration = safeText(durationEl.value) || "4";
      });
      state.duration = safeText(durationEl.value) || "4";
    }

    if (ratioEl) {
      ratioEl.addEventListener("change", function(){
        state.ratio = safeText(ratioEl.value) || "16:9";
      });
      state.ratio = safeText(ratioEl.value) || "16:9";
    }
  }
 function bindUploads(){
  if (characterImageEl) {
    characterImageEl.addEventListener("change", function(){
      setUploadState(characterImageEl, characterImageClearEl, characterImageTextEl, "characterImageFile");
      if (state.characterImageFile) {
        setStatus("Karakter referans görseli seçildi.");
      }
    });
  }

  if (characterImageClearEl) {
    characterImageClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(characterImageEl, characterImageClearEl, characterImageTextEl, "characterImageFile");
      setStatus("Karakter referans görseli kaldırıldı.");
    });
  }

  if (audioFileEl) {
    audioFileEl.addEventListener("change", function(){
      setUploadState(audioFileEl, audioClearEl, audioTextEl, "audioFile");
      if (state.audioFile) {
        setStatus("Audio seçildi.");
      }
    });
  }

  if (audioClearEl) {
    audioClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(audioFileEl, audioClearEl, audioTextEl, "audioFile");
      setStatus("Audio kaldırıldı.");
    });
  }

  if (logoFileEl) {
    logoFileEl.addEventListener("change", function(){
      setUploadState(logoFileEl, logoClearEl, logoTextEl, "logoFile");
      if (state.logoFile) {
        setStatus("Logo seçildi.");
      }
    });
  }

  if (logoClearEl) {
    logoClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(logoFileEl, logoClearEl, logoTextEl, "logoFile");
      setStatus("Logo kaldırıldı.");
    });
  }

  if (customFileEl) {
    customFileEl.addEventListener("change", function(){
      setUploadState(customFileEl, customClearEl, customTextEl, "customCharacterFile");
      if (state.customCharacterFile) {
        setStatus("Kendi karakter görselin seçildi.");
      }
    });
  }

  if (customClearEl) {
    customClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(customFileEl, customClearEl, customTextEl, "customCharacterFile");
      setStatus("Kendi karakter görselin kaldırıldı.");
    });
  }
}
  function bindButtons(){
    if (characterBtn) {
      characterBtn.addEventListener("click", function(){
        if (!state.characterPrompt) {
          setStatus("Lütfen karakter tanımı yaz.");
          return;
        }

        setStatus("Karakter oluşturma bağlantısı hazırlanıyor...");
        console.log("[MOBILE CARTOON][CHARACTER]", {
          app: "cartoon",
          mode: "character",
          prompt: state.characterPrompt
        });
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener("click", function(){
        setStatus("Çizgifilm sahnesi bağlantısı hazırlanıyor...");
        console.log("[MOBILE CARTOON][BASIC]", {
          app: "cartoon",
          mode: "basic",
          prompt: state.scenePrompt,
          main_character: state.mainCharacter,
          scene: state.scene,
          action: state.action,
          duration: state.duration,
          ratio: state.ratio
        });
      });
    }
  }

 bindModeTabs();
bindCounters();
bindControls();
bindUploads();
bindButtons();

setMode("character");

  window.mobileCartoonState = state;
})();
