(() => {
  if (window.__CARTOON_STORY_BIND__) return;
  window.__CARTOON_STORY_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORY_CHARACTER_SLOT_CONFIG = [
    {
      slot: "main",
      stateKey: "mainCharacter",
      selectSelectors: ['[data-story-main-character]'],
      uploadInputSelectors: ['[data-story-character-file="main"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="main"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="main"]']
    },
    {
      slot: "helper1",
      stateKey: "helperCharacter1",
      selectSelectors: ['[data-story-helper-1]'],
      uploadInputSelectors: ['[data-story-character-file="helper1"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="helper1"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="helper1"]']
    },
    {
      slot: "helper2",
      stateKey: "helperCharacter2",
      selectSelectors: ['[data-story-helper-2]'],
      uploadInputSelectors: ['[data-story-character-file="helper2"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="helper2"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="helper2"]']
    },
    {
      slot: "extra",
      stateKey: "extraCharacter",
      selectSelectors: ['[data-story-helper-3]', '[data-story-extra-character]'],
      uploadInputSelectors: ['[data-story-character-file="extra"]'],
      uploadTriggerSelectors: ['[data-story-upload-trigger="extra"]'],
      uploadRemoveSelectors: ['[data-story-upload-remove="extra"]']
    }
  ];

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  function safeText(value) {
    return String(value || "").trim();
  }

  function clampText(value, max) {
    return String(value || "").slice(0, max);
  }

  function normalizeStorySceneDuration(value) {
    const n = Number(value || 15);
    if (n <= 5) return "5";
    if (n <= 10) return "10";
    return "15";
  }

  function formatSecondsLabel(totalSeconds) {
    const total = Math.max(0, Number(totalSeconds || 0));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    if (minutes > 0 && seconds > 0) return `${minutes} dk ${seconds} sn`;
    if (minutes > 0) return `${minutes} dk`;
    return `${seconds} sn`;
  }

  function toSceneDurationNumber(value) {
    return Number(normalizeStorySceneDuration(value));
  }

  async function presignStoryCharacterReference(file, slot) {
    const safeSlot = String(slot || "main").trim() || "main";

    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "cartoon",
        kind: `story-reference-${safeSlot}`,
        filename: file?.name || `${safeSlot}-${Date.now()}.png`,
        contentType: file?.type || "application/octet-stream"
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || "story_reference_presign_failed");
    }

    return {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || data.url || ""
    };
  }

  async function uploadStoryCharacterReferenceToR2(file, slot) {
    if (!file) throw new Error("missing_story_reference_file");

    const { uploadUrl, publicUrl } = await presignStoryCharacterReference(file, slot);

    if (!uploadUrl || !publicUrl) {
      throw new Error("story_reference_missing_upload_urls");
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!put.ok) {
      throw new Error("story_reference_r2_put_failed");
    }

    return publicUrl;
  }

  function createEmptyStoryCharacterImageState() {
    return {
      file: null,
      fileName: "",
      fileUrl: "",
      uploadPromise: null,
      uploadStatus: "idle",
      uploadError: ""
    };
  }

  function createDefaultScenes() {
    return [
      {
        id: "intro-1",
        section: "intro",
        title: "Sahne 1 · Dünya Açılışı",
        description: "Ortam ve genel atmosfer kurulur.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "intro-2",
        section: "intro",
        title: "Sahne 2 · Ana Karakter Tanıtımı",
        description: "Ana karakter ilk kez görünür.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "intro-3",
        section: "intro",
        title: "Sahne 3 · Hedefin Ortaya Çıkışı",
        description: "Karakterin amacı netleşir.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "setup-1",
        section: "setup",
        title: "Sahne 4 · Yardımcı Unsur Gelir",
        description: "Yardımcı karakter veya unsur hikayeye dahil olur.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "setup-2",
        section: "setup",
        title: "Sahne 5 · Yolculuk Başlar",
        description: "Karakterler harekete geçer.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "setup-3",
        section: "setup",
        title: "Sahne 6 · İlk Engel",
        description: "İlk zorluk ortaya çıkar.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "adventure-1",
        section: "adventure",
        title: "Sahne 7 · Macera Derinleşir",
        description: "Olaylar büyümeye başlar.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "adventure-2",
        section: "adventure",
        title: "Sahne 8 · Deneme ve Çaba",
        description: "Karakterler çözüm için yeni bir yol dener.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "adventure-3",
        section: "adventure",
        title: "Sahne 9 · Gerilim Artar",
        description: "Risk yükselir, baskı artar.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "adventure-4",
        section: "adventure",
        title: "Sahne 10 · Doruk Noktası",
        description: "En kritik karşılaşma yaşanır.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "final-1",
        section: "final",
        title: "Sahne 11 · Çözüm",
        description: "Sorun çözülür.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      },
      {
        id: "final-2",
        section: "final",
        title: "Sahne 12 · Kapanış",
        description: "Hikaye sıcak bir final ile biter.",
        characters: "",
        characterSlots: [],
        selected: false,
        duration: "15",
        mood: "",
        type: "",
        directorNote: ""
      }
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
      extraCharacter: "",
      settingsOpen: false,
      ratio: "16:9",
      style: "",
      audio: "none",
      extraPrompt: "",
      openSection: "intro",
      editingSceneId: "",
      isGenerating: false,
      characterImages: {
        main: createEmptyStoryCharacterImageState(),
        helper1: createEmptyStoryCharacterImageState(),
        helper2: createEmptyStoryCharacterImageState(),
        extra: createEmptyStoryCharacterImageState()
      },
      scenes: createDefaultScenes(),
      characterOptions: []
    });

  function getStoryCharacterImage(slot) {
    const key = String(slot || "").trim();
    return state.characterImages?.[key] || null;
  }

  function setStoryCharacterImage(slot, patch) {
    const key = String(slot || "").trim();
    if (!key) return;

    const prev = getStoryCharacterImage(key) || createEmptyStoryCharacterImageState();

    state.characterImages = {
      ...(state.characterImages || {}),
      [key]: {
        ...prev,
        ...patch
      }
    };
  }

  function getShortFileName(name, max = 28) {
    const text = String(name || "").trim();
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
  }

  function getStoryCharacterLabelBySlot(slot) {
    const key = safeText(slot);
    if (!key) return "";

    if (key === "main") return safeText(state.mainCharacter);
    if (key === "helper1") return safeText(state.helperCharacter1);
    if (key === "helper2") return safeText(state.helperCharacter2);
    if (key === "extra") return safeText(state.extraCharacter);
    return "";
  }

  function getStoryCharacterEntries() {
    return STORY_CHARACTER_SLOT_CONFIG
      .map((config) => {
        const label = getStoryCharacterLabelBySlot(config.slot);
        const image = getStoryCharacterImage(config.slot) || createEmptyStoryCharacterImageState();

        return {
          slot: config.slot,
          label,
          fileName: safeText(image.fileName),
          fileUrl: safeText(image.fileUrl),
          hasImage: !!safeText(image.fileName)
        };
      })
      .filter((item) => !!item.label);
  }

  function resetStoryCharacterImage(root, slot) {
    const key = String(slot || "").trim();
    if (!key) return;

    const input = qs(`[data-story-character-file="${key}"]`, root);
    if (input) input.value = "";

    setStoryCharacterImage(key, createEmptyStoryCharacterImageState());
    updateStoryCharacterUploadUI(root, key);

    const scene = getSceneById(state.editingSceneId);
    if (scene) {
      renderSceneCharacterPicker(root, scene);
      syncSceneRows(root);
    }
  }

  function updateStoryCharacterUploadUI(root, slot) {
    const key = String(slot || "").trim();
    if (!key) return;

    const uploadBtn = qs(`[data-story-upload-trigger="${key}"]`, root);
    const stateBox = qs(`[data-story-upload-state="${key}"]`, root);
    const nameEl = qs(`[data-story-upload-name="${key}"]`, root);
    const imageState = getStoryCharacterImage(key);

    if (!uploadBtn || !stateBox || !nameEl || !imageState) return;

    if (!imageState.file) {
      uploadBtn.hidden = false;
      stateBox.hidden = true;
      nameEl.textContent = "Dosya seçilmedi";
      return;
    }

    uploadBtn.hidden = true;
    stateBox.hidden = false;

    if (imageState.uploadStatus === "uploading") {
      nameEl.textContent = `${getShortFileName(imageState.fileName)} · Yükleniyor...`;
      return;
    }

    if (imageState.uploadStatus === "ready") {
      nameEl.textContent = getShortFileName(imageState.fileName);
      return;
    }

    if (imageState.uploadStatus === "error") {
      nameEl.textContent = `${getShortFileName(imageState.fileName)} · Hata`;
      return;
    }

    nameEl.textContent = getShortFileName(imageState.fileName) || "Dosya seçilmedi";
  }

  function syncAllStoryCharacterUploadUI(root) {
    STORY_CHARACTER_SLOT_CONFIG.forEach((config) => {
      updateStoryCharacterUploadUI(root, config.slot);
    });
  }

  function getSceneById(sceneId) {
    return state.scenes.find((scene) => scene.id === sceneId) || null;
  }

  function updateSceneById(sceneId, patch) {
    state.scenes = state.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...patch } : scene
    );
  }

  function getStoryCharacterSlotMap() {
    return {
      main: safeText(state.mainCharacter),
      helper1: safeText(state.helperCharacter1),
      helper2: safeText(state.helperCharacter2),
      extra: safeText(state.extraCharacter)
    };
  }

  function getAvailableStoryCharacterSlots() {
    const slotMap = getStoryCharacterSlotMap();
    return Object.entries(slotMap)
      .filter(([, value]) => !!value)
      .map(([slot]) => slot);
  }

  function getSceneCharacterLabels(scene) {
    const slotMap = getStoryCharacterSlotMap();
    const slots = Array.isArray(scene?.characterSlots) ? scene.characterSlots : [];
    const labels = slots
      .map((slot) => {
        const label = slotMap[slot];
        const imageState = getStoryCharacterImage(slot);
        const fileName = safeText(imageState?.fileName);
        if (!label) return "";
        return fileName ? `${label} (${getShortFileName(fileName, 26)})` : label;
      })
      .filter(Boolean);

    if (labels.length) return labels;
    return [];
  }

  function ensureSceneCharacterPicker(editor) {
    if (!editor) return null;

    let wrap = qs("[data-scene-character-picker]", editor);
    if (wrap) return wrap;

    const hiddenField =
      qs("[data-scene-editor-characters]", editor)?.closest(".form-field") ||
      qs("[data-scene-editor-characters]", editor)?.parentElement ||
      null;

    if (hiddenField) hiddenField.style.display = "none";

    const descriptionField =
      qs("[data-scene-editor-description]", editor)?.closest(".form-field") ||
      qs("[data-scene-editor-description]", editor)?.parentElement ||
      null;

    if (!descriptionField || !descriptionField.parentElement) return null;

    wrap = document.createElement("div");
    wrap.className = "form-field";
    wrap.setAttribute("data-scene-character-picker", "");
    wrap.style.marginTop = "18px";
    wrap.innerHTML = `
      <label
        style="
          display:block;
          font-weight:800;
          font-size:18px;
          line-height:1.2;
          margin-bottom:12px;
        "
      >
        Sahnedeki Karakterler
      </label>

      <div
        data-scene-character-picker-options
        style="
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:12px;
          align-items:stretch;
        "
      ></div>

      <div
        data-scene-character-picker-empty
        style="
          display:none;
          margin-top:8px;
          opacity:.78;
          font-size:14px;
        "
      >
        Önce üst bölümden karakter seç.
      </div>
    `;

    descriptionField.parentElement.insertBefore(wrap, descriptionField.nextSibling);
    return wrap;
  }

  function createSceneCharacterItem(entry, isSelected) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-scene-character-item", "");
    btn.setAttribute("data-scene-character-slot", entry.slot);
    btn.setAttribute("data-selected", isSelected ? "true" : "false");

    btn.style.cssText = `
      min-height:84px;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:center;
      gap:6px;
      padding:14px 14px;
      border-radius:16px;
      border:1px solid ${isSelected ? "rgba(201,119,255,.55)" : "rgba(255,255,255,.12)"};
      background:${isSelected ? "linear-gradient(135deg, rgba(146,92,255,.22), rgba(255,98,174,.18))" : "rgba(255,255,255,.04)"};
      box-shadow:${isSelected ? "0 0 0 1px rgba(201,119,255,.18) inset, 0 10px 30px rgba(121,65,255,.14)" : "none"};
      cursor:pointer;
      text-align:left;
      transition:all .18s ease;
      width:100%;
    `;

    const fileText = entry.hasImage ? getShortFileName(entry.fileName, 24) : "Görsel yüklenmedi";

    btn.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;line-height:1.2;">
        <span
          style="
            width:12px;
            height:12px;
            border-radius:999px;
            flex:0 0 12px;
            background:${isSelected ? "linear-gradient(135deg,#a565ff,#ff5cb8)" : "rgba(255,255,255,.18)"};
            box-shadow:${isSelected ? "0 0 12px rgba(180,90,255,.45)" : "none"};
          "
        ></span>
        <span>${entry.label}</span>
      </span>
      <span style="font-size:12px;opacity:.82;line-height:1.25;word-break:break-word;">${fileText}</span>
    `;

    return btn;
  }

function renderSceneCharacterPicker(root, scene) {
  const editor = qs("[data-story-scene-editor]", root);
  if (!editor || !scene) return;

  const wrap = ensureSceneCharacterPicker(editor);
  if (!wrap) return;

  const optionsBox = qs("[data-scene-character-picker-options]", wrap);
  const emptyBox = qs("[data-scene-character-picker-empty]", wrap);
  if (!optionsBox || !emptyBox) return;

  const available = getStoryCharacterEntries().slice(0, 4);
  const selected = Array.isArray(scene?.characterSlots)
    ? scene.characterSlots.map((x) => safeText(x)).filter(Boolean)
    : [];

  const slotMap = new Map();
  available.forEach((entry) => {
    slotMap.set(entry.slot, entry);
  });

  const items = qsa("[data-scene-character-item]", optionsBox);

  if (!items.length) {
    optionsBox.style.display = "none";
    emptyBox.style.display = "block";
    return;
  }

  if (!available.length) {
    items.forEach((item) => {
      item.hidden = true;
      item.dataset.selected = "false";
    });
    optionsBox.style.display = "none";
    emptyBox.style.display = "block";
    return;
  }

  optionsBox.style.display = "grid";
  emptyBox.style.display = "none";

  items.forEach((item) => {
    const slot = safeText(item.dataset.sceneCharacterSlot);
    const entry = slotMap.get(slot);

    if (!entry) {
      item.hidden = true;
      item.dataset.selected = "false";
      return;
    }

    const isSelected = selected.includes(slot);
    const labelEl = qs("[data-scene-character-label]", item);
    const fileEl = qs("[data-scene-character-file]", item);

    item.hidden = false;
    item.dataset.selected = isSelected ? "true" : "false";

    if (labelEl) {
      labelEl.textContent = entry.label || "Karakter";
    }

    if (fileEl) {
      fileEl.textContent = entry.hasImage
        ? getShortFileName(entry.fileName, 24)
        : "Görsel yüklenmedi";
    }

    item.style.border = isSelected
      ? "1px solid rgba(201,119,255,.55)"
      : "1px solid rgba(255,255,255,.12)";
    item.style.background = isSelected
      ? "linear-gradient(135deg, rgba(146,92,255,.22), rgba(255,98,174,.18))"
      : "rgba(255,255,255,.04)";
    item.style.boxShadow = isSelected
      ? "0 0 0 1px rgba(201,119,255,.18) inset, 0 10px 30px rgba(121,65,255,.14)"
      : "none";

    const dot = qs(".story-scene-character-dot", item);
    if (dot) {
      dot.style.background = isSelected
        ? "linear-gradient(135deg,#a565ff,#ff5cb8)"
        : "rgba(255,255,255,.18)";
      dot.style.boxShadow = isSelected
        ? "0 0 12px rgba(180,90,255,.45)"
        : "none";
    }
  });
}
  function getSceneCharacterPickerValues(root) {
    const editor = qs("[data-story-scene-editor]", root);
    if (!editor) return [];

    return qsa('[data-scene-character-item][data-selected="true"]', editor)
      .map((el) => safeText(el.dataset.sceneCharacterSlot))
      .filter(Boolean);
  }

  function getSelectedScenes() {
    return state.scenes.filter((scene) => scene && scene.selected === true);
  }

  function getSelectedTotalSeconds() {
    return getSelectedScenes().reduce((sum, scene) => {
      return sum + toSceneDurationNumber(scene?.duration);
    }, 0);
  }

  function buildCharacterOptions(root) {
    const map = new Map();

    qsa('[data-role="main"], [data-role="helper"]', root).forEach((btn) => {
      const value = safeText(btn.dataset.character);
      const label =
        safeText(qs('.cartoon-character-name', btn)?.textContent) ||
        safeText(btn.textContent) ||
        value;

      if (value && label) map.set(value, label);
    });

    qsa('[data-character-library] .cartoon-character-mini-card', root).forEach((btn) => {
      if (btn.disabled) return;
      const value =
        safeText(btn.dataset.character) ||
        safeText(btn.dataset.id) ||
        safeText(btn.getAttribute("value")) ||
        safeText(btn.textContent).toLowerCase().replace(/\s+/g, "-");
      const label = safeText(btn.textContent);
      if (value && label) map.set(value, label);
    });

    state.characterOptions = Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }

  function fillCharacterSelect(selectEl, selectedValue) {
    if (!selectEl) return;

    const current = String(selectedValue || "");
    const options = state.characterOptions || [];

    selectEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Seçiniz";
    selectEl.appendChild(empty);

    options.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = item.label;
      if (item.value === current) opt.selected = true;
      selectEl.appendChild(opt);
    });

    selectEl.value = current;
  }

  function syncCharacterSelects(root) {
    STORY_CHARACTER_SLOT_CONFIG.forEach((config) => {
      const selectedValue = safeText(state[config.stateKey]);
      config.selectSelectors.forEach((selector) => {
        fillCharacterSelect(qs(selector, root), selectedValue);
      });
    });
  }

  function updateStoryIdeaCount(root) {
    const input = qs("[data-story-idea]", root);
    const out = qs("[data-story-idea-count]", root);
    if (!input || !out) return;

    const len = String(input.value || "").length;
    out.textContent = String(len);
  }

  function ensureStoryDurationSummary(root) {
    const wrap = qs("[data-story-duration-summary-wrap]", root);
    if (wrap) return wrap;

    const durationField =
      qs("[data-story-duration]", root)?.closest(".form-field") ||
      qs("[data-story-duration]", root)?.parentElement ||
      null;

    if (!durationField || !durationField.parentElement) return null;

    const box = document.createElement("div");
    box.className = "story-duration-summary";
    box.setAttribute("data-story-duration-summary-wrap", "");

    box.innerHTML = `
      <label style="display:block;font-weight:700;margin-bottom:8px;">Toplam Süre</label>
      <div
        data-story-duration-summary
        style="min-height:64px;display:flex;align-items:center;padding:0 18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(5,6,28,.55);font-weight:700;"
      ></div>
    `;

    durationField.parentElement.appendChild(box);
    durationField.style.display = "none";
    return box;
  }

  function syncStoryDurationSummary(root) {
    const box = ensureStoryDurationSummary(root);
    const out = qs("[data-story-duration-summary]", root);
    if (!box || !out) return;

    const selectedCount = getSelectedScenes().length;
    const totalSeconds = getSelectedTotalSeconds();
    out.textContent =
      selectedCount > 0
        ? `${selectedCount} sahne · ${formatSecondsLabel(totalSeconds)}`
        : "Henüz sahne seçilmedi";
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

  function syncStoryFormValues(root) {
    const storyIdea = qs("[data-story-idea]", root);
    const theme = qs("[data-story-theme]", root);
    const ageGroup = qs("[data-story-age-group]", root);
    const ratio = qs("[data-story-ratio]", root);
    const style = qs("[data-story-style]", root);
    const audio = qs("[data-story-audio]", root);
    const extraPrompt = qs("[data-story-extra-prompt]", root);

    if (storyIdea && storyIdea.value !== state.storyIdea) storyIdea.value = state.storyIdea;
    if (theme && theme.value !== state.theme) theme.value = state.theme;
    if (ageGroup && ageGroup.value !== state.ageGroup) ageGroup.value = state.ageGroup;
    if (ratio && ratio.value !== state.ratio) ratio.value = state.ratio;
    if (style && style.value !== state.style) style.value = state.style;
    if (audio && audio.value !== state.audio) audio.value = state.audio;
    if (extraPrompt && extraPrompt.value !== state.extraPrompt) extraPrompt.value = state.extraPrompt;
  }

  function createSceneRow(scene) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "story-scene-row";
    btn.setAttribute("data-story-scene-id", scene.id);
    btn.setAttribute("data-edit-scene", scene.id);

    const selectedBadge = scene.selected
      ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(170,88,255,.18);font-size:12px;font-weight:700;">Seçili</span>`
      : `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;">Seçili değil</span>`;

    btn.innerHTML = `
      <span class="story-scene-copy">
        <strong data-scene-title></strong>
        <small data-scene-description></small>
        <small data-scene-characters style="opacity:.8;"></small>
      </span>
      <span class="story-scene-meta" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
        ${selectedBadge}
        <span data-scene-duration></span>
      </span>
    `;

    qs("[data-scene-title]", btn).textContent = scene.title || "Sahne";
    qs("[data-scene-description]", btn).textContent = scene.description || "";
    qs("[data-scene-duration]", btn).textContent = `${normalizeStorySceneDuration(scene.duration)} sn`;

    const charEl = qs("[data-scene-characters]", btn);
    const labels = getSceneCharacterLabels(scene);
    charEl.textContent = labels.length ? `Karakterler: ${labels.join(", ")}` : "Karakter seçilmedi";

    return btn;
  }

  function renderSectionScenes(root) {
    qsa("[data-story-section]", root).forEach((sectionEl) => {
      const sectionId = sectionEl.dataset.storySection || "";
      const body = qs("[data-story-section-body]", sectionEl);
      if (!body) return;

      let list = qs(".story-scene-list", body);
      if (!list) {
        list = document.createElement("div");
        list.className = "story-scene-list";
        body.appendChild(list);
      }

      list.innerHTML = "";
      state.scenes
        .filter((scene) => scene.section === sectionId)
        .forEach((scene) => list.appendChild(createSceneRow(scene)));
    });
  }

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

  function syncStorySettings(root) {
    const body = qs("[data-story-settings-body]", root);
    const toggle = qs("[data-story-settings-toggle]", root);
    const icon = qs("[data-story-settings-icon]", root);

    if (body) body.hidden = !state.settingsOpen;
    if (toggle) toggle.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
    if (icon) icon.classList.toggle("is-open", !!state.settingsOpen);
  }

  function syncSceneRows(root) {
    qsa("[data-story-scene-id]", root).forEach((row) => {
      const sceneId = row.dataset.storySceneId || "";
      const scene = getSceneById(sceneId);
      if (!scene) return;

      const titleEl = qs("[data-scene-title]", row);
      const descEl = qs("[data-scene-description]", row);
      const durationEl = qs("[data-scene-duration]", row);
      const charsEl = qs("[data-scene-characters]", row);

      if (titleEl) titleEl.textContent = scene.title || "Sahne";
      if (descEl) descEl.textContent = scene.description || "";
      if (durationEl) durationEl.textContent = `${normalizeStorySceneDuration(scene.duration)} sn`;

      if (charsEl) {
        const labels = getSceneCharacterLabels(scene);
        charsEl.textContent = labels.length ? `Karakterler: ${labels.join(", ")}` : "Karakter seçilmedi";
      }
    });
  }

  function fillSceneEditor(root, sceneId) {
    const editor = qs("[data-story-scene-editor]", root);
    const scene = getSceneById(sceneId);
    if (!editor || !scene) return;

    const heading = qs("[data-scene-editor-heading]", editor);
    const title = qs("[data-scene-editor-title]", editor);
    const description = qs("[data-scene-editor-description]", editor);
    const duration = qs("[data-scene-editor-duration]", editor);
    const mood = qs("[data-scene-editor-mood]", editor);
    const type = qs("[data-scene-editor-type]", editor);
    const note = qs("[data-scene-editor-note]", editor);

    if (heading) heading.textContent = scene.title || "Sahne Düzenle";
    if (title) title.value = scene.title || "";
    if (description) description.value = scene.description || "";

    renderSceneCharacterPicker(root, scene);

    if (duration) duration.value = normalizeStorySceneDuration(scene.duration);
    if (mood) mood.value = scene.mood || "";
    if (type) type.value = scene.type || "";
    if (note) note.value = scene.directorNote || "";
  }

  function syncSceneEditor(root) {
    const editor = qs("[data-story-scene-editor]", root);
    if (!editor) return;

    const isOpen = !!state.editingSceneId;
    editor.hidden = !isOpen;
    editor.classList.toggle("is-open", isOpen);

    if (isOpen) {
      fillSceneEditor(root, state.editingSceneId);

      const scene = getSceneById(state.editingSceneId);
      if (scene) {
        renderSceneCharacterPicker(root, scene);
      }
    }
  }

  function buildStoryPayload() {
    const selectedScenes = getSelectedScenes();
    const totalSeconds = getSelectedTotalSeconds();

    return {
      app: "cartoon",
      mode: "story",
      summary: {
        idea: state.storyIdea,
        theme: state.theme,
        ageGroup: state.ageGroup,
        selectedSceneCount: selectedScenes.length,
        totalSelectedDurationSeconds: totalSeconds
      },
      characters: {
        main: state.mainCharacter,
        helper1: state.helperCharacter1,
        helper2: state.helperCharacter2,
        extra: state.extraCharacter,
        images: {
          main: {
            fileName: state.characterImages?.main?.fileName || "",
            fileUrl: state.characterImages?.main?.fileUrl || ""
          },
          helper1: {
            fileName: state.characterImages?.helper1?.fileName || "",
            fileUrl: state.characterImages?.helper1?.fileUrl || ""
          },
          helper2: {
            fileName: state.characterImages?.helper2?.fileName || "",
            fileUrl: state.characterImages?.helper2?.fileUrl || ""
          },
          extra: {
            fileName: state.characterImages?.extra?.fileName || "",
            fileUrl: state.characterImages?.extra?.fileUrl || ""
          }
        }
      },
      settings: {
        aspectRatio: state.ratio,
        style: state.style,
        audio: state.audio,
        extraPrompt: state.extraPrompt
      },
      scenes: state.scenes.map((scene) => ({ ...scene }))
    };
  }

  function resolveSceneCharacters(scene, storyPayload) {
    const slotValueMap = {
      main: safeText(storyPayload?.characters?.main),
      helper1: safeText(storyPayload?.characters?.helper1),
      helper2: safeText(storyPayload?.characters?.helper2),
      extra: safeText(storyPayload?.characters?.extra)
    };

    let slots = Array.isArray(scene?.characterSlots) ? scene.characterSlots.filter(Boolean) : [];

    slots = slots.filter((slot) => !!slotValueMap[slot]);

    if (!slots.length) {
      if (slotValueMap.main) slots = ["main"];
      else slots = Object.keys(slotValueMap).filter((slot) => !!slotValueMap[slot]).slice(0, 1);
    }

    const mainSlot = slots[0] || "main";
    const sceneMain = slotValueMap[mainSlot] || "";
    const helperCharacters = slots
      .slice(1)
      .map((slot) => slotValueMap[slot])
      .filter(Boolean);

    const allNames = slots.map((slot) => slotValueMap[slot]).filter(Boolean);

    const imageSlot =
      slots.find((slot) => safeText(storyPayload?.characters?.images?.[slot]?.fileUrl)) ||
      mainSlot;

    const characterImageUrl =
      safeText(storyPayload?.characters?.images?.[imageSlot]?.fileUrl) || "";

    return {
      slots,
      sceneMain,
      helperCharacters,
      allNames,
      imageSlot,
      characterImageUrl
    };
  }

  function mapStorySceneToBasicPayload(storyPayload, scene) {
    const resolved = resolveSceneCharacters(scene, storyPayload);

    const promptParts = [
      "Cute kids cartoon style.",
      "Bright colorful animated scene.",
      `Scene title: ${safeText(scene?.title)}.`,
      `Scene description: ${safeText(scene?.description)}.`,
      resolved.allNames.length ? `Characters in this scene: ${resolved.allNames.join(", ")}.` : "",
      scene?.mood ? `Mood: ${safeText(scene.mood)}.` : "",
      scene?.type ? `Shot type: ${safeText(scene.type)}.` : "",
      scene?.directorNote ? `Director note: ${safeText(scene.directorNote)}.` : "",
      storyPayload?.settings?.style ? `Visual style: ${safeText(storyPayload.settings.style)}.` : "",
      "Friendly, adorable, child-safe, expressive animation.",
      "Clean frame, no text, no subtitles, no watermark."
    ].filter(Boolean);

    return {
      app: "cartoon",
      mode: "basic",
      extraPrompt: promptParts.join(" "),
      mainCharacter: resolved.sceneMain,
      helperCharacters: resolved.helperCharacters,
      scene: safeText(scene?.section || "story") || "story",
      actions: [],
      action: "acting naturally in the scene",
      duration: normalizeStorySceneDuration(scene?.duration),
      aspectRatio: String(storyPayload?.settings?.aspectRatio || "16:9"),
      audioSource: "none",
      audioMode: "none",
      audioFileName: "",
      audioFileUrl: "",
      characterImage: null,
      characterImageName: "",
      characterImageUrl: resolved.characterImageUrl,
      estimatedCredits: 0,
      meta: {
        app: "cartoon",
        mode: "story",
        scene_id: String(scene?.id || ""),
        scene_title: String(scene?.title || ""),
        scene_duration: normalizeStorySceneDuration(scene?.duration),
        scene_slots: resolved.slots,
        story_idea: String(storyPayload?.summary?.idea || "")
      }
    };
  }

  async function createStoryScenesFromPayload(storyPayload) {
    const scenes = (Array.isArray(storyPayload?.scenes) ? storyPayload.scenes : []).filter(
      (scene) => scene && scene.selected === true
    );

    if (!scenes.length) {
      throw new Error("Önce en az 1 sahne seçip kaydetmelisin.");
    }

    const created = [];

    for (const scene of scenes) {
      const body = mapStorySceneToBasicPayload(storyPayload, scene);

      console.log("[CARTOON][STORY_SCENE_CREATE_BODY]", {
        scene_id: scene?.id,
        scene_title: scene?.title,
        selected: scene?.selected,
        duration: scene?.duration,
        normalized_duration: body?.duration,
        characterSlots: scene?.characterSlots || [],
        mainCharacter: body?.mainCharacter,
        helperCharacters: body?.helperCharacters
      });

      const r = await fetch("/api/providers/fal/cartoon/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j || j.ok === false) {
        throw new Error(
          `${String(scene?.title || "scene")} -> ${j?.error || `story_scene_create_failed_${r.status}`}`
        );
      }

      const item = {
        scene_id: String(scene?.id || ""),
        scene_title: String(scene?.title || ""),
        job_id: String(j?.job_id || ""),
        request_id: String(j?.request_id || ""),
        status_url: String(j?.status_url || "")
      };

      created.push(item);

      if (!window.__CARTOON_STORY_CREATED_JOBS__) {
        window.__CARTOON_STORY_CREATED_JOBS__ = [];
      }

      window.__CARTOON_STORY_CREATED_JOBS__.push(item);

      window.dispatchEvent(
        new CustomEvent("aivo:cartoon:job_created", {
          detail: {
            app: "cartoon",
            mode: "story",
            sceneId: item.scene_id,
            sceneTitle: item.scene_title,
            job_id: item.job_id,
            request_id: item.request_id,
            status_url: item.status_url,
            createdAt: Date.now(),
            meta: {
              app: "cartoon",
              mode: "story",
              provider: "fal",
              scene_id: item.scene_id,
              scene_title: item.scene_title
            }
          }
        })
      );

      if (item.job_id) {
        pollStorySceneJob(item.job_id, item);
      }
    }

    return created;
  }

  async function pollStorySceneJob(jobId, item, tries = 0) {
    try {
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1`);
      const j = await r.json().catch(() => null);

      console.log("[CARTOON][STORY] poll =", jobId, item?.scene_title, j);

      if (!j || j.ok === false) {
        if (tries < 60) {
          setTimeout(() => pollStorySceneJob(jobId, item, tries + 1), 3000);
        }
        return;
      }

      const normalizedStatus = String(j?.status || j?.db_status || j?.state || "")
        .trim()
        .toLowerCase();

      const readyVideoUrl = String(j?.video?.url || j?.video_url || "").trim();

      const hasReadyOutput =
        Array.isArray(j?.outputs) &&
        j.outputs.some((o) => {
          const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
          const u = String(o?.url || o?.video_url || "").trim();
          return !!u && t === "video";
        });

      if (
        ["ready", "completed", "complete", "succeeded", "done"].includes(normalizedStatus) &&
        (readyVideoUrl || hasReadyOutput)
      ) {
        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:story_scene_ready", {
            detail: {
              app: "cartoon",
              mode: "story",
              sceneId: String(item?.scene_id || ""),
              sceneTitle: String(item?.scene_title || ""),
              job_id: String(jobId || ""),
              status: normalizedStatus,
              video: readyVideoUrl ? { url: readyVideoUrl } : null,
              outputs: j?.outputs || [],
              raw: j
            }
          })
        );
        return;
      }

      if (normalizedStatus === "error" || normalizedStatus === "failed") {
        console.error("[CARTOON][STORY] job error =", jobId, item?.scene_title, j);
        return;
      }

      if (tries < 60) {
        setTimeout(() => pollStorySceneJob(jobId, item, tries + 1), 3000);
      }
    } catch (err) {
      console.error("[CARTOON][STORY] poll error =", jobId, item?.scene_title, err);

      if (tries < 60) {
        setTimeout(() => pollStorySceneJob(jobId, item, tries + 1), 3000);
      }
    }
  }

  function saveSceneEditor(root) {
    if (!state.editingSceneId) return;

    const editor = qs("[data-story-scene-editor]", root);
    if (!editor) return;

    const title = safeText(qs("[data-scene-editor-title]", editor)?.value);
    const description = safeText(qs("[data-scene-editor-description]", editor)?.value);
    const duration = normalizeStorySceneDuration(qs("[data-scene-editor-duration]", editor)?.value || "15");
    const characterSlots = getSceneCharacterPickerValues(root);
    const mood = safeText(qs("[data-scene-editor-mood]", editor)?.value);
    const type = safeText(qs("[data-scene-editor-type]", editor)?.value);
    const note = clampText(qs("[data-scene-editor-note]", editor)?.value, 1000);

    if (!title) return alert("Sahne Başlığı zorunlu.");
    if (!description) return alert("Sahne Açıklaması zorunlu.");

    if (!characterSlots.length) {
      return alert("Bu sahne için en az 1 karakter seçmelisin.");
    }

    updateSceneById(state.editingSceneId, {
      title,
      description,
      characters: "",
      characterSlots,
      selected: true,
      duration,
      mood,
      type,
      directorNote: note
    });

    state.editingSceneId = "";
    render(root);
  }

  function render(root) {
    if (!root) return;

    buildCharacterOptions(root);
    syncModeTabs(root);
    syncModeViews(root);
    syncStoryFormValues(root);
    syncCharacterSelects(root);
    renderSectionScenes(root);
    syncStoryAccordion(root);
    syncStorySettings(root);
    syncSceneRows(root);
    syncSceneEditor(root);
    updateStoryIdeaCount(root);
    syncAllStoryCharacterUploadUI(root);
    syncStoryDurationSummary(root);
  }

  function bindClicks() {
    document.addEventListener("click", async (e) => {
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
        const sceneId = editSceneBtn.dataset.editScene || "";
        if (!sceneId) return;
        state.editingSceneId = sceneId;
        render(root);
        return;
      }

      const sceneCharacterItem = e.target.closest("[data-scene-character-item]");
      if (sceneCharacterItem && root.contains(sceneCharacterItem)) {
        e.preventDefault();

        const slot = safeText(sceneCharacterItem.dataset.sceneCharacterSlot);
        if (!slot) return;

        const isSelected = sceneCharacterItem.dataset.selected === "true";
        sceneCharacterItem.dataset.selected = isSelected ? "false" : "true";

        const dot = qs("span span", sceneCharacterItem);
        if (dot) {
          dot.style.background = isSelected
            ? "rgba(255,255,255,.18)"
            : "linear-gradient(135deg,#a565ff,#ff5cb8)";
          dot.style.boxShadow = isSelected ? "none" : "0 0 12px rgba(180,90,255,.45)";
        }

        sceneCharacterItem.style.border = isSelected
          ? "1px solid rgba(255,255,255,.12)"
          : "1px solid rgba(201,119,255,.55)";
        sceneCharacterItem.style.background = isSelected
          ? "rgba(255,255,255,.04)"
          : "linear-gradient(135deg, rgba(146,92,255,.22), rgba(255,98,174,.18))";
        sceneCharacterItem.style.boxShadow = isSelected
          ? "none"
          : "0 0 0 1px rgba(201,119,255,.18) inset, 0 10px 30px rgba(121,65,255,.14)";

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

      const uploadTrigger = e.target.closest("[data-story-upload-trigger]");
      if (uploadTrigger && root.contains(uploadTrigger)) {
        e.preventDefault();
        const slot = safeText(uploadTrigger.dataset.storyUploadTrigger);
        if (!slot) return;

        const input = qs(`[data-story-character-file="${slot}"]`, root);
        if (input) input.click();
        return;
      }

      const uploadRemove = e.target.closest("[data-story-upload-remove]");
      if (uploadRemove && root.contains(uploadRemove)) {
        e.preventDefault();
        const slot = safeText(uploadRemove.dataset.storyUploadRemove);
        if (!slot) return;

        resetStoryCharacterImage(root, slot);
        return;
      }

      const generateBtn = e.target.closest("[data-story-generate]");
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();
        if (state.mode !== "story") return;
        if (state.isGenerating) return;

        const selectedScenes = getSelectedScenes();
        const totalSeconds = getSelectedTotalSeconds();

        if (!selectedScenes.length) {
          alert("Önce en az 1 sahneyi düzenleyip kaydet. Kaydettiğin sahneler seçili sayılır.");
          return;
        }

        const slots = STORY_CHARACTER_SLOT_CONFIG.map((config) => config.slot);

        for (const slot of slots) {
          const imageState = getStoryCharacterImage(slot);
          if (!imageState || !imageState.file) continue;

          if (imageState.uploadStatus === "uploading" && imageState.uploadPromise) {
            try {
              await imageState.uploadPromise;
            } catch {
              return;
            }
          }

          if (!imageState.fileUrl || imageState.uploadStatus !== "ready") {
            alert("Karakter görsellerinden biri henüz yüklenmedi. Lütfen yükleme tamamlanınca tekrar deneyin.");
            return;
          }
        }

        const summaryText = `${selectedScenes.length} sahne üretilecek.\nToplam süre: ${formatSecondsLabel(totalSeconds)}.\nDevam edilsin mi?`;
        if (!window.confirm(summaryText)) {
          return;
        }

        const payload = buildStoryPayload();
        window.__LAST_CARTOON_STORY_PAYLOAD__ = payload;
        console.log("[CARTOON][STORY_PAYLOAD_READY]", payload);

        state.isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.textContent = "Üretiliyor...";
        generateBtn.classList.add("is-loading");

        try {
          const created = await createStoryScenesFromPayload(payload);

          window.__LAST_CARTOON_STORY_CREATED__ = created;
          console.log("[CARTOON][STORY_CREATE_OK]", created);

          window.dispatchEvent(
            new CustomEvent("aivo:cartoon:story_payload_ready", {
              detail: {
                payload,
                created
              }
            })
          );
        } catch (err) {
          console.error("[CARTOON][STORY_CREATE_ERROR]", err);
          alert(String(err?.message || err || "story_scene_create_failed"));
        } finally {
          state.isGenerating = false;
          generateBtn.disabled = false;
          generateBtn.textContent = "Hikayeyi Oluştur";
          generateBtn.classList.remove("is-loading");
          render(root);
        }
      }
    });

    window.addEventListener("aivo:cartoon:story_scene_ready", (e) => {
      const d = e?.detail || {};
      console.log("[CARTOON][STORY_SCENE_READY]", d);
    });
  }

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
      }
    });
  }

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
        render(root);
        return;
      }

      const mainCharacter = e.target.closest("[data-story-main-character]");
      if (mainCharacter && root.contains(mainCharacter)) {
        state.mainCharacter = mainCharacter.value || "";
        render(root);
        return;
      }

      const helper1 = e.target.closest("[data-story-helper-1]");
      if (helper1 && root.contains(helper1)) {
        state.helperCharacter1 = helper1.value || "";
        render(root);
        return;
      }

      const helper2 = e.target.closest("[data-story-helper-2]");
      if (helper2 && root.contains(helper2)) {
        state.helperCharacter2 = helper2.value || "";
        render(root);
        return;
      }

      const helper3 = e.target.closest("[data-story-helper-3], [data-story-extra-character]");
      if (helper3 && root.contains(helper3)) {
        state.extraCharacter = helper3.value || "";
        render(root);
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

      const characterFileInput = e.target.closest("[data-story-character-file]");
      if (characterFileInput && root.contains(characterFileInput)) {
        const slot = safeText(characterFileInput.dataset.storyCharacterFile);
        if (!slot) return;

        const file =
          characterFileInput.files && characterFileInput.files[0]
            ? characterFileInput.files[0]
            : null;

        setStoryCharacterImage(slot, {
          file,
          fileName: file ? file.name : "",
          fileUrl: "",
          uploadPromise: null,
          uploadStatus: file ? "uploading" : "idle",
          uploadError: ""
        });

        updateStoryCharacterUploadUI(root, slot);

        const scene = getSceneById(state.editingSceneId);
        if (scene) {
          renderSceneCharacterPicker(root, scene);
          syncSceneRows(root);
        }

        if (!file) return;

        const uploadPromise = uploadStoryCharacterReferenceToR2(file, slot)
          .then((publicUrl) => {
            setStoryCharacterImage(slot, {
              fileUrl: safeText(publicUrl),
              uploadStatus: "ready",
              uploadError: "",
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            if (nextRoot) {
              updateStoryCharacterUploadUI(nextRoot, slot);

              const nextScene = getSceneById(state.editingSceneId);
              if (nextScene) {
                renderSceneCharacterPicker(nextRoot, nextScene);
                syncSceneRows(nextRoot);
              }
            }

            console.log("[CARTOON][STORY_UPLOAD_OK]", slot, publicUrl);
            return publicUrl;
          })
          .catch((err) => {
            setStoryCharacterImage(slot, {
              fileUrl: "",
              uploadStatus: "error",
              uploadError: String(err?.message || err || "story_reference_upload_failed"),
              uploadPromise: null
            });

            const nextRoot = getCartoonRoot();
            if (nextRoot) {
              updateStoryCharacterUploadUI(nextRoot, slot);

              const nextScene = getSceneById(state.editingSceneId);
              if (nextScene) {
                renderSceneCharacterPicker(nextRoot, nextScene);
                syncSceneRows(nextRoot);
              }
            }

            console.error("[CARTOON][STORY_UPLOAD_ERROR]", slot, err);
            alert(String(err?.message || err || "story_reference_upload_failed"));
            throw err;
          });

        setStoryCharacterImage(slot, { uploadPromise });
        return;
      }
    });
  }

  function initFromDOM(root) {
    if (!root) return;

    const selectedMode = qs("[data-cartoon-mode].is-active", root);
    if (selectedMode?.dataset.cartoonMode) state.mode = selectedMode.dataset.cartoonMode;

    state.storyIdea = clampText(qs("[data-story-idea]", root)?.value, 5000);
    state.theme = qs("[data-story-theme]", root)?.value || "";
    state.ageGroup = qs("[data-story-age-group]", root)?.value || "";
    state.duration = qs("[data-story-duration]", root)?.value || "180";
    state.mainCharacter = qs("[data-story-main-character]", root)?.value || "";
    state.helperCharacter1 = qs("[data-story-helper-1]", root)?.value || "";
    state.helperCharacter2 = qs("[data-story-helper-2]", root)?.value || "";
    state.extraCharacter =
      qs("[data-story-helper-3]", root)?.value ||
      qs("[data-story-extra-character]", root)?.value ||
      "";
    state.ratio = qs("[data-story-ratio]", root)?.value || "16:9";
    state.style = qs("[data-story-style]", root)?.value || "";
    state.audio = qs("[data-story-audio]", root)?.value || "none";
    state.extraPrompt = clampText(qs("[data-story-extra-prompt]", root)?.value, 5000);

    const openSectionEl = qs("[data-story-section].is-open", root) || qs("[data-story-section]", root);
    if (openSectionEl?.dataset.storySection) {
      state.openSection = openSectionEl.dataset.storySection;
    }

    const settingsBody = qs("[data-story-settings-body]", root);
    state.settingsOpen = settingsBody ? !settingsBody.hidden : false;

    render(root);
  }

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
      subtree: true
    });
  }
})();
