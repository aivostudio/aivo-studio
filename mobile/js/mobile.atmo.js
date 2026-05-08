(function(){
  const root = document.getElementById("mobileAtmoSection");
  if (!root || root.__mobileAtmoBound) return;
  root.__mobileAtmoBound = true;

  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-atmo-mode]"));
  const panels = Array.from(root.querySelectorAll("[data-mobile-atmo-panel]"));

  const basicStatusEl = root.querySelector("#mobileAtmoStatus");
  const proStatusEl = root.querySelector("#mobileAtmoProStatus");

  const promptEl = root.querySelector("#mobileAtmoPrompt");
  const promptCountEl = root.querySelector("#mobileAtmoPromptCount");

  const basicDurationEl = root.querySelector("#mobileAtmoDuration");
  const basicRatioEl = root.querySelector("#mobileAtmoRatio");

const proDurationEl = root.querySelector("#mobileAtmoProDuration");
const proRatioEl = root.querySelector("#mobileAtmoProRatio");
  const basicGenerateBtn = root.querySelector("#mobileAtmoGenerateBtn");
  const proGenerateBtn = root.querySelector("#mobileAtmoProGenerateBtn");

  const state = {
    mode: "basic",

    basic: {
      scene: "",
      effects: [],
      duration: "4",
      ratio: "1:1",
      imageFile: null,
      logoFile: null,
      audioFile: null
    },

    pro: {
      prompt: "",
      light: "",
      mood: "",
      details: [],
      duration: "4",
      ratio: "16:9",
      imageFile: null,
      logoFile: null,
      audioFile: null
    }
  };

  function safeText(value){
    return String(value || "").trim();
  }

  function setStatus(message){
    const text = safeText(message);

    if (state.mode === "pro") {
      if (proStatusEl) proStatusEl.textContent = text;
      return;
    }

    if (basicStatusEl) basicStatusEl.textContent = text;
  }

  function setMode(mode){
    const nextMode = mode === "pro" ? "pro" : "basic";
    state.mode = nextMode;

    modeButtons.forEach(function(btn){
      const active = btn.getAttribute("data-mobile-atmo-mode") === nextMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    panels.forEach(function(panel){
      const active = panel.getAttribute("data-mobile-atmo-panel") === nextMode;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    setStatus("");
  }

  function bindModeTabs(){
    modeButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        setMode(btn.getAttribute("data-mobile-atmo-mode"));
      });
    });
  }

  function bindBasicScenes(){
    const sceneButtons = Array.from(root.querySelectorAll("[data-atmo-scene]"));

    sceneButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const scene = safeText(btn.getAttribute("data-atmo-scene"));
        state.basic.scene = scene;

        sceneButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function bindBasicEffects(){
    const effectButtons = Array.from(root.querySelectorAll("[data-atmo-eff]"));

    effectButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const effect = safeText(btn.getAttribute("data-atmo-eff"));
        if (!effect) return;

        const exists = state.basic.effects.includes(effect);

        if (exists) {
          state.basic.effects = state.basic.effects.filter(function(item){
            return item !== effect;
          });
        } else {
          state.basic.effects.push(effect);
        }

        btn.classList.toggle("is-active", !exists);
        btn.setAttribute("aria-pressed", !exists ? "true" : "false");
      });
    });
  }

  function bindBasicControls(){
    if (basicDurationEl) {
      basicDurationEl.addEventListener("change", function(){
        state.basic.duration = safeText(basicDurationEl.value) || "4";
      });

      state.basic.duration = safeText(basicDurationEl.value) || "4";
    }

    if (basicRatioEl) {
      basicRatioEl.addEventListener("change", function(){
        state.basic.ratio = safeText(basicRatioEl.value) || "1:1";
      });

      state.basic.ratio = safeText(basicRatioEl.value) || "1:1";
    }
  }

  function bindProPrompt(){
    if (!promptEl || !promptCountEl) return;

    function updatePrompt(){
      const value = String(promptEl.value || "");
      state.pro.prompt = value.trim();
      promptCountEl.textContent = String(value.length);
    }

    promptEl.addEventListener("input", updatePrompt);
    promptEl.addEventListener("change", updatePrompt);
    updatePrompt();
  }

  function bindProStyle(){
    const lightButtons = Array.from(root.querySelectorAll("[data-atmo-light]"));
    const moodButtons = Array.from(root.querySelectorAll("[data-atmo-mood]"));

    lightButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-atmo-light"));
        state.pro.light = value;

        lightButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });

    moodButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-atmo-mood"));
        state.pro.mood = value;

        moodButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function bindProDetails(){
    const checks = Array.from(root.querySelectorAll("[data-atmo-detail]"));

    checks.forEach(function(input){
      input.addEventListener("change", function(){
        const value = safeText(input.getAttribute("data-atmo-detail"));
        if (!value) return;

        if (input.checked) {
          if (!state.pro.details.includes(value)) {
            state.pro.details.push(value);
          }
        } else {
          state.pro.details = state.pro.details.filter(function(item){
            return item !== value;
          });
        }
      });
    });
  }

  function bindProControls(){
    const proRatioButtons = Array.from(root.querySelectorAll("[data-atmo-pro-ratio]"));

    if (proDurationEl) {
      proDurationEl.addEventListener("change", function(){
        state.pro.duration = safeText(proDurationEl.value) || "4";
      });

      state.pro.duration = safeText(proDurationEl.value) || "4";
    }

    proRatioButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-atmo-pro-ratio")) || "16:9";
        state.pro.ratio = value;

        proRatioButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function setFileLabel(input, file){
    const label = input && input.closest("label");
    if (!label) return;

    if (!label.dataset.originalText) {
      label.dataset.originalText = safeText(label.textContent);
    }

    if (!file) {
      label.childNodes.forEach(function(node){
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = " " + label.dataset.originalText.replace(/^[^\s]+\s*/, "");
        }
      });
      return;
    }

    const name = file.name && file.name.length > 18
      ? file.name.slice(0, 15) + "..."
      : file.name;

    label.childNodes.forEach(function(node){
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = " " + name;
      }
    });
  }

  function bindFiles(){
    const fileMap = [
      { id:"#mobileAtmoImageFile", target:"basic", key:"imageFile" },
      { id:"#mobileAtmoLogoFile", target:"basic", key:"logoFile" },
      { id:"#mobileAtmoAudioFile", target:"basic", key:"audioFile" },
      { id:"#mobileAtmoProImageFile", target:"pro", key:"imageFile" },
      { id:"#mobileAtmoProLogoFile", target:"pro", key:"logoFile" },
      { id:"#mobileAtmoProAudioFile", target:"pro", key:"audioFile" }
    ];

    fileMap.forEach(function(item){
      const input = root.querySelector(item.id);
      if (!input) return;

      input.addEventListener("change", function(){
        const file = input.files && input.files[0] ? input.files[0] : null;
        state[item.target][item.key] = file;
        setFileLabel(input, file);
      });
    });
  }

  function buildBasicPayload(){
    return {
      mode: "basic",
      scene: state.basic.scene,
      effects: state.basic.effects.slice(),
      duration: state.basic.duration,
      ratio: state.basic.ratio,
      has_image: !!state.basic.imageFile,
      has_logo: !!state.basic.logoFile,
      has_audio: !!state.basic.audioFile
    };
  }

  function buildProPayload(){
    return {
      mode: "pro",
      prompt: state.pro.prompt,
      light: state.pro.light,
      mood: state.pro.mood,
      details: state.pro.details.slice(),
      duration: state.pro.duration,
      ratio: state.pro.ratio,
      has_image: !!state.pro.imageFile,
      has_logo: !!state.pro.logoFile,
      has_audio: !!state.pro.audioFile
    };
  }

  function bindGenerateButtons(){
    if (basicGenerateBtn) {
      basicGenerateBtn.addEventListener("click", function(){
        const payload = buildBasicPayload();

        if (!payload.scene && !payload.has_image) {
          setStatus("Lütfen bir arka mekan seç veya resim yükle.");
          return;
        }

        setStatus("Atmosfer video üretimi bir sonraki adımda backend’e bağlanacak.");
        console.log("[MOBILE ATMO][BASIC PAYLOAD]", payload);
      });
    }

    if (proGenerateBtn) {
      proGenerateBtn.addEventListener("click", function(){
        const payload = buildProPayload();

        if (!payload.prompt) {
          setStatus("Süper Mod için prompt yazmalısın.");
          return;
        }

        setStatus("Süper atmosfer üretimi bir sonraki adımda backend’e bağlanacak.");
        console.log("[MOBILE ATMO][PRO PAYLOAD]", payload);
      });
    }
  }

  bindModeTabs();
  bindBasicScenes();
  bindBasicEffects();
  bindBasicControls();
  bindProPrompt();
  bindProStyle();
  bindProDetails();
  bindProControls();
  bindFiles();
  bindGenerateButtons();

  setMode("basic");

  window.mobileAtmoState = state;
})();
