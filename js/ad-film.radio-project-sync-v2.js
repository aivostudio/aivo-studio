/* =========================================================
   AIVO — AI RADYO REKLAMI / PROJECT SYNC V2
   - Immediate local draft persistence
   - Authenticated cloud project persistence
   - Project-owned R2 music uploads
   - Full project + R2 deletion through DELETE /api/radio-ad/project
   - Draft status and reset controls placed beside the final build action
   ========================================================= */
(function AIVO_RADIO_AD_PROJECT_SYNC_V2(){
  "use strict";
  if (window.__AIVO_RADIO_AD_PROJECT_SYNC_V2__) return;
  window.__AIVO_RADIO_AD_PROJECT_SYNC_V2__ = true;

  var ROOT_SELECTOR = '[data-module-root][data-module="adfilm"]';
  var PANEL_SELECTOR = '[data-adfilm-radio-panel]';
  var PROJECT_STORAGE_KEY = 'aivo_radioad_active_project_id_v1';
  var LOCAL_DRAFT_KEY = 'aivo_radioad_local_draft_v2';
  var LEGACY_LOCAL_DRAFT_KEY = 'aivo_radioad_local_draft_v1';
  var LAST_KIND_KEY = 'aivo_adfilm_last_kind_v1';
  var MAX_AUDIO_BYTES = 20 * 1024 * 1024;
  var controllers = new WeakMap();

  var COPY = {
    tr: {
      connecting: 'Radyo taslağı bağlanıyor',
      connected: 'Taslak buluta bağlı',
      creating: 'Yeni radyo taslağı oluşturuluyor...',
      saving: 'Buluta kaydediliyor',
      saved: 'Taslak kaydedildi',
      uploading: 'Müzik R2’ye yükleniyor',
      uploaded: 'Müzik R2’ye kaydedildi.',
      resetting: 'Radyo taslağı ve tüm dosyaları siliniyor...',
      resetDone: 'Yeni boş radyo taslağı açıldı.',
      authRequired: 'Devam etmek için AIVO hesabına giriş yapmalısın.',
      networkError: 'İnternet bağlantısı kurulamadı. Yerel radyo taslağın korunuyor.',
      saveFailed: 'Bulut kaydı tamamlanamadı. Yerel radyo taslağın korunuyor.',
      uploadFailed: 'Müzik dosyası R2’ye yüklenemedi.',
      deleteFailed: 'Taslak silinemedi. Proje ve dosyalar korunuyor.',
      confirmDelete: 'Bu radyo taslağı; seslendirme, müzik ve final dosyalarıyla birlikte R2’den kalıcı olarak silinecek. Devam edilsin mi?',
      resetButton: 'Taslağı sıfırla'
    },
    en: {
      connecting: 'Connecting radio draft',
      connected: 'Draft connected to cloud',
      creating: 'Creating a new radio draft...',
      saving: 'Saving to cloud',
      saved: 'Draft saved',
      uploading: 'Uploading music to R2',
      uploaded: 'Music saved to R2.',
      resetting: 'Deleting the radio draft and all files...',
      resetDone: 'A new empty radio draft is ready.',
      authRequired: 'Sign in to your AIVO account to continue.',
      networkError: 'Could not connect. Your local radio draft is preserved.',
      saveFailed: 'Cloud save failed. Your local radio draft is preserved.',
      uploadFailed: 'The music file could not be uploaded to R2.',
      deleteFailed: 'The draft could not be deleted. The project and files are preserved.',
      confirmDelete: 'This radio draft, narration, music and final files will be permanently deleted from R2. Continue?',
      resetButton: 'Reset draft'
    }
  };

  function lang(){
    var html = String(document.documentElement.lang || '').toLowerCase();
    var stored = '';
    try { stored = String(localStorage.getItem('aivo_language') || localStorage.getItem('aivo_lang') || '').toLowerCase(); } catch (_) {}
    return stored === 'en' || html.indexOf('en') === 0 ? 'en' : 'tr';
  }

  function t(key){ return COPY[lang()][key] || COPY.tr[key] || key; }
  function clean(value){ return String(value == null ? '' : value).trim(); }
  function q(root, selector){ return root && root.querySelector(selector); }
  function qa(root, selector){ return root ? Array.from(root.querySelectorAll(selector)) : []; }
  function nowIso(){ return new Date().toISOString(); }

  function notify(message, type){
    try {
      var fn = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof fn === 'function') return fn(message, type || 'info');
      var nativeToast = window.toast && window.toast[type || 'info'];
      if (typeof nativeToast === 'function') return nativeToast({ message: message, duration: type === 'error' ? 4600 : 2800 });
    } catch (_) {}
    return null;
  }

  function dismiss(handle){
    try { if (handle && typeof handle.dismiss === 'function') handle.dismiss(); } catch (_) {}
  }

  function readStorage(key, fallback){
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }

  function writeStorage(key, value){
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function parseDraft(raw){
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function readLocalDraft(){
    return parseDraft(readStorage(LOCAL_DRAFT_KEY, '')) || parseDraft(readStorage(LEGACY_LOCAL_DRAFT_KEY, ''));
  }

  function writeLocalDraft(project){
    try {
      var next = Object.assign({}, project || {}, { _clientSavedAt: nowIso() });
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  function clearLocalDraft(){
    try {
      localStorage.removeItem(LOCAL_DRAFT_KEY);
      localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY);
    } catch (_) {}
  }

  async function request(path, options){
    var response;
    try {
      response = await fetch(path, Object.assign({
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      }, options || {}));
    } catch (error) {
      error.status = 0;
      throw error;
    }
    var data = await response.json().catch(function(){ return { ok: false, error: 'invalid_json' }; });
    if (!response.ok) {
      var failure = new Error(data.message || data.error || ('HTTP ' + response.status));
      failure.status = response.status;
      failure.data = data;
      throw failure;
    }
    return data;
  }

  var api = {
    createProject: function(project){
      return request('/api/radio-ad/project', { method: 'POST', body: JSON.stringify({ project: project }) });
    },
    getProject: function(id){
      return request('/api/radio-ad/project?id=' + encodeURIComponent(id), { method: 'GET' });
    },
    updateProject: function(id, project){
      return request('/api/radio-ad/project?id=' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ project: project }) });
    },
    deleteProject: function(id){
      return request('/api/radio-ad/project?id=' + encodeURIComponent(id), { method: 'DELETE' });
    },
    uploadMusic: async function(projectId, file){
      var signed = await request('/api/radio-ad/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          projectId: projectId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          kind: 'music-track'
        })
      });
      var upload = await fetch(signed.upload_url, {
        method: 'PUT',
        headers: signed.required_headers || { 'Content-Type': file.type },
        body: file
      });
      if (!upload.ok) {
        var error = new Error('r2_upload_failed_' + upload.status);
        error.status = upload.status;
        throw error;
      }
      return {
        key: signed.key,
        url: signed.public_url || signed.read_url,
        name: file.name,
        contentType: file.type,
        size: file.size,
        uploadedAt: nowIso()
      };
    }
  };
  window.AIVORadioAdProjects = api;

  function selected(panel, name, fallback){
    var button = q(panel, '[data-radio-choice="' + name + '"] .is-active[data-value]');
    return button ? button.getAttribute('data-value') : fallback;
  }

  function selectValue(panel, selector, fallback){
    var node = q(panel, selector);
    return node ? clean(node.value) || fallback : fallback;
  }

  function decorateInputs(panel){
    var firstSelects = qa(panel, '.adfilm-radio-card:first-of-type .adfilm-radio-fields select');
    if (firstSelects[0]) firstSelects[0].setAttribute('data-radio-language', '');
    if (firstSelects[1]) {
      firstSelects[1].setAttribute('data-radio-voice-style', '');
      ['warm', 'energetic', 'premium', 'natural'].forEach(function(value, index){
        if (firstSelects[1].options[index]) firstSelects[1].options[index].value = value;
      });
    }
    if (firstSelects[2]) {
      firstSelects[2].setAttribute('data-radio-voice', '');
      ['warm_female', 'professional_male', 'energetic_male', 'clear_female'].forEach(function(value, index){
        if (firstSelects[2].options[index]) firstSelects[2].options[index].value = value;
      });
    }

    var musicSelects = qa(panel, '[data-radio-music-panel="ai"] select');
    if (musicSelects[0]) {
      musicSelects[0].setAttribute('data-radio-music-style', '');
      ['auto', 'cinematic', 'corporate', 'electronic', 'acoustic'].forEach(function(value, index){
        if (musicSelects[0].options[index]) musicSelects[0].options[index].value = value;
      });
    }
    if (musicSelects[1]) {
      musicSelects[1].setAttribute('data-radio-music-energy', '');
      ['balanced', 'soft', 'strong', 'high'].forEach(function(value, index){
        if (musicSelects[1].options[index]) musicSelects[1].options[index].value = value;
      });
    }
  }

  function ensureStyles(){
    if (document.getElementById('aivo-radio-project-sync-v2-style')) return;
    var style = document.createElement('style');
    style.id = 'aivo-radio-project-sync-v2-style';
    style.textContent = [
      '.adfilm-radio-buildbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:14px!important;align-items:center!important}',
      '.adfilm-radio-buildbar>div:first-child{min-width:0}',
      '.adfilm-radio-buildbar>[data-radio-build]{grid-column:1/-1;width:100%}',
      '.radio-draftbar{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0}',
      '.radio-draftbar__status{display:flex;align-items:center;gap:8px;min-height:38px;padding:0 12px;border:1px solid rgba(111,85,171,.38);border-radius:999px;background:rgba(20,22,47,.8);white-space:nowrap}',
      '.radio-draftbar__status>i{width:9px;height:9px;border-radius:50%;background:#8e82a8;box-shadow:0 0 12px rgba(142,130,168,.35)}',
      '.radio-draftbar__status strong{color:#d8d2e5;font-size:11px}',
      '.radio-draftbar__status small{color:#827b91;font-size:9px}',
      '.radio-draftbar__status.is-saved>i{background:#42ddb3;box-shadow:0 0 14px rgba(66,221,179,.72)}',
      '.radio-draftbar__status.is-saving>i,.radio-draftbar__status.is-uploading>i,.radio-draftbar__status.is-connecting>i{background:#d28cff;animation:radioDraftPulseV2 1s infinite}',
      '.radio-draftbar__status.is-error>i{background:#ff6f9d}',
      '.radio-draftbar>button{min-height:38px;padding:0 13px;border:1px solid rgba(230,62,112,.42);border-radius:12px;background:rgba(87,18,43,.28);color:#ff9cba;font:inherit;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}',
      '.radio-draftbar>button:disabled{cursor:wait;opacity:.55}',
      '@keyframes radioDraftPulseV2{50%{opacity:.35;transform:scale(.82)}}',
      '@media(max-width:760px){.adfilm-radio-buildbar{grid-template-columns:1fr!important}.radio-draftbar{justify-content:stretch;flex-wrap:wrap}.radio-draftbar__status{flex:1}.radio-draftbar>button{flex:1}.adfilm-radio-buildbar>[data-radio-build]{grid-column:1}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureDraftControls(panel){
    var existing = q(panel, '[data-radio-draftbar]');
    if (existing) existing.remove();
    var buildbar = q(panel, '.adfilm-radio-buildbar');
    if (!buildbar) return null;

    var bar = document.createElement('div');
    bar.className = 'radio-draftbar';
    bar.setAttribute('data-radio-draftbar', '');
    bar.innerHTML = '<div class="radio-draftbar__status is-connecting"><i></i><strong data-radio-draft-status>' + t('connecting') + '</strong><small data-radio-draft-time></small></div><button type="button" data-radio-draft-reset aria-label="' + t('resetButton') + '">⌫ ' + t('resetButton') + '</button>';

    var buildButton = q(buildbar, '[data-radio-build]');
    buildbar.insertBefore(bar, buildButton || null);
    return bar;
  }

  function currentUpload(controller){
    return controller.project && controller.project.music && controller.project.music.upload || null;
  }

  function collect(controller){
    var panel = controller.panel;
    return {
      title: 'Radyo Reklamı',
      narration: {
        text: clean(q(panel, '[data-radio-copy]') && q(panel, '[data-radio-copy]').value),
        language: selectValue(panel, '[data-radio-language]', 'tr'),
        voice: selectValue(panel, '[data-radio-voice]', 'warm_female'),
        voiceStyle: selectValue(panel, '[data-radio-voice-style]', 'warm'),
        speed: selected(panel, 'speed', 'fast'),
        flow: selected(panel, 'flow', 'natural')
      },
      music: {
        mode: selected(panel, 'music', 'ai'),
        style: selectValue(panel, '[data-radio-music-style]', 'auto'),
        energy: selectValue(panel, '[data-radio-music-energy]', 'balanced'),
        upload: currentUpload(controller)
      },
      output: {
        duration: Number(selected(panel, 'duration', '10')),
        format: selected(panel, 'outputFormat', 'mp3')
      }
    };
  }

  function mergeLocalProject(controller){
    var form = collect(controller);
    var current = controller.project || {};
    return Object.assign({}, current, form, {
      id: controller.projectId || current.id || null,
      narration: Object.assign({}, current.narration || {}, form.narration),
      music: Object.assign({}, current.music || {}, form.music),
      output: Object.assign({}, current.output || {}, form.output)
    });
  }

  function setStatus(controller, mode, message){
    var host = q(controller.panel, '.radio-draftbar__status');
    if (!host) return;
    host.className = 'radio-draftbar__status is-' + mode;
    var label = q(host, '[data-radio-draft-status]');
    var time = q(host, '[data-radio-draft-time]');
    if (label) label.textContent = message || mode;
    if (time) {
      time.textContent = mode === 'saved'
        ? new Date().toLocaleTimeString(lang() === 'en' ? 'en-US' : 'tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
    }
  }

  function activateChoice(panel, name, value){
    var button = q(panel, '[data-radio-choice="' + name + '"] button[data-value="' + String(value) + '"]');
    if (!button) return;
    qa(button.parentElement, 'button[data-value]').forEach(function(item){
      item.classList.toggle('is-active', item === button);
    });
    if (name === 'music') {
      qa(panel, '[data-radio-music-panel]').forEach(function(item){
        item.hidden = item.getAttribute('data-radio-music-panel') !== String(value);
      });
    }
  }

  function setSelect(panel, selector, value){
    var node = q(panel, selector);
    if (!node) return;
    node.value = value == null ? '' : String(value);
  }

  function showRemoteUpload(controller, upload){
    var panel = controller.panel;
    var picker = q(panel, '.radio-upload-picker');
    var card = q(panel, '[data-radio-music-file-card]');
    var audio = q(panel, '[data-radio-music-audio]');
    if (!picker || !card || !audio) return;

    if (!upload || !upload.url) {
      picker.hidden = false;
      card.hidden = true;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    picker.hidden = true;
    card.hidden = false;
    var name = q(panel, '[data-radio-music-name]');
    var size = q(panel, '[data-radio-music-size]');
    if (name) name.textContent = upload.name || 'Yüklenen müzik';
    if (size) size.textContent = Math.max(0.1, Number(upload.size || 0) / 1024 / 1024).toFixed(1) + ' MB · R2';
    audio.src = upload.url;
    audio.load();
  }

  function dispatchProject(controller, project){
    controller.root.dataset.radioAdProjectId = controller.projectId || '';
    window.AIVORadioAdActiveProject = project;
    document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync', {
      detail: { project: project, projectId: controller.projectId }
    }));
  }

  function applyProject(controller, project){
    if (!project) return;
    controller.project = project;
    controller.projectId = project.id || controller.projectId;
    controller.applying = true;
    try {
      var panel = controller.panel;
      var narration = project.narration || {};
      var music = project.music || {};
      var output = project.output || {};
      var copy = q(panel, '[data-radio-copy]');
      if (copy) {
        copy.value = narration.text || '';
        copy.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setSelect(panel, '[data-radio-language]', narration.language || 'tr');
      setSelect(panel, '[data-radio-voice-style]', narration.voiceStyle || 'warm');
      setSelect(panel, '[data-radio-voice]', narration.voice || 'warm_female');
      activateChoice(panel, 'speed', narration.speed || 'fast');
      activateChoice(panel, 'flow', narration.flow || 'natural');
      activateChoice(panel, 'duration', String(output.duration || 10));
      activateChoice(panel, 'outputFormat', output.format || 'mp3');
      activateChoice(panel, 'music', music.mode || 'ai');
      setSelect(panel, '[data-radio-music-style]', music.style || 'auto');
      setSelect(panel, '[data-radio-music-energy]', music.energy || 'balanced');
      showRemoteUpload(controller, music.upload || null);
      dispatchProject(controller, project);
    } finally {
      controller.applying = false;
    }
    writeLocalDraft(project);
  }

  function localIsNewer(localProject, cloudProject){
    var localTime = Date.parse(localProject && localProject._clientSavedAt || '');
    var cloudTime = Date.parse(cloudProject && cloudProject.updatedAt || '');
    return Number.isFinite(localTime) && (!Number.isFinite(cloudTime) || localTime > cloudTime + 250);
  }

  function persistLocalImmediately(controller){
    if (controller.applying || controller.resetting) return;
    var localProject = mergeLocalProject(controller);
    controller.project = localProject;
    writeLocalDraft(localProject);
  }

  function queueSave(controller, delay){
    if (controller.applying || controller.resetting || controller.uploading) return;
    persistLocalImmediately(controller);
    clearTimeout(controller.saveTimer);
    controller.saveTimer = setTimeout(function(){ save(controller); }, delay == null ? 550 : delay);
  }

  async function save(controller){
    if (controller.applying || controller.resetting || controller.uploading || !controller.projectId) return;
    var payload = collect(controller);
    setStatus(controller, 'saving', t('saving'));
    controller.saveChain = controller.saveChain.catch(function(){}).then(async function(){
      try {
        var saved = (await api.updateProject(controller.projectId, payload)).project;
        controller.project = saved;
        writeLocalDraft(saved);
        dispatchProject(controller, saved);
        setStatus(controller, 'saved', t('saved'));
      } catch (error) {
        console.error('[RADIOAD V2] save', error);
        setStatus(controller, 'error', error.status === 401 ? t('authRequired') : error.status === 0 ? t('networkError') : t('saveFailed'));
      }
    });
    return controller.saveChain;
  }

  async function uploadMusic(controller, file){
    if (!file || controller.uploading || controller.resetting) return;
    if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) return;
    controller.uploading = true;
    setStatus(controller, 'uploading', t('uploading'));
    var handle = notify(t('uploading'), 'info');
    try {
      var uploaded = await api.uploadMusic(controller.projectId, file);
      controller.project = Object.assign({}, controller.project || {}, {
        music: Object.assign({}, controller.project && controller.project.music || {}, collect(controller).music, {
          mode: 'upload',
          upload: uploaded
        })
      });
      showRemoteUpload(controller, uploaded);
      controller.uploading = false;
      persistLocalImmediately(controller);
      await save(controller);
      dismiss(handle);
      notify(t('uploaded'), 'success');
    } catch (error) {
      controller.uploading = false;
      dismiss(handle);
      console.error('[RADIOAD V2] music upload', error);
      setStatus(controller, 'error', t('uploadFailed'));
      notify(t('uploadFailed'), 'error');
    }
  }

  function blankProject(){
    return {
      title: 'Radyo Reklamı',
      narration: {
        text: '',
        language: 'tr',
        voice: 'warm_female',
        voiceStyle: 'warm',
        speed: 'fast',
        flow: 'natural'
      },
      music: {
        mode: 'ai',
        style: 'auto',
        energy: 'balanced',
        upload: null
      },
      output: {
        duration: 10,
        format: 'mp3'
      }
    };
  }

  async function resetProject(controller){
    if (controller.resetting || !controller.projectId) return;
    if (!window.confirm(t('confirmDelete'))) return;
    controller.resetting = true;
    clearTimeout(controller.saveTimer);
    var resetButton = q(controller.panel, '[data-radio-draft-reset]');
    if (resetButton) resetButton.disabled = true;
    setStatus(controller, 'connecting', t('resetting'));
    var handle = notify(t('resetting'), 'info');

    try {
      await controller.saveChain.catch(function(){});
      await api.deleteProject(controller.projectId);
      writeStorage(PROJECT_STORAGE_KEY, null);
      clearLocalDraft();
      var created = (await api.createProject(blankProject())).project;
      controller.projectId = created.id;
      controller.project = created;
      writeStorage(PROJECT_STORAGE_KEY, created.id);
      applyProject(controller, created);
      setStatus(controller, 'saved', t('saved'));
      dismiss(handle);
      notify(t('resetDone'), 'success');
    } catch (error) {
      dismiss(handle);
      console.error('[RADIOAD V2] reset', error);
      setStatus(controller, 'error', t('deleteFailed'));
      notify(t('deleteFailed'), 'error');
    } finally {
      controller.resetting = false;
      if (resetButton) resetButton.disabled = false;
    }
  }

  async function bootstrap(controller){
    setStatus(controller, 'connecting', t('connecting'));
    var localDraft = readLocalDraft();
    if (localDraft) applyProject(controller, localDraft);

    var projectId = clean(readStorage(PROJECT_STORAGE_KEY, ''));
    var cloudProject = null;

    if (projectId) {
      try {
        cloudProject = (await api.getProject(projectId)).project;
      } catch (error) {
        if (error.status === 404) {
          writeStorage(PROJECT_STORAGE_KEY, null);
          projectId = '';
        } else if (error.status === 401) {
          setStatus(controller, 'error', t('authRequired'));
          return;
        } else {
          setStatus(controller, 'error', t('networkError'));
          return;
        }
      }
    }

    if (!cloudProject) {
      setStatus(controller, 'connecting', t('creating'));
      try {
        cloudProject = (await api.createProject(localDraft || collect(controller))).project;
        projectId = cloudProject.id;
        writeStorage(PROJECT_STORAGE_KEY, projectId);
      } catch (error) {
        console.error('[RADIOAD V2] create project', error);
        setStatus(controller, 'error', error.status === 401 ? t('authRequired') : t('networkError'));
        return;
      }
    }

    controller.projectId = projectId || cloudProject.id;
    if (localDraft && localIsNewer(localDraft, cloudProject)) {
      try {
        cloudProject = (await api.updateProject(controller.projectId, {
          title: localDraft.title || 'Radyo Reklamı',
          narration: localDraft.narration || {},
          music: localDraft.music || {},
          output: localDraft.output || {}
        })).project;
      } catch (error) {
        console.error('[RADIOAD V2] reconcile local draft', error);
      }
    }

    applyProject(controller, cloudProject);
    setStatus(controller, 'saved', t('saved'));
  }

  function bind(controller){
    var panel = controller.panel;

    panel.addEventListener('input', function(event){
      if (!event.target.closest('[data-radio-copy]')) return;
      queueSave(controller, 450);
    });

    panel.addEventListener('change', function(event){
      if (event.target.matches('[data-radio-music-file]')) {
        var file = event.target.files && event.target.files[0];
        if (file) uploadMusic(controller, file);
        return;
      }
      if (event.target.matches('select')) queueSave(controller, 250);
    });

    panel.addEventListener('click', function(event){
      var resetButton = event.target.closest('[data-radio-draft-reset]');
      if (resetButton) {
        event.preventDefault();
        event.stopPropagation();
        resetProject(controller);
        return;
      }

      var choice = event.target.closest('[data-radio-choice] button[data-value]');
      if (choice) setTimeout(function(){ queueSave(controller, 180); }, 0);

      var removeMusic = event.target.closest('[data-radio-music-remove]');
      if (removeMusic) {
        setTimeout(function(){
          if (controller.project && controller.project.music) controller.project.music.upload = null;
          queueSave(controller, 120);
        }, 0);
      }
    }, true);

    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') persistLocalImmediately(controller);
    });
    window.addEventListener('pagehide', function(){ persistLocalImmediately(controller); });
  }

  function preserveLastKind(root){
    root.addEventListener('click', function(event){
      var button = event.target.closest('[data-adfilm-kind]');
      if (!button) return;
      writeStorage(LAST_KIND_KEY, button.getAttribute('data-adfilm-kind'));
    }, true);

    if (readStorage(LAST_KIND_KEY, '') === 'radio') {
      var radioButton = q(root, '[data-adfilm-kind="radio"]');
      if (radioButton) setTimeout(function(){ radioButton.click(); }, 0);
    }
  }

  function mount(root){
    if (!root) return;
    var panel = q(root, PANEL_SELECTOR);
    if (!panel || controllers.has(panel)) return;

    ensureStyles();
    decorateInputs(panel);
    ensureDraftControls(panel);

    var controller = {
      root: root,
      panel: panel,
      project: null,
      projectId: '',
      applying: false,
      resetting: false,
      uploading: false,
      saveTimer: null,
      saveChain: Promise.resolve()
    };
    controllers.set(panel, controller);
    bind(controller);
    preserveLastKind(root);
    bootstrap(controller);
  }

  function mountAll(){
    qa(document, ROOT_SELECTOR).forEach(mount);
  }

  document.addEventListener('aivo:module-mounted', function(event){
    if (event && event.detail && event.detail.key === 'adfilm') {
      setTimeout(function(){ mount(event.detail.root || q(document, ROOT_SELECTOR)); }, 0);
    }
  });

  document.addEventListener('aivo:adfilm-assets-ready', function(){ setTimeout(mountAll, 0); });

  var observer = new MutationObserver(function(){ mountAll(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll, { once: true });
  } else {
    mountAll();
  }
})();
