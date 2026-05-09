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
  customCharacterFile: null,
  characterImageUrl: "",
  audioUrl: "",
  logoUrl: "",
  customCharacterUrl: ""
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
async function uploadCartoonFile(file, kind){
  if (!file) return "";

  const presignRes = await fetch("/api/r2/scan-and-presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      app: "cartoon",
      kind: kind || "mobile-upload",
      filename: file.name,
      contentType: file.type,
      prefix: "uploads/cartoon/tmp/"
    })
  });

  const data = await presignRes.json().catch(function(){
    return {};
  });

  if (!presignRes.ok || !data.ok || !data.upload_url || !data.public_url) {
    throw new Error(data.error || "presign_failed");
  }

  const uploadRes = await fetch(data.upload_url, {
    method: "PUT",
    headers: data.required_headers || {
      "Content-Type": file.type
    },
    body: file
  });

  if (!uploadRes.ok) {
    throw new Error("r2_upload_failed");
  }

  return data.public_url;
}

async function setUploadState(input, clearBtn, textEl, stateKey, urlKey){
  const file = input && input.files && input.files[0] ? input.files[0] : null;

  state[stateKey] = file;
  state[urlKey] = "";

  if (textEl) {
    textEl.textContent = file ? "Yükleniyor..." : "Dosya seçilmedi";
  }

  if (clearBtn) {
    clearBtn.hidden = !file;
  }

  syncCartoonCredits();

  if (!file) return;

  try {
    const url = await uploadCartoonFile(file);
    state[urlKey] = url;

    if (textEl) {
      textEl.textContent = file.name + " yüklendi";
    }
  } catch (err) {
    state[stateKey] = null;
    state[urlKey] = "";

    if (input) input.value = "";

    if (textEl) {
      textEl.textContent = "Yükleme başarısız";
    }

    if (clearBtn) {
      clearBtn.hidden = true;
    }

    syncCartoonCredits();
    setStatus("Dosya yüklenemedi. Lütfen tekrar dene.");
  }
}

function clearUpload(input, clearBtn, textEl, stateKey, urlKey){
  if (input) input.value = "";

  state[stateKey] = null;
  state[urlKey] = "";

  if (textEl) {
    textEl.textContent = "Dosya seçilmedi";
  }

  if (clearBtn) {
    clearBtn.hidden = true;
  }
}
function getCartoonCharacterCredit(){
  return state.characterImageFile ? 30 : 20;
}

function getCartoonBasicCredit(){
  let total = 30;

  if (state.logoFile) total += 10;
  if (state.audioFile) total += 10;
  if (state.customCharacterFile) total += 10;

  return total;
}

function syncCartoonCredits(){
  const characterCredit = getCartoonCharacterCredit();
  const basicCredit = getCartoonBasicCredit();

  if (characterBtn) {
    characterBtn.textContent = "🧩 Karakter Oluştur (" + characterCredit + " Kredi)";
    characterBtn.setAttribute("data-credit-cost", String(characterCredit));
  }

  if (generateBtn) {
    generateBtn.textContent = "🎬 Sahneyi Oluştur (" + basicCredit + " Kredi)";
    generateBtn.setAttribute("data-credit-cost", String(basicCredit));
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
    characterImageEl.addEventListener("change", async function(){
      await setUploadState(characterImageEl, characterImageClearEl, characterImageTextEl, "characterImageFile", "characterImageUrl");

      if (state.characterImageUrl) {
        setStatus("Karakter referans görseli yüklendi.");
      }
    });
  }

  if (characterImageClearEl) {
    characterImageClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(characterImageEl, characterImageClearEl, characterImageTextEl, "characterImageFile", "characterImageUrl");
      syncCartoonCredits();
      setStatus("Karakter referans görseli kaldırıldı.");
    });
  }

  if (audioFileEl) {
    audioFileEl.addEventListener("change", async function(){
      await setUploadState(audioFileEl, audioClearEl, audioTextEl, "audioFile", "audioUrl");

      if (state.audioUrl) {
        setStatus("Audio yüklendi.");
      }
    });
  }

  if (audioClearEl) {
    audioClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(audioFileEl, audioClearEl, audioTextEl, "audioFile", "audioUrl");
      syncCartoonCredits();
      setStatus("Audio kaldırıldı.");
    });
  }

  if (logoFileEl) {
    logoFileEl.addEventListener("change", async function(){
      await setUploadState(logoFileEl, logoClearEl, logoTextEl, "logoFile", "logoUrl");

      if (state.logoUrl) {
        setStatus("Logo yüklendi.");
      }
    });
  }

  if (logoClearEl) {
    logoClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(logoFileEl, logoClearEl, logoTextEl, "logoFile", "logoUrl");
      syncCartoonCredits();
      setStatus("Logo kaldırıldı.");
    });
  }

  if (customFileEl) {
    customFileEl.addEventListener("change", async function(){
      await setUploadState(customFileEl, customClearEl, customTextEl, "customCharacterFile", "customCharacterUrl");

      if (state.customCharacterUrl) {
        setStatus("Kendi karakter görselin yüklendi.");
      }
    });
  }

  if (customClearEl) {
    customClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      clearUpload(customFileEl, customClearEl, customTextEl, "customCharacterFile", "customCharacterUrl");
      syncCartoonCredits();
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
syncCartoonCredits();

setMode("character");

  window.mobileCartoonState = state;
})();
