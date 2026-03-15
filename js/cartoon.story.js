(() => {
  if (window.__CARTOON_STORY_BIND__) return;
  window.__CARTOON_STORY_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  function safeText(value) {
    return String(value || "").trim();
  }

  function clampText(value, max) {
    return String(value || "").slice(0, max);
  }

  /* 01) Varsayılan 12 sahne state’i */
  function createDefaultScenes() {
    return [
      {
        id: "intro-1",
        section: "intro",
        title: "Sahne 1 · Dünya Açılışı",
        description: "Ortam ve genel atmosfer kurulur.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "intro-2",
        section: "intro",
        title: "Sahne 2 · Ana Karakter Tanıtımı",
        description: "Ana karakter ilk kez görünür.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "intro-3",
        section: "intro",
        title: "Sahne 3 · Hedefin Ortaya Çıkışı",
        description: "Karakterin amacı netleşir.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "setup-1",
        section: "setup",
        title: "Sahne 4 · Yardımcı Unsur Gelir",
        description: "Yardımcı karakter veya unsur hikayeye dahil olur.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "setup-2",
        section: "setup",
        title: "Sahne 5 · Yolculuk Başlar",
        description: "Karakterler harekete geçer.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "setup-3",
        section: "setup",
        title: "Sahne 6 · İlk Engel",
        description: "İlk zorluk veya çatışma görünür.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "adventure-1",
        section: "adventure",
        title: "Sahne 7 · Macera Derinleşir",
        description: "Olaylar büyümeye başlar.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "adventure-2",
        section: "adventure",
        title: "Sahne 8 · Deneme ve Çaba",
        description: "Karakterler çözüm için yeni bir yol dener.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "adventure-3",
        section: "adventure",
        title: "Sahne 9 · Gerilim Artar",
        description: "Engel büyür, risk yükselir.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "adventure-4",
        section: "adventure",
        title: "Sahne 10 · Doruk Noktası",
        description: "En kritik karşılaşma yaşanır.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "final-1",
        section: "final",
        title: "Sahne 11 · Çözüm",
        description: "Sorun çözülür.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
      {
        id: "final-2",
        section: "final",
        title: "Sahne 12 · Kapanış",
        description: "Hikaye sıcak bir final ile biter.",
        characters: "",
        duration: "15",
        mood: "",
        type: "",
        directorNote: "",
      },
    ];
  }

  const state = (window.__CARTOON_STORY_STATE__ =
    window.__CARTOON_STORY_STATE__ || {
      mode: "story",
      storyIdea: "",
      theme: "",
      ageGroup: "",
      duration: "180",
      mainCharacter: "",
      helperCharacter1: "",
      helperCharacter2: "",
      settingsOpen: false,
      ratio: "16:9",
      style: "",
      audio: "none",
      extraPrompt: "",
      openSection: "intro",
      editingSceneId: "",
      isGenerating: false,
      scenes: createDefaultScenes(),
    });

  /* 02) Scene bul / güncelle */
  function getSceneById(sceneId) {
    return state.scenes.find((scene) => scene.id === sceneId) || null;
  }

  function updateSceneById(sceneId, patch) {
    state.scenes = state.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...patch } : scene
    );
  }

  /* 03) Story counter */
  function updateStoryIdeaCount(root) {
    const input = qs("[data-story-idea]", root);
    const out = qs("[data-story-idea-count]", root);

    if (!input || !out) return;

    const len = String(input.value || "").length;
    out.textContent = `${len} / 5000`;
  }

  /* 04) Mode tab senkronu */
  function syncModeTabs(root) {
    qsa("[data-cartoon-mode]", root).forEach((btn) => {
      const on = btn.dataset.cartoonMode === state.mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  /* 05) Mode view senkronu */
  function syncModeViews(root) {
    qsa(".cartoon-mode-view[data-cartoon-view]", root).forEach((el) => {
      const view = el.dataset.cartoonView || "";
      const on = view === state.mode;
      el.hidden = !on;
      el.classList.toggle("is-active", on);
    });
  }

  /* 06) Form değerlerini state’ten DOM’a yaz */
  function syncStoryFormValues(root) {
    const storyIdea = qs("[data-story-idea]", root);
    const theme = qs("[data-story-theme]", root);
    const ageGroup = qs("[data-story-age-group]", root);
    const duration = qs("[data-story-duration]", root);
    const mainCharacter = qs("[data-story-main-character]", root);
    const helperCharacter1 = qs("[data-story-helper-1]", root);
    const helperCharacter2 = qs("[data-story-helper-2]", root);
    const ratio = qs("[data-story-ratio]", root);
    const style = qs("[data-story-style]", root);
    const audio = qs("[data-story-audio]", root);
    const extraPrompt = qs("[data-story-extra-prompt]", root);

    if (storyIdea && storyIdea.value !== state.storyIdea) storyIdea.value = state.storyIdea;
    if (theme && theme.value !== state.theme) theme.value = state.theme;
    if (ageGroup && ageGroup.value !== state.ageGroup) ageGroup.value = state.ageGroup;
    if (duration && duration.value !== state.duration) duration.value = state.duration;
    if (mainCharacter && mainCharacter.value !== state.mainCharacter) mainCharacter.value = state.mainCharacter;
    if (helperCharacter1 && helperCharacter1.value !== state.helperCharacter1) helperCharacter1.value = state.helperCharacter1;
    if (helperCharacter2 && helperCharacter2.value !== state.helperCharacter2) helperCharacter2.value = state.helperCharacter2;
    if (ratio && ratio.value !== state.ratio) ratio.value = state.ratio;
    if (style && style.value !== state.style) style.value = state.style;
    if (audio && audio.value !== state.audio) audio.value = state.audio;
    if (extraPrompt && extraPrompt.value !== state.extraPrompt) extraPrompt.value = state.extraPrompt;
  }

  /* 07) Accordion */
  function syncStoryAccordion(root) {
    qsa("[data-story-section]", root).forEach((sectionEl) => {
      const sectionId = sectionEl.dataset.storySection || "";
      const isOpen = sectionId === state.openSection;

      sectionEl.classList.toggle("is-open", isOpen);

      const body = qs("[data-story-section-body]", sectionEl);
      if (body) body.hidden = !isOpen;

      const toggle = qs("[data-story-section-toggle]", sectionEl);
      if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  /* 08) Üretim ayarları aç/kapa */
  function syncStorySettings(root) {
    const body = qs("[data-story-settings-body]", root);
    const toggle = qs("[data-story-settings-toggle]", root);
    const icon = qs("[data-story-settings-icon]", root);

    if (body) body.hidden = !state.settingsOpen;
    if (toggle) toggle.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
    if (icon) icon.classList.toggle("is-open", !!state.settingsOpen);
  }

  /* 09) Sahne satırlarını state ile güncelle */
  function syncSceneRows(root) {
    qsa("[data-story-scene-id]", root).forEach((row) => {
      const sceneId = row.dataset.storySceneId || "";
      const scene = getSceneById(sceneId);
      if (!scene) return;

      const titleEl = qs("[data-scene-title]", row);
      const descEl = qs("[data-scene-description]", row);
      const durationEl = qs("[data-scene-duration]", row);

      if (titleEl) titleEl.textContent = scene.title || "Sahne";
      if (descEl) descEl.textContent = scene.description || "";
      if (durationEl) durationEl.textContent = `${scene.duration || "15"} sn`;

      row.classList.toggle("is-edited", !!scene.mood || !!scene.type || !!scene.directorNote || !!scene.characters);
    });
  }

  /* 10) Popup alanlarını doldur */
  function fillSceneEditor(root, sceneId) {
    const editor = qs("[data-story-scene-editor]", root);
    const scene = getSceneById(sceneId);
    if (!editor || !scene) return;

    const title = qs("[data-scene-editor-title]", editor);
    const description = qs("[data-scene-editor-description]", editor);
    const characters = qs("[data-scene-editor-characters]", editor);
    const duration = qs("[data-scene-editor-duration]", editor);
    const mood = qs("[data-scene-editor-mood]", editor);
    const type = qs("[data-scene-editor-type]", editor);
    const note = qs("[data-scene-editor-note]", editor);
    const label = qs("[data-scene-editor-heading]", editor);

    if (label) label.textContent = scene.title || "Sahne Düzenle";
    if (title) title.value = scene.title || "";
    if (description) description.value = scene.description || "";
    if (characters) characters.value = scene.characters || "";
    if (duration) duration.value = scene.duration || "15";
    if (mood) mood.value = scene.mood || "";
    if (type) type.value = scene.type || "";
    if (note) note.value = scene.directorNote || "";
  }

  /* 11) Popup aç/kapa */
  function syncSceneEditor(root) {
    const editor = qs("[data-story-scene-editor]", root);
    if (!editor) return;

    const isOpen = !!state.editingSceneId;
    editor.hidden = !isOpen;
    editor.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("story-scene-editor-open", isOpen);

    if (isOpen) {
      fillSceneEditor(root, state.editingSceneId);
    }
  }

  /* 12) Story payload */
  function buildStoryPayload() {
    return {
      app: "cartoon",
      mode: "story",
      summary: {
        idea: state.storyIdea,
        theme: state.theme,
        ageGroup: state.ageGroup,
        maxDurationSeconds: Number(state.duration || 180),
      },
      characters: {
        main: state.mainCharacter,
        helper1: state.helperCharacter1,
        helper2: state.helperCharacter2,
      },
      settings: {
        aspectRatio: state.ratio,
        style: state.style,
        audio: state.audio,
        extraPrompt: state.extraPrompt,
      },
      sections: {
        intro: state.scenes.filter((scene) => scene.section === "intro"),
        setup: state.scenes.filter((scene) => scene.section === "setup"),
        adventure: state.scenes.filter((scene) => scene.section === "adventure"),
        final: state.scenes.filter((scene) => scene.section === "final"),
      },
      scenes: [...state.scenes],
      multi_prompt: state.scenes.map((scene, index) => ({
        order: index + 1,
        id: scene.id,
        section: scene.section,
        title: scene.title,
        prompt: [
          scene.title,
          scene.description,
          scene.characters ? `Karakterler: ${scene.characters}` : "",
          scene.mood ? `Ton: ${scene.mood}` : "",
          scene.type ? `Sahne tipi: ${scene.type}` : "",
          scene.directorNote ? `Yönetmen notu: ${scene.directorNote}` : "",
          `Süre: ${scene.duration || "15"} sn`,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      elements: [
        state.mainCharacter,
        state.helperCharacter1,
        state.helperCharacter2,
      ].filter(Boolean),
    };
  }

  /* 13) Render */
  function render(root) {
    if (!root) return;
    syncModeTabs(root);
    syncModeViews(root);
    syncStoryFormValues(root);
    syncStoryAccordion(root);
    syncStorySettings(root);
    syncSceneRows(root);
    syncSceneEditor(root);
    updateStoryIdeaCount(root);
  }

  /* 14) Scene editor save */
  function saveSceneEditor(root) {
    if (!state.editingSceneId) return;

    const editor = qs("[data-story-scene-editor]", root);
    if (!editor) return;

    const title = qs("[data-scene-editor-title]", editor);
    const description = qs("[data-scene-editor-description]", editor);
    const characters = qs("[data-scene-editor-characters]", editor);
    const duration = qs("[data-scene-editor-duration]", editor);
    const mood = qs("[data-scene-editor-mood]", editor);
    const type = qs("[data-scene-editor-type]", editor);
    const note = qs("[data-scene-editor-note]", editor);

    const nextTitle = safeText(title?.value);
    const nextDescription = safeText(description?.value);
    const nextCharacters = safeText(characters?.value);
    const nextDuration = safeText(duration?.value) || "15";
    const nextMood = safeText(mood?.value);
    const nextType = safeText(type?.value);
    const nextNote = clampText(note?.value, 1000);

    if (!nextTitle) {
      alert("Sahne Başlığı zorunlu.");
      return;
    }

    if (!nextDescription) {
      alert("Sahne Açıklaması zorunlu.");
      return;
    }

    if (!nextCharacters) {
      alert("Sahnedeki Karakterler zorunlu.");
      return;
    }

    updateSceneById(state.editingSceneId, {
      title: nextTitle,
      description: nextDescription,
      characters: nextCharacters,
      duration: nextDuration,
      mood: nextMood,
      type: nextType,
      directorNote: nextNote,
    });

    state.editingSceneId = "";
    render(root);
  }

  /* 15) Click eventleri */
  function bindClicks() {
    document.addEventListener("click", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const modeBtn = e.target.closest("[data-cartoon-mode]");
      if (modeBtn && root.contains(modeBtn)) {
        e.preventDefault();
        state.mode = modeBtn.dataset.cartoonMode || "story";
        render(root);
        return;
      }

      const sectionToggle = e.target.closest("[data-story-section-toggle]");
      if (sectionToggle && root.contains(sectionToggle)) {
        e.preventDefault();

        const sectionEl = sectionToggle.closest("[data-story-section]");
        const sectionId = sectionEl?.dataset.storySection || "";

        if (!sectionId) return;

        state.openSection = state.openSection === sectionId ? "" : sectionId;
        render(root);
        return;
      }

      const settingsToggle = e.target.closest("[data-story-settings-toggle]");
      if (settingsToggle && root.contains(settingsToggle)) {
        e.preventDefault();
        state.settingsOpen = !state.settingsOpen;
        render(root);
        return;
      }

      const editSceneBtn = e.target.closest("[data-edit-scene]");
      if (editSceneBtn && root.contains(editSceneBtn)) {
        e.preventDefault();

        const row = editSceneBtn.closest("[data-story-scene-id]");
        const sceneId =
          editSceneBtn.dataset.editScene ||
          row?.dataset.storySceneId ||
          "";

        if (!sceneId) return;

        state.editingSceneId = sceneId;
        render(root);
        return;
      }

      const cancelBtn = e.target.closest("[data-scene-cancel]");
      if (cancelBtn && root.contains(cancelBtn)) {
        e.preventDefault();
        state.editingSceneId = "";
        render(root);
        return;
      }

      const saveBtn = e.target.closest("[data-scene-save]");
      if (saveBtn && root.contains(saveBtn)) {
        e.preventDefault();
        saveSceneEditor(root);
        return;
      }

      const editorBackdrop = e.target.closest("[data-story-scene-editor]");
      if (
        editorBackdrop &&
        root.contains(editorBackdrop) &&
        e.target === editorBackdrop
      ) {
        state.editingSceneId = "";
        render(root);
        return;
      }

      const generateBtn = e.target.closest("[data-story-generate]");
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();
        if (state.mode !== "story") return;
        if (state.isGenerating) return;

        const payload = buildStoryPayload();

        window.__LAST_CARTOON_STORY_PAYLOAD__ = payload;
        console.log("[CARTOON][STORY_PAYLOAD_READY]", payload);

        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:story_payload_ready", {
            detail: payload,
          })
        );
      }
    });
  }

  /* 16) Input eventleri */
  function bindInputs() {
    document.addEventListener("input", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const storyIdea = e.target.closest("[data-story-idea]");
      if (storyIdea && root.contains(storyIdea)) {
        state.storyIdea = clampText(storyIdea.value, 5000);
        updateStoryIdeaCount(root);
        return;
      }

      const extraPrompt = e.target.closest("[data-story-extra-prompt]");
      if (extraPrompt && root.contains(extraPrompt)) {
        state.extraPrompt = clampText(extraPrompt.value, 5000);
        return;
      }
    });
  }

  /* 17) Change eventleri */
  function bindChanges() {
    document.addEventListener("change", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const theme = e.target.closest("[data-story-theme]");
      if (theme && root.contains(theme)) {
        state.theme = theme.value || "";
        return;
      }

      const ageGroup = e.target.closest("[data-story-age-group]");
      if (ageGroup && root.contains(ageGroup)) {
        state.ageGroup = ageGroup.value || "";
        return;
      }

      const duration = e.target.closest("[data-story-duration]");
      if (duration && root.contains(duration)) {
        state.duration = duration.value || "180";
        return;
      }

      const mainCharacter = e.target.closest("[data-story-main-character]");
      if (mainCharacter && root.contains(mainCharacter)) {
        state.mainCharacter = mainCharacter.value || "";
        return;
      }

      const helper1 = e.target.closest("[data-story-helper-1]");
      if (helper1 && root.contains(helper1)) {
        state.helperCharacter1 = helper1.value || "";
        return;
      }

      const helper2 = e.target.closest("[data-story-helper-2]");
      if (helper2 && root.contains(helper2)) {
        state.helperCharacter2 = helper2.value || "";
        return;
      }

      const ratio = e.target.closest("[data-story-ratio]");
      if (ratio && root.contains(ratio)) {
        state.ratio = ratio.value || "16:9";
        return;
      }

      const style = e.target.closest("[data-story-style]");
      if (style && root.contains(style)) {
        state.style = style.value || "";
        return;
      }

      const audio = e.target.closest("[data-story-audio]");
      if (audio && root.contains(audio)) {
        state.audio = audio.value || "none";
        return;
      }
    });
  }

  /* 18) DOM’dan ilk değerleri oku */
  function initFromDOM(root) {
    if (!root) return;

    const selectedMode = qs('[data-cartoon-mode].is-active', root);
    if (selectedMode?.dataset.cartoonMode) {
      state.mode = selectedMode.dataset.cartoonMode;
    }

    const storyIdea = qs("[data-story-idea]", root);
    const theme = qs("[data-story-theme]", root);
    const ageGroup = qs("[data-story-age-group]", root);
    const duration = qs("[data-story-duration]", root);
    const mainCharacter = qs("[data-story-main-character]", root);
    const helper1 = qs("[data-story-helper-1]", root);
    const helper2 = qs("[data-story-helper-2]", root);
    const ratio = qs("[data-story-ratio]", root);
    const style = qs("[data-story-style]", root);
    const audio = qs("[data-story-audio]", root);
    const extraPrompt = qs("[data-story-extra-prompt]", root);

    if (storyIdea) state.storyIdea = clampText(storyIdea.value, 5000);
    if (theme) state.theme = theme.value || "";
    if (ageGroup) state.ageGroup = ageGroup.value || "";
    if (duration) state.duration = duration.value || "180";
    if (mainCharacter) state.mainCharacter = mainCharacter.value || "";
    if (helper1) state.helperCharacter1 = helper1.value || "";
    if (helper2) state.helperCharacter2 = helper2.value || "";
    if (ratio) state.ratio = ratio.value || "16:9";
    if (style) state.style = style.value || "";
    if (audio) state.audio = audio.value || "none";
    if (extraPrompt) state.extraPrompt = clampText(extraPrompt.value, 5000);

    qsa("[data-story-scene-id]", root).forEach((row) => {
      const sceneId = row.dataset.storySceneId || "";
      const scene = getSceneById(sceneId);
      if (!scene) return;

      const titleEl = qs("[data-scene-title]", row);
      const descEl = qs("[data-scene-description]", row);
      const durationEl = qs("[data-scene-duration]", row);

      if (titleEl) scene.title = safeText(titleEl.textContent) || scene.title;
      if (descEl) scene.description = safeText(descEl.textContent) || scene.description;

      if (durationEl) {
        const raw = safeText(durationEl.textContent).replace(/[^\d]/g, "");
        if (raw) scene.duration = raw;
      }
    });

    const openSectionEl =
      qs('[data-story-section].is-open', root) ||
      qs("[data-story-section]", root);

    if (openSectionEl?.dataset.storySection) {
      state.openSection = openSectionEl.dataset.storySection;
    }

    const settingsBody = qs("[data-story-settings-body]", root);
    state.settingsOpen = settingsBody ? !settingsBody.hidden : false;

    render(root);
  }

  /* 19) Init */
  function tryInit() {
    const root = getCartoonRoot();
    if (!root) return false;
    initFromDOM(root);
    return true;
  }

  bindClicks();
  bindInputs();
  bindChanges();

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
