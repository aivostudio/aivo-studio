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

  const state = {
    mode: "character",
    characterPrompt: "",
    scenePrompt: "",
    mainCharacter: "red-fish",
    scene: "underwater",
    action: "swimming",
    duration: "4",
    ratio: "16:9"
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
  bindButtons();

  setMode("character");

  window.mobileCartoonState = state;
})();
