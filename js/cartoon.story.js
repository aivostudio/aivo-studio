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

  function ensureStoryUploadInput(root) {
    let input = qs('[data-story-reference-upload]', root);
    if (input) return input;

    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    input.setAttribute('data-story-reference-upload', '');

    const host = qs('.story-inline-actions', root) || root;
    host.appendChild(input);
    return input;
  }

  function createDefaultScenes() {
    return [
      { id: 'intro-1', section: 'intro', title: 'Sahne 1 · Dünya Açılışı', description: 'Ortam ve genel atmosfer kurulur.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'intro-2', section: 'intro', title: 'Sahne 2 · Ana Karakter Tanıtımı', description: 'Ana karakter ilk kez görünür.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'intro-3', section: 'intro', title: 'Sahne 3 · Hedefin Ortaya Çıkışı', description: 'Karakterin amacı netleşir.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },

      { id: 'setup-1', section: 'setup', title: 'Sahne 4 · Yardımcı Unsur Gelir', description: 'Yardımcı karakter veya unsur hikayeye dahil olur.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'setup-2', section: 'setup', title: 'Sahne 5 · Yolculuk Başlar', description: 'Karakterler harekete geçer.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'setup-3', section: 'setup', title: 'Sahne 6 · İlk Engel', description: 'İlk zorluk ortaya çıkar.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },

      { id: 'adventure-1', section: 'adventure', title: 'Sahne 7 · Macera Derinleşir', description: 'Olaylar büyümeye başlar.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'adventure-2', section: 'adventure', title: 'Sahne 8 · Deneme ve Çaba', description: 'Karakterler çözüm için yeni bir yol dener.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'adventure-3', section: 'adventure', title: 'Sahne 9 · Gerilim Artar', description: 'Risk yükselir, baskı artar.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'adventure-4', section: 'adventure', title: 'Sahne 10 · Doruk Noktası', description: 'En kritik karşılaşma yaşanır.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },

      { id: 'final-1', section: 'final', title: 'Sahne 11 · Çözüm', description: 'Sorun çözülür.', characters: '', duration: '15', mood: '', type: '', directorNote: '' },
      { id: 'final-2', section: 'final', title: 'Sahne 12 · Kapanış', description: 'Hikaye sıcak bir final ile biter.', characters: '', duration: '15', mood: '', type: '', directorNote: '' }
    ];
  }

  const state = (window.__CARTOON_STORY_STATE__ =
    window.__CARTOON_STORY_STATE__ || {
      mode: 'story',
      storyIdea: '',
      theme: '',
      ageGroup: '',
      duration: '180',
      mainCharacter: '',
      helperCharacter1: '',
      helperCharacter2: '',
      settingsOpen: false,
      ratio: '16:9',
      style: '',
      audio: 'none',
      extraPrompt: '',
      openSection: 'intro',
      editingSceneId: '',
      isGenerating: false,
      referenceImageFile: null,
      referenceImageName: '',
      scenes: createDefaultScenes(),
      characterOptions: []
    });

  function getSceneById(sceneId) {
    return state.scenes.find((scene) => scene.id === sceneId) || null;
  }

  function updateSceneById(sceneId, patch) {
    state.scenes = state.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...patch } : scene
    );
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
        safeText(btn.getAttribute('value')) ||
        safeText(btn.textContent).toLowerCase().replace(/\s+/g, '-');
      const label = safeText(btn.textContent);
      if (value && label) map.set(value, label);
    });

    state.characterOptions = Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }

  function fillCharacterSelect(selectEl, selectedValue) {
    if (!selectEl) return;

    const current = String(selectedValue || '');
    const options = state.characterOptions || [];

    selectEl.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Seçiniz';
    selectEl.appendChild(empty);

    options.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      if (item.value === current) opt.selected = true;
      selectEl.appendChild(opt);
    });

    selectEl.value = current;
  }

  function syncCharacterSelects(root) {
    fillCharacterSelect(qs('[data-story-main-character]', root), state.mainCharacter);
    fillCharacterSelect(qs('[data-story-helper-1]', root), state.helperCharacter1);
    fillCharacterSelect(qs('[data-story-helper-2]', root), state.helperCharacter2);
  }

  function updateStoryIdeaCount(root) {
    const input = qs('[data-story-idea]', root);
    const out = qs('[data-story-idea-count]', root);
    if (!input || !out) return;

    const len = String(input.value || '').length;
    out.textContent = String(len);
  }

  function syncModeTabs(root) {
    qsa('[data-cartoon-mode]', root).forEach((btn) => {
      const on = btn.dataset.cartoonMode === state.mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function syncModeViews(root) {
    qsa('.cartoon-mode-view[data-cartoon-view]', root).forEach((el) => {
      const view = el.dataset.cartoonView || '';
      const on = view === state.mode;
      el.hidden = !on;
      el.classList.toggle('is-active', on);
    });
  }

  function syncStoryFormValues(root) {
    const storyIdea = qs('[data-story-idea]', root);
    const theme = qs('[data-story-theme]', root);
    const ageGroup = qs('[data-story-age-group]', root);
    const duration = qs('[data-story-duration]', root);
    const ratio = qs('[data-story-ratio]', root);
    const style = qs('[data-story-style]', root);
    const audio = qs('[data-story-audio]', root);
    const extraPrompt = qs('[data-story-extra-prompt]', root);

    if (storyIdea && storyIdea.value !== state.storyIdea) storyIdea.value = state.storyIdea;
    if (theme && theme.value !== state.theme) theme.value = state.theme;
    if (ageGroup && ageGroup.value !== state.ageGroup) ageGroup.value = state.ageGroup;
    if (duration && duration.value !== state.duration) duration.value = state.duration;
    if (ratio && ratio.value !== state.ratio) ratio.value = state.ratio;
    if (style && style.value !== state.style) style.value = state.style;
    if (audio && audio.value !== state.audio) audio.value = state.audio;
    if (extraPrompt && extraPrompt.value !== state.extraPrompt) extraPrompt.value = state.extraPrompt;
  }

  function createSceneRow(scene) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'story-scene-row';
    btn.setAttribute('data-story-scene-id', scene.id);
    btn.setAttribute('data-edit-scene', scene.id);

    btn.innerHTML = `
      <span class="story-scene-copy">
        <strong data-scene-title></strong>
        <small data-scene-description></small>
      </span>
      <span class="story-scene-meta" data-scene-duration></span>
    `;

    qs('[data-scene-title]', btn).textContent = scene.title || 'Sahne';
    qs('[data-scene-description]', btn).textContent = scene.description || '';
    qs('[data-scene-duration]', btn).textContent = `${scene.duration || '15'} sn`;

    return btn;
  }

  function renderSectionScenes(root) {
    qsa('[data-story-section]', root).forEach((sectionEl) => {
      const sectionId = sectionEl.dataset.storySection || '';
      const body = qs('[data-story-section-body]', sectionEl);
      if (!body) return;

      let list = qs('.story-scene-list', body);
      if (!list) {
        list = document.createElement('div');
        list.className = 'story-scene-list';
        body.appendChild(list);
      }

      list.innerHTML = '';
      state.scenes
        .filter((scene) => scene.section === sectionId)
        .forEach((scene) => list.appendChild(createSceneRow(scene)));
    });
  }

  function syncStoryAccordion(root) {
    qsa('[data-story-section]', root).forEach((sectionEl) => {
      const sectionId = sectionEl.dataset.storySection || '';
      const isOpen = sectionId === state.openSection;

      sectionEl.classList.toggle('is-open', isOpen);

      const body = qs('[data-story-section-body]', sectionEl);
      if (body) body.hidden = !isOpen;

      const toggle = qs('[data-story-section-toggle]', sectionEl);
      if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  function syncStorySettings(root) {
    const body = qs('[data-story-settings-body]', root);
    const toggle = qs('[data-story-settings-toggle]', root);
    const icon = qs('[data-story-settings-icon]', root);

    if (body) body.hidden = !state.settingsOpen;
    if (toggle) toggle.setAttribute('aria-expanded', state.settingsOpen ? 'true' : 'false');
    if (icon) icon.classList.toggle('is-open', !!state.settingsOpen);
  }

  function syncSceneRows(root) {
    qsa('[data-story-scene-id]', root).forEach((row) => {
      const sceneId = row.dataset.storySceneId || '';
      const scene = getSceneById(sceneId);
      if (!scene) return;

      const titleEl = qs('[data-scene-title]', row);
      const descEl = qs('[data-scene-description]', row);
      const durationEl = qs('[data-scene-duration]', row);

      if (titleEl) titleEl.textContent = scene.title || 'Sahne';
      if (descEl) descEl.textContent = scene.description || '';
      if (durationEl) durationEl.textContent = `${scene.duration || '15'} sn`;
    });
  }

  function fillSceneEditor(root, sceneId) {
    const editor = qs('[data-story-scene-editor]', root);
    const scene = getSceneById(sceneId);
    if (!editor || !scene) return;

    const heading = qs('[data-scene-editor-heading]', editor);
    const title = qs('[data-scene-editor-title]', editor);
    const description = qs('[data-scene-editor-description]', editor);
    const characters = qs('[data-scene-editor-characters]', editor);
    const duration = qs('[data-scene-editor-duration]', editor);
    const mood = qs('[data-scene-editor-mood]', editor);
    const type = qs('[data-scene-editor-type]', editor);
    const note = qs('[data-scene-editor-note]', editor);

    if (heading) heading.textContent = scene.title || 'Sahne Düzenle';
    if (title) title.value = scene.title || '';
    if (description) description.value = scene.description || '';
    if (characters) characters.value = scene.characters || '';
    if (duration) duration.value = scene.duration || '15';
    if (mood) mood.value = scene.mood || '';
    if (type) type.value = scene.type || '';
    if (note) note.value = scene.directorNote || '';
  }

  function syncSceneEditor(root) {
    const editor = qs('[data-story-scene-editor]', root);
    if (!editor) return;

    const isOpen = !!state.editingSceneId;
    editor.hidden = !isOpen;
    editor.classList.toggle('is-open', isOpen);

    if (isOpen) {
      fillSceneEditor(root, state.editingSceneId);
    }
  }

  function buildStoryPayload() {
    return {
      app: 'cartoon',
      mode: 'story',
      summary: {
        idea: state.storyIdea,
        theme: state.theme,
        ageGroup: state.ageGroup,
        maxDurationSeconds: Number(state.duration || 180)
      },
      characters: {
        main: state.mainCharacter,
        helper1: state.helperCharacter1,
        helper2: state.helperCharacter2,
        referenceImageName: state.referenceImageName || ''
      },
      settings: {
        aspectRatio: state.ratio,
        style: state.style,
        audio: state.audio,
        extraPrompt: state.extraPrompt
      },
      scenes: [...state.scenes]
    };
  }

  function saveSceneEditor(root) {
    if (!state.editingSceneId) return;

    const editor = qs('[data-story-scene-editor]', root);
    if (!editor) return;

    const title = safeText(qs('[data-scene-editor-title]', editor)?.value);
    const description = safeText(qs('[data-scene-editor-description]', editor)?.value);
    const characters = safeText(qs('[data-scene-editor-characters]', editor)?.value);
    const duration = safeText(qs('[data-scene-editor-duration]', editor)?.value) || '15';
    const mood = safeText(qs('[data-scene-editor-mood]', editor)?.value);
    const type = safeText(qs('[data-scene-editor-type]', editor)?.value);
    const note = clampText(qs('[data-scene-editor-note]', editor)?.value, 1000);

    if (!title) return alert('Sahne Başlığı zorunlu.');
    if (!description) return alert('Sahne Açıklaması zorunlu.');
    if (!characters) return alert('Sahnedeki Karakterler zorunlu.');

    updateSceneById(state.editingSceneId, {
      title,
      description,
      characters,
      duration,
      mood,
      type,
      directorNote: note
    });

    state.editingSceneId = '';
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
  }

  function bindClicks() {
    document.addEventListener('click', (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const modeBtn = e.target.closest('[data-cartoon-mode]');
      if (modeBtn && root.contains(modeBtn)) {
        e.preventDefault();
        state.mode = modeBtn.dataset.cartoonMode || 'story';
        render(root);
        return;
      }

      const sectionToggle = e.target.closest('[data-story-section-toggle]');
      if (sectionToggle && root.contains(sectionToggle)) {
        e.preventDefault();
        const sectionEl = sectionToggle.closest('[data-story-section]');
        const sectionId = sectionEl?.dataset.storySection || '';
        if (!sectionId) return;
        state.openSection = state.openSection === sectionId ? '' : sectionId;
        render(root);
        return;
      }

      const settingsToggle = e.target.closest('[data-story-settings-toggle]');
      if (settingsToggle && root.contains(settingsToggle)) {
        e.preventDefault();
        state.settingsOpen = !state.settingsOpen;
        render(root);
        return;
      }

      const editSceneBtn = e.target.closest('[data-edit-scene]');
      if (editSceneBtn && root.contains(editSceneBtn)) {
        e.preventDefault();
        const sceneId = editSceneBtn.dataset.editScene || '';
        if (!sceneId) return;
        state.editingSceneId = sceneId;
        render(root);
        return;
      }

      const cancelBtn = e.target.closest('[data-scene-cancel]');
      if (cancelBtn && root.contains(cancelBtn)) {
        e.preventDefault();
        state.editingSceneId = '';
        render(root);
        return;
      }

      const saveBtn = e.target.closest('[data-scene-save]');
      if (saveBtn && root.contains(saveBtn)) {
        e.preventDefault();
        saveSceneEditor(root);
        return;
      }

      const pickBtn = e.target.closest('[data-story-pick-character]');
      if (pickBtn && root.contains(pickBtn)) {
        e.preventDefault();
        const mainSelect = qs('[data-story-main-character]', root);
        if (mainSelect) mainSelect.focus();
        return;
      }

      const uploadBtn = e.target.closest('[data-story-upload-character]');
      if (uploadBtn && root.contains(uploadBtn)) {
        e.preventDefault();
        ensureStoryUploadInput(root).click();
        return;
      }

      const generateBtn = e.target.closest('[data-story-generate]');
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();
        if (state.mode !== 'story') return;
        if (state.isGenerating) return;

        const payload = buildStoryPayload();
        window.__LAST_CARTOON_STORY_PAYLOAD__ = payload;
        console.log('[CARTOON][STORY_PAYLOAD_READY]', payload);
        window.dispatchEvent(
          new CustomEvent('aivo:cartoon:story_payload_ready', { detail: payload })
        );
      }
    });
  }

  function bindInputs() {
    document.addEventListener('input', (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const storyIdea = e.target.closest('[data-story-idea]');
      if (storyIdea && root.contains(storyIdea)) {
        state.storyIdea = clampText(storyIdea.value, 5000);
        updateStoryIdeaCount(root);
        return;
      }

      const extraPrompt = e.target.closest('[data-story-extra-prompt]');
      if (extraPrompt && root.contains(extraPrompt)) {
        state.extraPrompt = clampText(extraPrompt.value, 5000);
      }
    });
  }

  function bindChanges() {
    document.addEventListener('change', (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const theme = e.target.closest('[data-story-theme]');
      if (theme && root.contains(theme)) {
        state.theme = theme.value || '';
        return;
      }

      const ageGroup = e.target.closest('[data-story-age-group]');
      if (ageGroup && root.contains(ageGroup)) {
        state.ageGroup = ageGroup.value || '';
        return;
      }

      const duration = e.target.closest('[data-story-duration]');
      if (duration && root.contains(duration)) {
        state.duration = duration.value || '180';
        return;
      }

      const mainCharacter = e.target.closest('[data-story-main-character]');
      if (mainCharacter && root.contains(mainCharacter)) {
        state.mainCharacter = mainCharacter.value || '';
        return;
      }

      const helper1 = e.target.closest('[data-story-helper-1]');
      if (helper1 && root.contains(helper1)) {
        state.helperCharacter1 = helper1.value || '';
        return;
      }

      const helper2 = e.target.closest('[data-story-helper-2]');
      if (helper2 && root.contains(helper2)) {
        state.helperCharacter2 = helper2.value || '';
        return;
      }

      const ratio = e.target.closest('[data-story-ratio]');
      if (ratio && root.contains(ratio)) {
        state.ratio = ratio.value || '16:9';
        return;
      }

      const style = e.target.closest('[data-story-style]');
      if (style && root.contains(style)) {
        state.style = style.value || '';
        return;
      }

      const audio = e.target.closest('[data-story-audio]');
      if (audio && root.contains(audio)) {
        state.audio = audio.value || 'none';
        return;
      }

      const upload = e.target.closest('[data-story-reference-upload]');
      if (upload && root.contains(upload)) {
        const file = upload.files && upload.files[0] ? upload.files[0] : null;
        state.referenceImageFile = file;
        state.referenceImageName = file ? file.name : '';

        const uploadBtn = qs('[data-story-upload-character]', root);
        if (uploadBtn) {
          uploadBtn.textContent = state.referenceImageName || 'Referans Görsel Ekle';
        }
      }
    });
  }

  function initFromDOM(root) {
    if (!root) return;

    ensureStoryUploadInput(root);

    const selectedMode = qs('[data-cartoon-mode].is-active', root);
    if (selectedMode?.dataset.cartoonMode) state.mode = selectedMode.dataset.cartoonMode;

    state.storyIdea = clampText(qs('[data-story-idea]', root)?.value, 5000);
    state.theme = qs('[data-story-theme]', root)?.value || '';
    state.ageGroup = qs('[data-story-age-group]', root)?.value || '';
    state.duration = qs('[data-story-duration]', root)?.value || '180';
    state.mainCharacter = qs('[data-story-main-character]', root)?.value || '';
    state.helperCharacter1 = qs('[data-story-helper-1]', root)?.value || '';
    state.helperCharacter2 = qs('[data-story-helper-2]', root)?.value || '';
    state.ratio = qs('[data-story-ratio]', root)?.value || '16:9';
    state.style = qs('[data-story-style]', root)?.value || '';
    state.audio = qs('[data-story-audio]', root)?.value || 'none';
    state.extraPrompt = clampText(qs('[data-story-extra-prompt]', root)?.value, 5000);

    const openSectionEl = qs('[data-story-section].is-open', root) || qs('[data-story-section]', root);
    if (openSectionEl?.dataset.storySection) {
      state.openSection = openSectionEl.dataset.storySection;
    }

    const settingsBody = qs('[data-story-settings-body]', root);
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
