(() => {
  if (window.__CARTOON_BASIC_BIND__) return;
  window.__CARTOON_BASIC_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  const state = (window.__CARTOON_BASIC_STATE__ = window.__CARTOON_BASIC_STATE__ || {
    mode: "basic",
    extraPrompt: "",
    mainCharacter: "red-fish",
    helpers: [],
    scene: "underwater",
    action: "swimming",
    duration: "5",
    ratio: "16:9",
    audioEnabled: false,
    characterImage: null,
    characterImageName: ""
  });

  function getEstimatedCredits() {
    const durationNum = Number(state.duration || 5);
    if (durationNum <= 5) return 10;
    if (durationNum <= 10) return 20;
    return 30;
  }

  function updatePromptCount(root) {
    const input = qs("[data-cartoon-prompt-input]", root);
    const out = qs("[data-cartoon-prompt-count]", root);
    if (!input || !out) return;

    const len = String(input.value || "").length;
    out.textContent = `${len} / 1000`;
  }

  function updateHelperCount(root) {
    const el = qs("[data-helper-count]", root);
    if (!el) return;
    el.textContent = `${state.helpers.length}/3`;
  }

  function updateUploadText(root) {
    const textEl = qs(".cartoon-upload-text", root);
    if (!textEl) return;
    textEl.textContent = state.characterImageName || "Dosya seçilmedi";
  }

  function updateSummary(root) {
    const el = qs("[data-cartoon-summary]", root);
    if (!el) return;

    const durationText = `${state.duration} sn`;
    const mainCountText = state.mainCharacter ? "1 ana karakter" : "0 ana karakter";
    const helperCountText = `${state.helpers.length} yardımcı`;
    const creditText = `${getEstimatedCredits()} kredi`;

    el.textContent = `${durationText} • ${mainCountText} • ${helperCountText} • ${creditText}`;
  }

  function syncMainSelection(root) {
    qsa('[data-role="main"]', root).forEach((btn) => {
      const on = btn.dataset.character === state.mainCharacter;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncHelperSelection(root) {
    qsa('[data-role="helper"]', root).forEach((btn) => {
      const on = state.helpers.includes(btn.dataset.character);
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncSceneSelection(root) {
    qsa("[data-scene]", root).forEach((btn) => {
      const on = btn.dataset.scene === state.scene;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

 function syncActionSelection(root) {
  qsa("[data-action]", root).forEach((btn) => {
    const on = btn.dataset.action === state.action;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function syncModeTabs(root) {
  qsa("[data-cartoon-mode]", root).forEach((btn) => {
    const on = btn.dataset.cartoonMode === state.mode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
}
function syncModeViews(root) {
  qsa(".cartoon-mode-view[data-cartoon-view]", root).forEach((el) => {
    const view = el.dataset.cartoonView || "";
    const on = view === state.mode;
    el.hidden = !on;
    el.classList.toggle("is-active", on);
  });
}

function syncFormValues(root) {
  const prompt = qs("[data-cartoon-prompt-input]", root);
  const duration = qs("#cartoon-duration", root);
  const ratio = qs("#cartoon-ratio", root);
  const audio = qs("[data-audio-enabled]", root);

  if (prompt && prompt.value !== state.extraPrompt) prompt.value = state.extraPrompt;
  if (duration && duration.value !== state.duration) duration.value = state.duration;
  if (ratio && ratio.value !== state.ratio) ratio.value = state.ratio;
  if (audio) audio.checked = !!state.audioEnabled;
}

 function render(root) {
  if (!root) return;

  syncModeTabs(root);
  syncModeViews(root);
  syncMainSelection(root);
  syncHelperSelection(root);
  syncSceneSelection(root);
  syncActionSelection(root);
  syncFormValues(root);
  updatePromptCount(root);
  updateHelperCount(root);
  updateUploadText(root);
  updateSummary(root);
}

  function buildBasicPayload() {
    return {
      app: "cartoon",
      mode: state.mode,
      extraPrompt: state.extraPrompt,
      mainCharacter: state.mainCharacter,
      helperCharacters: [...state.helpers],
      scene: state.scene,
      action: state.action,
      duration: state.duration,
      aspectRatio: state.ratio,
      audioEnabled: !!state.audioEnabled,
      characterImage: state.characterImage,
      characterImageName: state.characterImageName,
      estimatedCredits: getEstimatedCredits()
    };
  }

  function buildCharacterCreatePayload(root) {
    const typeEl =
      root.querySelector('[name="characterType"]') ||
      root.querySelector('[data-cartoon-character-type]');

    const nameEl =
      root.querySelector('[name="characterName"]') ||
      root.querySelector('[data-cartoon-character-name]');

    const descEl =
      root.querySelector('[name="characterPrompt"]') ||
      root.querySelector('[data-cartoon-character-prompt]');

    const styleEl =
      root.querySelector('[name="characterStyle"]') ||
      root.querySelector('[data-cartoon-character-style]');

    const fileEl =
      root.querySelector('[name="characterReference"]') ||
      root.querySelector('[data-cartoon-character-reference]');

    const payload = {
      mode: 'character',
      type: (typeEl?.value || '').trim(),
      name: (nameEl?.value || '').trim(),
      prompt: (descEl?.value || '').trim(),
      style: (styleEl?.value || '').trim(),
      referenceFile: fileEl?.files?.[0] || null
    };

    return payload;
  }

  async function pollCartoonJob(jobId, tries = 0) {
    try {
      const r = await fetch(
        `/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1`
      );
      const j2 = await r.json().catch(() => null);

      console.log("[CARTOON] poll =", j2);

      if (!j2 || j2.ok === false) {
        if (tries < 60) {
          setTimeout(() => pollCartoonJob(jobId, tries + 1), 3000);
        }
        return;
      }

      if (j2.status === "ready" && j2.video?.url) {
        window.__LAST_CARTOON_STATUS__ = j2;

        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:job_ready", {
            detail: {
              job_id: jobId,
              status: j2.status,
              video: j2.video,
              outputs: j2.outputs || [],
              raw: j2
            }
          })
        );
        return;
      }

      if (j2.status === "error") {
        console.error("[CARTOON] job error =", j2);
        return;
      }

      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1), 3000);
      }
    } catch (err) {
      console.error("[CARTOON] poll error =", err);
      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1), 3000);
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const modeBtn = e.target.closest("[data-cartoon-mode]");
      if (modeBtn && root.contains(modeBtn)) {
        e.preventDefault();
        state.mode = modeBtn.dataset.cartoonMode || "basic";
        render(root);
        return;
      }

      const mainBtn = e.target.closest('[data-role="main"]');
      if (mainBtn && root.contains(mainBtn)) {
        e.preventDefault();
        state.mainCharacter = mainBtn.dataset.character || state.mainCharacter;
        render(root);
        return;
      }

      const helperBtn = e.target.closest('[data-role="helper"]');
      if (helperBtn && root.contains(helperBtn)) {
        e.preventDefault();
        const value = helperBtn.dataset.character;
        if (!value) return;

        const exists = state.helpers.includes(value);

        if (exists) {
          state.helpers = state.helpers.filter((x) => x !== value);
        } else {
          if (state.helpers.length >= 3) return;
          state.helpers = [...state.helpers, value];
        }

        render(root);
        return;
      }

      const sceneBtn = e.target.closest("[data-scene]");
      if (sceneBtn && root.contains(sceneBtn)) {
        e.preventDefault();
        state.scene = sceneBtn.dataset.scene || state.scene;
        render(root);
        return;
      }
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn && root.contains(actionBtn)) {
        e.preventDefault();
        state.action = actionBtn.dataset.action || state.action;
        render(root);
        return;
      }

          const characterCreateBtn = e.target.closest("[data-cartoon-character-create]");
      if (characterCreateBtn && root.contains(characterCreateBtn)) {
        e.preventDefault();

        const payload = buildCharacterCreatePayload(root);
        console.log("[CARTOON][CHARACTER] payload =", payload);

        characterCreateBtn.disabled = true;
        const prevText = characterCreateBtn.textContent;
        characterCreateBtn.textContent = "Oluşturuluyor...";
        characterCreateBtn.classList.add("is-loading");

        fetch("/api/providers/fal/cartoon/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(async (r) => {
            const j = await r.json().catch(() => null);
            console.log("[CARTOON][CHARACTER] create response =", j);

            if (!r.ok || !j || j.ok === false) {
              throw new Error(j?.error || `character_create_failed_${r.status}`);
            }
          })
          .catch((err) => {
            console.error("[CARTOON][CHARACTER] create error:", err);
            alert(String(err?.message || err || "character_create_failed"));
          })
          .finally(() => {
            characterCreateBtn.disabled = false;
            characterCreateBtn.textContent = prevText;
            characterCreateBtn.classList.remove("is-loading");
          });

        return;
      }

      const generateBtn = e.target.closest("[data-cartoon-generate]");
      
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();

        const payload = buildBasicPayload();

        generateBtn.disabled = true;
        const prevText = generateBtn.textContent;
        generateBtn.textContent = "Üretiliyor...";
        generateBtn.classList.add("is-loading");

        fetch("/api/providers/fal/cartoon/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(async (r) => {
            const j = await r.json().catch(() => null);
            if (!r.ok || !j || j.ok === false) {
              throw new Error(j?.error || `cartoon_create_failed_${r.status}`);
            }

            console.log("[CARTOON] create ok =", j);

            if (j?.job_id) {
              window.dispatchEvent(
                new CustomEvent("aivo:cartoon:job_created", {
                  detail: {
                    app: "cartoon",
                    job_id: j.job_id,
                    prompt: payload.extraPrompt || "",
                    createdAt: Date.now(),
                    meta: {
                      app: "cartoon",
                      provider: "fal",
                      prompt: [
                        payload.mainCharacter,
                        ...(payload.helperCharacters || []),
                        payload.scene,
                        payload.action,
                        payload.extraPrompt
                      ]
                        .filter(Boolean)
                        .join(" • "),
                      duration: payload.duration,
                      aspect_ratio: payload.aspectRatio
                    }
                  }
                })
              );

              pollCartoonJob(j.job_id);
            }
          })
          .catch((err) => {
            console.error("[CARTOON] create error:", err);
            alert(String(err?.message || err || "cartoon_create_failed"));
          })
         

        return;
      }
    });

    document.addEventListener("input", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const prompt = e.target.closest("[data-cartoon-prompt-input]");
      if (prompt && root.contains(prompt)) {
        state.extraPrompt = String(prompt.value || "");
        updatePromptCount(root);
        updateSummary(root);
      }
    });

    document.addEventListener("change", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const duration = e.target.closest("#cartoon-duration");
      if (duration && root.contains(duration)) {
        state.duration = duration.value || "5";
        updateSummary(root);
        return;
      }

      const ratio = e.target.closest("#cartoon-ratio");
      if (ratio && root.contains(ratio)) {
        state.ratio = ratio.value || "16:9";
        updateSummary(root);
        return;
      }

      const audio = e.target.closest("[data-audio-enabled]");
      if (audio && root.contains(audio)) {
        state.audioEnabled = !!audio.checked;
        updateSummary(root);
        return;
      }

      const upload = e.target.closest("[data-character-upload]");
      if (upload && root.contains(upload)) {
        const file = upload.files && upload.files[0] ? upload.files[0] : null;
        state.characterImage = file;
        state.characterImageName = file ? file.name : "";
        updateUploadText(root);
        updateSummary(root);
      }
    });
  }

  function initFromDOM(root) {
    if (!root) return;

    const selectedMain = qs('[data-role="main"].is-selected', root);
    const selectedScene = qs('[data-scene].is-selected', root);
    const selectedAction = qs('[data-action].is-selected', root);
    const selectedHelpers = qsa('[data-role="helper"].is-selected', root);

    const prompt = qs("[data-cartoon-prompt-input]", root);
    const duration = qs("#cartoon-duration", root);
    const ratio = qs("#cartoon-ratio", root);
    const audio = qs("[data-audio-enabled]", root);

    if (selectedMain?.dataset.character) state.mainCharacter = selectedMain.dataset.character;
    if (selectedScene?.dataset.scene) state.scene = selectedScene.dataset.scene;
    if (selectedAction?.dataset.action) state.action = selectedAction.dataset.action;

    state.helpers = selectedHelpers
      .map((btn) => btn.dataset.character)
      .filter(Boolean)
      .slice(0, 3);

    if (prompt) state.extraPrompt = String(prompt.value || "");
    if (duration?.value) state.duration = duration.value;
    if (ratio?.value) state.ratio = ratio.value;
    if (audio) state.audioEnabled = !!audio.checked;

    render(root);
  }

  function tryInit() {
    const root = getCartoonRoot();
    if (!root) return false;
    initFromDOM(root);
    return true;
  }

  bindEvents();

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
