(() => {
  function formatSceneDuration(seconds) {
    const value = Number(seconds) || 0;
    return `${value} sn`;
  }

  function formatSummaryDuration(totalSeconds) {
    const value = Number(totalSeconds) || 0;

    if (value < 60) {
      return `${value} sn`;
    }

    const minutes = Math.floor(value / 60);
    const seconds = value % 60;

    if (!seconds) {
      return `${minutes} dk`;
    }

    return `${minutes} dk ${seconds} sn`;
  }

 function createStudioState() {
  return {
    format: '16:9',
    scenes: [],
    previewUrl: '',
    previewTitle: '',

    voiceFile: null,
    voiceFileName: '',
    voiceFileUrl: '',
    voiceFileUploadPromise: null,
    voiceFileUploadStatus: 'idle',
    voiceFileUploadError: '',

    logoFile: null,
    logoFileName: '',
    logoFileUrl: '',
    logoFileUploadPromise: null,
    logoFileUploadStatus: 'idle',
    logoFileUploadError: ''
  };
}

  const STUDIO_STORAGE_KEY = 'aivo_cartoon_studio_scenes_v1';
  const STUDIO_FORMAT_STORAGE_KEY = 'aivo_cartoon_studio_format_v1';

  function saveStudioState(rootState) {
    try {
      const safeScenes = Array.isArray(rootState?.scenes)
        ? rootState.scenes.map((scene) => ({
            id: String(scene?.id || ''),
            title: String(scene?.title || 'Sahne'),
            duration: Number(scene?.duration) || 0,
            included: !!scene?.included,
            videoUrl: String(scene?.videoUrl || ''),
            fileName: String(scene?.fileName || '')
          }))
        : [];

      localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(safeScenes));
      localStorage.setItem(
        STUDIO_FORMAT_STORAGE_KEY,
        String(rootState?.format || '16:9')
      );
    } catch (err) {
      console.warn('[CARTOON][STUDIO_SAVE_STATE_ERROR]', err);
    }
  }

  function loadStudioState() {
    try {
      const rawScenes = localStorage.getItem(STUDIO_STORAGE_KEY);
      const rawFormat = localStorage.getItem(STUDIO_FORMAT_STORAGE_KEY);

      const parsedScenes = rawScenes ? JSON.parse(rawScenes) : [];
      const scenes = Array.isArray(parsedScenes)
        ? parsedScenes.map((scene, index) => ({
            id: String(scene?.id || `saved-${Date.now()}-${index + 1}`),
            title: String(scene?.title || 'Sahne'),
            duration: Number(scene?.duration) || 0,
            included: !!scene?.included,
            videoUrl: String(scene?.videoUrl || ''),
            fileName: String(scene?.fileName || '')
          }))
        : [];

      return {
        format: String(rawFormat || '16:9'),
        scenes
      };
    } catch (err) {
      console.warn('[CARTOON][STUDIO_LOAD_STATE_ERROR]', err);
      return {
        format: '16:9',
        scenes: []
      };
    }
  }

  function ensureStudioPreviewModal(studioRoot) {
    let modal = document.querySelector('[data-studio-preview-modal]');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.setAttribute('data-studio-preview-modal', '');
    modal.hidden = true;
    modal.innerHTML = `
      <div data-studio-preview-backdrop
           style="
             position:fixed;
             inset:0;
             background:rgba(0,0,0,.78);
             z-index:999999;
             display:flex;
             align-items:center;
             justify-content:center;
             padding:24px;
           ">
        <div data-studio-preview-dialog
             style="
               position:relative;
               width:min(1100px, 92vw);
               max-height:90vh;
               border-radius:22px;
               overflow:hidden;
               background:#05060f;
               border:1px solid rgba(255,255,255,.12);
               box-shadow:0 30px 80px rgba(0,0,0,.55);
             ">
          <button type="button"
                  data-studio-preview-close
                  aria-label="Önizlemeyi kapat"
                  title="Kapat"
                  style="
                    position:absolute;
                    top:14px;
                    right:14px;
                    width:42px;
                    height:42px;
                    border:none;
                    border-radius:999px;
                    background:rgba(255,255,255,.14);
                    color:#fff;
                    font-size:24px;
                    line-height:1;
                    cursor:pointer;
                    z-index:2;
                  ">×</button>

          <div style="padding:18px 18px 10px 18px;">
            <div data-studio-preview-title
                 style="
                   color:#fff;
                   font-weight:800;
                   font-size:18px;
                   line-height:1.3;
                   padding-right:56px;
                 "></div>
          </div>

          <div style="padding:0 18px 18px 18px;">
            <video data-studio-preview-video
                   controls
                   playsinline
                   preload="metadata"
                   style="
                     width:100%;
                     max-height:72vh;
                     display:block;
                     background:#000;
                     border-radius:16px;
                   "></video>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const backdrop = modal.querySelector('[data-studio-preview-backdrop]');
    const dialog = modal.querySelector('[data-studio-preview-dialog]');
    const closeBtn = modal.querySelector('[data-studio-preview-close]');
    const video = modal.querySelector('[data-studio-preview-video]');

    function closeStudioPreview() {
      modal.hidden = true;

      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeStudioPreview);
    }

    if (backdrop) {
      backdrop.addEventListener('click', (event) => {
        if (!dialog) return;
        if (!dialog.contains(event.target)) {
          closeStudioPreview();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) {
        closeStudioPreview();
      }
    });

    modal.__openStudioPreview = ({ url, title }) => {
      const titleEl = modal.querySelector('[data-studio-preview-title]');
      const videoEl = modal.querySelector('[data-studio-preview-video]');

      if (!videoEl) return;

      if (titleEl) {
        titleEl.textContent = String(title || 'Video Önizleme');
      }

      modal.hidden = false;
      videoEl.src = String(url || '');
      videoEl.load();
      videoEl.play().catch(() => {});
    };

    modal.__closeStudioPreview = closeStudioPreview;

    return modal;
  }

  function openStudioPreview(studioRoot, scene) {
    if (!scene?.videoUrl) {
      alert(`Bu sahne için henüz video yok: ${scene?.title || 'Sahne'}`);
      return;
    }

    const modal = ensureStudioPreviewModal(studioRoot);
    if (!modal || typeof modal.__openStudioPreview !== 'function') return;

    modal.__openStudioPreview({
      url: scene.videoUrl,
      title: scene.title || 'Video Önizleme'
    });
  }

  function getStudioVideoDuration(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve(15);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');

      const cleanup = () => {
        try { URL.revokeObjectURL(objectUrl); } catch {}
        video.removeAttribute('src');
        video.load();
      };

      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const seconds = Math.max(1, Math.round(Number(video.duration) || 15));
        cleanup();
        resolve(seconds);
      };

      video.onerror = () => {
        cleanup();
        resolve(15);
      };

      video.src = objectUrl;
    });
  }

  function getStudioVideoExtension(fileName) {
    const name = String(fileName || '').toLowerCase().trim();
    const match = name.match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
  }

  function resolveStudioVideoContentType(file) {
    const rawType = String(file?.type || '').toLowerCase().trim();
    const ext = getStudioVideoExtension(file?.name || '');

    const allowedTypes = new Set([
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-matroska',
      'video/mpeg',
      'video/ogg'
    ]);

    if (allowedTypes.has(rawType)) {
      if (rawType === 'video/x-matroska') return 'video/webm';
      return rawType;
    }

    if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
    if (ext === 'webm') return 'video/webm';
    if (ext === 'mov' || ext === 'qt') return 'video/quicktime';
    if (ext === 'mkv') return 'video/webm';
    if (ext === 'mpeg' || ext === 'mpg') return 'video/mpeg';
    if (ext === 'ogv') return 'video/ogg';

    return 'video/mp4';
  }

  async function presignStudioVideo(file) {
    const safeContentType = resolveStudioVideoContentType(file);

    const res = await fetch('/api/r2/presign-put', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'cartoon',
        kind: 'studio-video',
        filename: file?.name || `studio-video-${Date.now()}.mp4`,
        contentType: safeContentType
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || 'studio_video_presign_failed');
    }

    return {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || data.url || '',
      contentType: safeContentType
    };
  }

  async function uploadStudioVideoToR2(file) {
    if (!file) throw new Error('missing_studio_video_file');

    const { uploadUrl, publicUrl, contentType } = await presignStudioVideo(file);

    if (!uploadUrl || !publicUrl) {
      throw new Error('studio_video_missing_upload_urls');
    }

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'video/mp4'
      },
      body: file
    });

    if (!put.ok) {
      throw new Error('studio_video_r2_put_failed');
    }

    return publicUrl;
  }

  function getStudioAudioExtension(fileName) {
    const name = String(fileName || '').toLowerCase().trim();
    const match = name.match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
  }

  function resolveStudioAudioContentType(file) {
    const rawType = String(file?.type || '').toLowerCase().trim();
    const ext = getStudioAudioExtension(file?.name || '');

    const allowedTypes = new Set([
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/aac',
      'audio/mp4',
      'audio/x-m4a',
      'audio/ogg',
      'audio/webm'
    ]);

    if (allowedTypes.has(rawType)) {
      if (rawType === 'audio/mp3') return 'audio/mpeg';
      if (rawType === 'audio/x-wav' || rawType === 'audio/wave') return 'audio/wav';
      if (rawType === 'audio/x-m4a') return 'audio/mp4';
      return rawType;
    }

    if (ext === 'mp3') return 'audio/mpeg';
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'aac') return 'audio/aac';
    if (ext === 'm4a') return 'audio/mp4';
    if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
    if (ext === 'webm') return 'audio/webm';

    return 'audio/mpeg';
  }

  async function presignStudioVoiceFile(file) {
    const safeContentType = resolveStudioAudioContentType(file);

    const res = await fetch('/api/r2/presign-put', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'cartoon',
        kind: 'studio-voice',
        filename: file?.name || `studio-voice-${Date.now()}.mp3`,
        contentType: safeContentType
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || 'studio_voice_presign_failed');
    }

    return {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || data.url || '',
      contentType: safeContentType
    };
  }

  async function uploadStudioVoiceFileToR2(file) {
    if (!file) throw new Error('missing_studio_voice_file');

    const { uploadUrl, publicUrl, contentType } = await presignStudioVoiceFile(file);

    if (!uploadUrl || !publicUrl) {
      throw new Error('studio_voice_missing_upload_urls');
    }

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'audio/mpeg'
      },
      body: file
    });

    if (!put.ok) {
      throw new Error('studio_voice_r2_put_failed');
    }

    return publicUrl;
  }
 function getStudioLogoExtension(fileName) {
  const name = String(fileName || '').toLowerCase().trim();
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

function resolveStudioLogoContentType(file) {
  const rawType = String(file?.type || '').toLowerCase().trim();
  const ext = getStudioLogoExtension(file?.name || '');

  const allowedTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml'
  ]);

  if (allowedTypes.has(rawType)) {
    if (rawType === 'image/jpg') return 'image/jpeg';
    return rawType;
  }

  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';

  return 'image/png';
}

async function presignStudioLogoFile(file) {
  const safeContentType = resolveStudioLogoContentType(file);

  const res = await fetch('/api/r2/presign-put', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app: 'cartoon',
      kind: 'studio-logo',
      filename: file?.name || `studio-logo-${Date.now()}.png`,
      contentType: safeContentType
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data || data.ok === false) {
    throw new Error(data?.error || 'studio_logo_presign_failed');
  }

  return {
    uploadUrl: data.uploadUrl || data.upload_url,
    publicUrl: data.publicUrl || data.public_url || data.url || '',
    contentType: safeContentType
  };
}

async function uploadStudioLogoFileToR2(file) {
  if (!file) throw new Error('missing_studio_logo_file');

  const { uploadUrl, publicUrl, contentType } = await presignStudioLogoFile(file);

  if (!uploadUrl || !publicUrl) {
    throw new Error('studio_logo_missing_upload_urls');
  }

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType || 'image/png'
    },
    body: file
  });

  if (!put.ok) {
    throw new Error('studio_logo_r2_put_failed');
  }

  return publicUrl;
}
  function clearStudioVoiceFile(rootState, studioRoot) {
    const input = qsAny(studioRoot, [
      '#cartoonVoiceFile',
      '#studioVoiceFile',
      '[data-studio-voice-upload]',
      'input[name="voiceFile"]',
      'input[name="kendiSesin"]'
    ]);

    rootState.voiceFile = null;
    rootState.voiceFileName = '';
    rootState.voiceFileUrl = '';
    rootState.voiceFileUploadPromise = null;
    rootState.voiceFileUploadStatus = 'idle';
    rootState.voiceFileUploadError = '';

    if (input) {
      input.value = '';
    }

    updateStudioVoiceUploadStatusUI(rootState, studioRoot);
  }
  function clearStudioLogoFile(rootState, studioRoot) {
  const input = qsAny(studioRoot, [
    '#cartoonLogoFile',
    '#studioLogoFile',
    '[data-studio-logo-upload]',
    'input[name="logoFile"]',
    'input[name="logo"]'
  ]);

  rootState.logoFile = null;
  rootState.logoFileName = '';
  rootState.logoFileUrl = '';
  rootState.logoFileUploadPromise = null;
  rootState.logoFileUploadStatus = 'idle';
  rootState.logoFileUploadError = '';

  if (input) {
    input.value = '';
  }

  updateStudioLogoUploadStatusUI(rootState, studioRoot);
}

function ensureStudioLogoUploadClearButton(rootState, studioRoot) {
  const input = qsAny(studioRoot, [
    '#cartoonLogoFile',
    '#studioLogoFile',
    '[data-studio-logo-upload]',
    'input[name="logoFile"]',
    'input[name="logo"]'
  ]);

  if (!input) return null;

  const row = input.closest('.cartoon-upload-row') || input.parentElement;
  if (!row) return null;

  let clearBtn = row.querySelector('[data-studio-logo-upload-clear]');

  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.setAttribute('data-studio-logo-upload-clear', '');
    clearBtn.setAttribute('aria-label', 'Yüklenen logoyu kaldır');
    clearBtn.title = 'Logoyu kaldır';
    clearBtn.textContent = '×';
    clearBtn.style.marginLeft = '8px';
    clearBtn.style.width = '22px';
    clearBtn.style.height = '22px';
    clearBtn.style.borderRadius = '999px';
    clearBtn.style.border = '1px solid rgba(255,255,255,.18)';
    clearBtn.style.background = 'rgba(255,255,255,.08)';
    clearBtn.style.color = '#fff';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.display = 'none';
    clearBtn.style.verticalAlign = 'middle';
    row.appendChild(clearBtn);
  }

  if (clearBtn.dataset.bound === '1') {
    return clearBtn;
  }

  clearBtn.dataset.bound = '1';
  clearBtn.type = 'button';

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearStudioLogoFile(rootState, studioRoot);
  });

  return clearBtn;
}

function updateStudioLogoUploadStatusUI(rootState, studioRoot) {
  const input = qsAny(studioRoot, [
    '#cartoonLogoFile',
    '#studioLogoFile',
    '[data-studio-logo-upload]',
    'input[name="logoFile"]',
    'input[name="logo"]'
  ]);

  if (!input) return;

  const row = input.closest('.cartoon-upload-row') || input.parentElement;
  if (!row) return;

  const textEl =
    row.querySelector('[data-studio-logo-upload-text]') ||
    row.querySelector('.cartoon-upload-text');

  const clearBtn = ensureStudioLogoUploadClearButton(rootState, studioRoot);

  if (!textEl) return;

  const status = String(rootState?.logoFileUploadStatus || 'idle');
  const fileName = String(rootState?.logoFileName || '').trim();

  if (!fileName) {
    textEl.textContent = 'Dosya seçilmedi';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  if (status === 'uploading') {
    textEl.textContent = `${fileName} · Yükleniyor...`;
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  if (status === 'ready') {
    textEl.textContent = `${fileName} · Hazır ✓`;
    if (clearBtn) {
      clearBtn.style.display = 'inline-grid';
      clearBtn.style.placeItems = 'center';
    }
    return;
  }

  if (status === 'error') {
    textEl.textContent = `${fileName} · Yükleme hatası`;
    if (clearBtn) {
      clearBtn.style.display = 'inline-grid';
      clearBtn.style.placeItems = 'center';
    }
    return;
  }

  textEl.textContent = fileName;
  if (clearBtn) clearBtn.style.display = 'none';
}

function bindStudioLogoUpload(rootState, studioRoot) {
  const input = qsAny(studioRoot, [
    '#cartoonLogoFile',
    '#studioLogoFile',
    '[data-studio-logo-upload]',
    'input[name="logoFile"]',
    'input[name="logo"]'
  ]);

  if (!input) return;
  if (input.getAttribute('data-studio-logo-bound') === 'true') return;

  input.setAttribute('data-studio-logo-bound', 'true');

  input.addEventListener('change', async () => {
    const file = input.files?.[0] || null;

    rootState.logoFile = file;
    rootState.logoFileName = file ? String(file.name || '') : '';
    rootState.logoFileUrl = '';
    rootState.logoFileUploadPromise = null;
    rootState.logoFileUploadError = '';
    rootState.logoFileUploadStatus = file ? 'uploading' : 'idle';
    updateStudioLogoUploadStatusUI(rootState, studioRoot);

    if (!file) return;

    rootState.logoFileUploadPromise = uploadStudioLogoFileToR2(file)
      .then((publicUrl) => {
        rootState.logoFileUrl = String(publicUrl || '').trim();
        rootState.logoFileUploadStatus = 'ready';
        rootState.logoFileUploadError = '';
        updateStudioLogoUploadStatusUI(rootState, studioRoot);
        console.log('[CARTOON][STUDIO_LOGO_UPLOAD_OK]', rootState.logoFileUrl);
        return rootState.logoFileUrl;
      })
      .catch((err) => {
        rootState.logoFileUrl = '';
        rootState.logoFileUploadStatus = 'error';
        rootState.logoFileUploadError = String(err?.message || err || 'studio_logo_upload_failed');
        updateStudioLogoUploadStatusUI(rootState, studioRoot);
        console.error('[CARTOON][STUDIO_LOGO_UPLOAD_ERROR]', err);
        alert(rootState.logoFileUploadError);
        throw err;
      });
  });
}
function ensureStudioVoiceUploadClearButton(rootState, studioRoot) {
  const input = qsAny(studioRoot, [
    '#cartoonVoiceFile',
    '#studioVoiceFile',
    '[data-studio-voice-upload]',
    'input[name="voiceFile"]',
    'input[name="kendiSesin"]'
  ]);

  if (!input) return null;

  const row = input.closest('.cartoon-upload-row') || input.parentElement;
  if (!row) return null;

  let clearBtn = row.querySelector('[data-studio-voice-upload-clear]');

  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.setAttribute('data-studio-voice-upload-clear', '');
    clearBtn.setAttribute('aria-label', 'Yüklenen sesi kaldır');
    clearBtn.title = 'Sesi kaldır';
    clearBtn.textContent = '×';
    clearBtn.style.marginLeft = '8px';
    clearBtn.style.width = '22px';
    clearBtn.style.height = '22px';
    clearBtn.style.borderRadius = '999px';
    clearBtn.style.border = '1px solid rgba(255,255,255,.18)';
    clearBtn.style.background = 'rgba(255,255,255,.08)';
    clearBtn.style.color = '#fff';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.display = 'none';
    clearBtn.style.verticalAlign = 'middle';
    row.appendChild(clearBtn);
  }

  if (clearBtn.dataset.bound === '1') {
    return clearBtn;
  }

  clearBtn.dataset.bound = '1';
  clearBtn.type = 'button';

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearStudioVoiceFile(rootState, studioRoot);
  });

  return clearBtn;
}
  function updateStudioVoiceUploadStatusUI(rootState, studioRoot) {
    const input = qsAny(studioRoot, [
      '#cartoonVoiceFile',
      '#studioVoiceFile',
      '[data-studio-voice-upload]',
      'input[name="voiceFile"]',
      'input[name="kendiSesin"]'
    ]);

    if (!input) return;

    const row = input.closest('.cartoon-upload-row') || input.parentElement;
    if (!row) return;

    const textEl =
      row.querySelector('[data-studio-voice-upload-text]') ||
      row.querySelector('.cartoon-upload-text');

    const clearBtn = ensureStudioVoiceUploadClearButton(rootState, studioRoot);

    if (!textEl) return;

    const status = String(rootState?.voiceFileUploadStatus || 'idle');
    const fileName = String(rootState?.voiceFileName || '').trim();

    if (!fileName) {
      textEl.textContent = 'Dosya seçilmedi';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    if (status === 'uploading') {
      textEl.textContent = `${fileName} · Yükleniyor...`;
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    if (status === 'ready') {
      textEl.textContent = `${fileName} · Hazır ✓`;
      if (clearBtn) {
        clearBtn.style.display = 'inline-grid';
        clearBtn.style.placeItems = 'center';
      }
      return;
    }

    if (status === 'error') {
      textEl.textContent = `${fileName} · Yükleme hatası`;
      if (clearBtn) {
        clearBtn.style.display = 'inline-grid';
        clearBtn.style.placeItems = 'center';
      }
      return;
    }

    textEl.textContent = fileName;
    if (clearBtn) clearBtn.style.display = 'none';
  }

  function bindStudioVoiceUpload(rootState, studioRoot) {
    const input = qsAny(studioRoot, [
      '#cartoonVoiceFile',
      '#studioVoiceFile',
      '[data-studio-voice-upload]',
      'input[name="voiceFile"]',
      'input[name="kendiSesin"]'
    ]);

    if (!input) return;
    if (input.getAttribute('data-studio-voice-bound') === 'true') return;

    input.setAttribute('data-studio-voice-bound', 'true');

    input.addEventListener('change', async () => {
      const file = input.files?.[0] || null;

      rootState.voiceFile = file;
      rootState.voiceFileName = file ? String(file.name || '') : '';
      rootState.voiceFileUrl = '';
      rootState.voiceFileUploadPromise = null;
      rootState.voiceFileUploadError = '';
      rootState.voiceFileUploadStatus = file ? 'uploading' : 'idle';
      updateStudioVoiceUploadStatusUI(rootState, studioRoot);

      if (!file) return;

      rootState.voiceFileUploadPromise = uploadStudioVoiceFileToR2(file)
        .then((publicUrl) => {
          rootState.voiceFileUrl = String(publicUrl || '').trim();
          rootState.voiceFileUploadStatus = 'ready';
          rootState.voiceFileUploadError = '';
          updateStudioVoiceUploadStatusUI(rootState, studioRoot);
          console.log('[CARTOON][STUDIO_VOICE_UPLOAD_OK]', rootState.voiceFileUrl);
          return rootState.voiceFileUrl;
        })
        .catch((err) => {
          rootState.voiceFileUrl = '';
          rootState.voiceFileUploadStatus = 'error';
          rootState.voiceFileUploadError = String(err?.message || err || 'studio_voice_upload_failed');
          updateStudioVoiceUploadStatusUI(rootState, studioRoot);
          console.error('[CARTOON][STUDIO_VOICE_UPLOAD_ERROR]', err);
          alert(rootState.voiceFileUploadError);
          throw err;
        });
    });
  }

  async function appendUploadedStudioVideos(rootState, studioRoot, sceneList, sceneTemplate, fileList) {
    const files = Array.from(fileList || []).filter((file) => {
      if (!file) return false;

      const type = String(file.type || '').toLowerCase();
      const ext = getStudioVideoExtension(file.name || '');

      if (type.startsWith('video/')) return true;

      return ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'mpeg', 'mpg', 'ogv'].includes(ext);
    });

    if (!files.length) return;

    const nextScenes = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const duration = await getStudioVideoDuration(file);
      const publicUrl = await uploadStudioVideoToR2(file);
      const fileName = String(file.name || `video-${Date.now()}-${i + 1}`).trim();
      const title = fileName.replace(/\.[^.]+$/, '');

      nextScenes.push({
        id: `upload-${Date.now()}-${i + 1}`,
        title,
        duration,
        included: true,
        videoUrl: publicUrl,
        fileName
      });
    }

    rootState.scenes.push(...nextScenes);
    saveStudioState(rootState);
    renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate);
  }

  function bindStudioVideoUpload(rootState, studioRoot, sceneList, sceneTemplate) {
    const input = studioRoot.querySelector('[data-studio-video-upload]');
    const text = studioRoot.querySelector('[data-studio-video-upload-text]');

    if (!input) return;
    if (input.getAttribute('data-studio-upload-bound') === 'true') return;

    input.setAttribute('data-studio-upload-bound', 'true');

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      const count = files.length;

      if (text) {
        text.textContent = count
          ? `${count} video seçildi`
          : 'Henüz video seçilmedi';
      }

      try {
        await appendUploadedStudioVideos(
          rootState,
          studioRoot,
          sceneList,
          sceneTemplate,
          files
        );
      } catch (err) {
        console.error('[CARTOON][STUDIO_UPLOAD_ERROR]', err);
        alert(String(err?.message || err || 'studio_video_upload_failed'));
      } finally {
        input.value = '';
      }
    });
  }

  function bindStudioFormatPills(rootState, studioRoot) {
    const pills = Array.from(studioRoot.querySelectorAll('[data-studio-format]'));
    if (!pills.length) return;
    if (studioRoot.getAttribute('data-studio-format-bound') === 'true') return;

    studioRoot.setAttribute('data-studio-format-bound', 'true');

    function syncActiveFormat() {
      pills.forEach((btn) => {
        const value = String(btn.getAttribute('data-studio-format') || '');
        const isActive = value === String(rootState.format || '16:9');

        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    pills.forEach((btn) => {
      btn.addEventListener('click', () => {
        rootState.format = String(btn.getAttribute('data-studio-format') || '16:9');
        saveStudioState(rootState);
        syncActiveFormat();
        updateStudioSummary(rootState, studioRoot);
      });
    });

    syncActiveFormat();
  }

  function moveScene(array, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= array.length || toIndex >= array.length) return;

    const copied = array.slice();
    const [item] = copied.splice(fromIndex, 1);
    copied.splice(toIndex, 0, item);

    array.length = 0;
    copied.forEach((entry) => array.push(entry));
  }

  function updateStudioSummary(rootState, studioRoot) {
    const summary = studioRoot.querySelector('.studio-inline-summary');
    if (!summary) return;

    const items = summary.querySelectorAll('span');
    if (!items.length || items.length < 3) return;

    const selectedCount = rootState.scenes.filter((scene) => scene.included).length;
    const totalDuration = rootState.scenes
      .filter((scene) => scene.included)
      .reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);

    items[0].textContent = `Seçilen Sahne: ${selectedCount}`;
    items[1].textContent = `Toplam Süre: ${formatSummaryDuration(totalDuration)}`;
    items[2].textContent = `Format: ${rootState.format}`;
  }

  function qsAny(root, selectors) {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function getValue(root, selectors, fallback = '') {
    const el = qsAny(root, selectors);
    if (!el) return fallback;

    if (el.type === 'checkbox') {
      return !!el.checked;
    }

    return String(el.value ?? fallback).trim();
  }

  function getFileMeta(root, selectors) {
    const input = qsAny(root, selectors);
    const file = input?.files?.[0];

    if (!file) {
      return {
        hasFile: false,
        name: '',
        type: '',
        size: 0
      };
    }

    return {
      hasFile: true,
      name: String(file.name || ''),
      type: String(file.type || ''),
      size: Number(file.size || 0)
    };
  }

  function collectCartoonStudioPayload(rootState, studioRoot) {
    const selectedScenes = Array.isArray(rootState?.scenes)
      ? rootState.scenes
          .filter((scene) => !!scene?.included)
          .map((scene, index) => ({
            order: index + 1,
            id: String(scene?.id || ''),
            title: String(scene?.title || 'Sahne'),
            duration: Number(scene?.duration) || 0,
            videoUrl: String(scene?.videoUrl || ''),
            fileName: String(scene?.fileName || '')
          }))
      : [];

    const totalDuration = selectedScenes.reduce((sum, scene) => {
      return sum + (Number(scene.duration) || 0);
    }, 0);

    return {
      export: {
        format: String(rootState?.format || '16:9'),
        sceneCount: selectedScenes.length,
        totalDuration,
        scenes: selectedScenes
      },

      audio: {
        readyMusic: getValue(studioRoot, [
          '#cartoonReadyMusic',
          '#studioReadyMusic',
          '[data-studio-ready-music]',
          'select[name="readyMusic"]',
          'select[name="hazirMuzik"]'
        ], ''),

        voiceFile: {
          hasFile: !!rootState?.voiceFile,
          name: String(rootState?.voiceFileName || ''),
          type: String(rootState?.voiceFile?.type || ''),
          size: Number(rootState?.voiceFile?.size || 0),
          url: String(rootState?.voiceFileUrl || ''),
          uploadStatus: String(rootState?.voiceFileUploadStatus || 'idle')
        },

        mode: getValue(studioRoot, [
          '#cartoonAudioMode',
          '#studioAudioMode',
          '[data-studio-audio-mode]',
          'select[name="audioMode"]',
          'select[name="ses"]'
        ], ''),

        musicLevel: getValue(studioRoot, [
          '#cartoonMusicLevel',
          '#studioMusicLevel',
          '[data-studio-music-level]',
          'input[name="musicLevel"]',
          'input[name="muzikSeviyesi"]'
        ], '')
      },

      text: {
        title: getValue(studioRoot, [
          '#cartoonVideoTitle',
          '#studioVideoTitle',
          '[data-studio-video-title]',
          'input[name="videoTitle"]',
          'input[name="baslik"]'
        ], ''),

        subtitleMode: getValue(studioRoot, [
          '#cartoonSubtitleMode',
          '#studioSubtitleMode',
          '[data-studio-subtitle-mode]',
          'select[name="subtitleMode"]',
          'select[name="altyazi"]'
        ], ''),

        description: getValue(studioRoot, [
          '#cartoonDescription',
          '#studioDescription',
          '[data-studio-description]',
          'textarea[name="description"]',
          'textarea[name="kisaAciklama"]'
        ], '')
      },

    branding: {
  logoFile: {
    hasFile: !!rootState?.logoFile,
    name: String(rootState?.logoFileName || ''),
    type: String(rootState?.logoFile?.type || ''),
    size: Number(rootState?.logoFile?.size || 0),
    url: String(rootState?.logoFileUrl || ''),
    uploadStatus: String(rootState?.logoFileUploadStatus || 'idle')
  },

  watermarkMode: getValue(studioRoot, [
    '#cartoonWatermarkMode',
    '#studioWatermarkMode',
    '[data-studio-watermark-mode]',
    'select[name="watermarkMode"]',
    'select[name="filigran"]'
  ], '')
},

      cover: {
        videoFrame: getValue(studioRoot, [
          '#cartoonCoverFrame',
          '#studioCoverFrame',
          '[data-studio-cover-frame]',
          'select[name="coverFrame"]',
          'select[name="videodanKare"]'
        ], ''),

        customCoverFile: getFileMeta(studioRoot, [
          '#cartoonCoverFile',
          '#studioCoverFile',
          '[data-studio-cover-upload]',
          'input[name="coverFile"]',
          'input[name="ayriKapak"]'
        ])
      },

      summary: {
        sceneCount: selectedScenes.length,
        totalDuration,
        format: String(rootState?.format || '16:9'),
        hasLogo: !!getFileMeta(studioRoot, [
          '#cartoonLogoFile',
          '#studioLogoFile',
          '[data-studio-logo-upload]',
          'input[name="logoFile"]',
          'input[name="logo"]'
        ]).hasFile,
        hasVoiceFile: !!getFileMeta(studioRoot, [
          '#cartoonVoiceFile',
          '#studioVoiceFile',
          '[data-studio-voice-upload]',
          'input[name="voiceFile"]',
          'input[name="kendiSesin"]'
        ]).hasFile,
        hasCustomCover: !!getFileMeta(studioRoot, [
          '#cartoonCoverFile',
          '#studioCoverFile',
          '[data-studio-cover-upload]',
          'input[name="coverFile"]',
          'input[name="ayriKapak"]'
        ]).hasFile
      }
    };
  }

  async function pollStudioExportJob(jobId, button, originalText, tries = 0) {
    try {
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1&t=${Date.now()}`, {
        cache: 'no-store'
      });

      const j = await r.json().catch(() => null);

      console.log('[CARTOON][STUDIO_EXPORT_POLL]', {
        jobId,
        tries,
        response: j
      });

      if (!j || j.ok === false) {
        if (tries < 240) {
          setTimeout(() => pollStudioExportJob(jobId, button, originalText, tries + 1), 3000);
          return;
        }

        throw new Error(j?.error || 'studio_export_poll_failed');
      }

      const status = String(
        j?.status ||
        j?.db_status ||
        j?.state ||
        ''
      ).trim().toLowerCase();

      const finalVideoUrl = String(
        j?.meta?.final_video_url ||
        j?.video?.url ||
        ''
      ).trim();

      const previewVideoUrl = String(
        j?.meta?.preview_video_url ||
        ''
      ).trim();

      const hasReadyVideo =
        !!finalVideoUrl ||
        (Array.isArray(j?.outputs) && j.outputs.some((o) => {
          const type = String(o?.type || '').toLowerCase().trim();
          const variant = String(o?.meta?.variant || '').toLowerCase().trim();
          const url = String(o?.url || '').trim();
          return !!url && type === 'video' && (variant === 'finalized' || variant === 'preview');
        }));
if (['ready', 'completed', 'complete', 'succeeded', 'done'].includes(status) && hasReadyVideo) {
  let resolvedFinalVideoUrl = finalVideoUrl || '';

  const studioState = window.__CARTOON_STUDIO__ || null;
  const logoUrl = String(studioState?.logoFileUrl || '').trim();

if (resolvedFinalVideoUrl && logoUrl && !window.__CARTOON_STUDIO_LOGO_DONE__) {
    button.disabled = true;
    button.textContent = 'Logo işleniyor...';
    button.classList.add('is-loading');

    const logoPosRaw = String(
      document
        .querySelector('.main-panel[data-module="cartoon"] [data-cartoon-view="studio"] [data-studio-logo-position]')?.value ||
      'bottom-right'
    ).trim().toLowerCase();

    const logoPos =
      logoPosRaw === 'top-left' ? 'tl' :
      logoPosRaw === 'top-right' ? 'tr' :
      logoPosRaw === 'bottom-left' ? 'bl' :
      logoPosRaw === 'center' ? 'c' :
      'br';

    const overlayRes = await fetch('/api/cartoon/overlay-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: String(jobId || ''),
        video_url: resolvedFinalVideoUrl,
        logo_url: logoUrl,
        logo_pos: logoPos,
        app: 'cartoon'
      })
    });

    const overlayData = await overlayRes.json().catch(() => null);

    console.log('[CARTOON][STUDIO_LOGO_OVERLAY_RESPONSE]', {
      status: overlayRes.status,
      ok: overlayRes.ok,
      overlayData
    });

    if (!overlayRes.ok || !overlayData || overlayData.ok === false) {
      throw new Error(overlayData?.message || overlayData?.error || 'studio_logo_overlay_failed');
    }

    resolvedFinalVideoUrl = String(overlayData?.url || resolvedFinalVideoUrl || '').trim();
    window.__CARTOON_STUDIO_LOGO_DONE__ = true;
  }

  window.__CARTOON_STUDIO_EXPORT_STATUS__ = j;
  window.dispatchEvent(
    new CustomEvent('aivo:cartoon:job_ready', {
      detail: {
        app: 'cartoon',
        mode: 'studio_export',
        job_id: String(jobId || ''),
        status,
        video: resolvedFinalVideoUrl ? { url: resolvedFinalVideoUrl } : null,
        outputs: Array.isArray(j?.outputs) ? j.outputs : [],
        raw: j,
        meta: {
          app: 'cartoon',
          mode: 'studio_export',
          final_video_url: resolvedFinalVideoUrl,
          preview_video_url: previewVideoUrl
        }
      }
    })
  );
  button.disabled = false;
  button.textContent = originalText;
  button.classList.remove('is-loading');

  alert(`Çıktı hazır. Final video: ${resolvedFinalVideoUrl || '-'}`);
  return;
}

      if (status === 'error') {
        button.disabled = false;
        button.textContent = originalText;
        button.classList.remove('is-loading');

        throw new Error(j?.error_reason || 'studio_export_failed');
      }

      if (tries < 240) {
        setTimeout(() => pollStudioExportJob(jobId, button, originalText, tries + 1), 3000);
        return;
      }

      button.disabled = false;
      button.textContent = originalText;
      button.classList.remove('is-loading');

      throw new Error('studio_export_timeout');
    } catch (err) {
      console.error('[CARTOON][STUDIO_EXPORT_POLL_ERROR]', err);

      button.disabled = false;
      button.textContent = originalText;
      button.classList.remove('is-loading');

      alert(String(err?.message || err || 'studio_export_poll_failed'));
    }
  }

  function bindStudioExportPayloadDebug(rootState, studioRoot) {
    const button = qsAny(studioRoot, [
      '[data-studio-export]',
      '[data-studio-final-output]',
      '[data-studio-generate-final]',
      '#cartoonStudioExportBtn',
      '#studioExportBtn',
      'button[type="button"][data-role="studio-export"]'
    ]);

    if (!button) {
      console.warn('[CARTOON][STUDIO_EXPORT_BUTTON_NOT_FOUND]');
      return;
    }

    if (button.getAttribute('data-studio-export-bound') === 'true') {
      return;
    }

    button.setAttribute('data-studio-export-bound', 'true');

    button.addEventListener('click', async () => {
      const originalText = String(button.textContent || 'Paylaşmaya Hazır Çıktı Al');
      let startedPolling = false;

      try {
        window.__CARTOON_STUDIO_LOGO_DONE__ = false;
        const payload = collectCartoonStudioPayload(rootState, studioRoot);
        window.__CARTOON_STUDIO_EXPORT_PAYLOAD__ = payload;

        console.log('[CARTOON][STUDIO_EXPORT_PAYLOAD]', payload);

        if (!payload.export.scenes.length) {
          alert('Export için en az 1 sahne seçmelisin.');
          return;
        }

        if (rootState?.voiceFileUploadPromise) {
          button.disabled = true;
          button.textContent = 'Ses yükleniyor...';
          button.classList.add('is-loading');

          try {
            await rootState.voiceFileUploadPromise;
          } catch {
            throw new Error(rootState?.voiceFileUploadError || 'studio_voice_upload_failed');
          }
        }

        if (rootState?.voiceFile && String(rootState?.voiceFileUploadStatus || '') !== 'ready') {
          throw new Error('Ses dosyası henüz hazır değil. Yükleme tamamlanınca tekrar dene.');
        }
        if (rootState?.logoFileUploadPromise) {
  button.disabled = true;
  button.textContent = 'Logo yükleniyor...';
  button.classList.add('is-loading');

  try {
    await rootState.logoFileUploadPromise;
  } catch {
    throw new Error(rootState?.logoFileUploadError || 'studio_logo_upload_failed');
  }
}

if (rootState?.logoFile && String(rootState?.logoFileUploadStatus || '') !== 'ready') {
  throw new Error('Logo henüz hazır değil. Yükleme tamamlanınca tekrar dene.');
}

        button.disabled = true;
        button.textContent = 'Çıktı hazırlanıyor...';
        button.classList.add('is-loading');

        const res = await fetch('/api/cartoon/studio/export-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);

        console.log('[CARTOON][STUDIO_EXPORT_CREATE_RESPONSE]', {
          status: res.status,
          ok: res.ok,
          data
        });

        if (!res.ok || !data || data.ok === false) {
          throw new Error(data?.error || `studio_export_create_failed_${res.status}`);
        }

        window.__CARTOON_STUDIO_EXPORT_RESPONSE__ = data;
        if (data?.job_id) {
          const createdDetail = {
            app: 'cartoon',
            mode: 'studio_export',
            job_id: String(data.job_id || ''),
            prompt: payload?.text?.title || payload?.text?.description || 'studio export',
            createdAt: Date.now(),
            meta: {
              app: 'cartoon',
              mode: 'studio_export',
              provider: 'studio',
              prompt: payload?.text?.title || payload?.text?.description || 'studio export',
              scene_count: Number(payload?.export?.sceneCount || 0),
              total_duration: Number(payload?.export?.totalDuration || 0),
              aspect_ratio: String(payload?.export?.format || '16:9')
            }
          };

          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('aivo:cartoon:job_created', {
                detail: createdDetail
              })
            );
          }, 3500);

          startedPolling = true;
          pollStudioExportJob(String(data.job_id), button, originalText, 0);
          return;
        }

        alert(`Export işi kuyruğa alındı. Job ID: ${data.job_id || '-'}`);
      } catch (err) {
        console.error('[CARTOON][STUDIO_EXPORT_CREATE_ERROR]', err);
        alert(String(err?.message || err || 'studio_export_create_failed'));
      } finally {
        if (!startedPolling) {
          button.disabled = false;
          button.textContent = originalText;
          button.classList.remove('is-loading');
        }
      }
    });
  }

  function renderEmptyStudioState(sceneList) {
    if (!sceneList) return;

    sceneList.innerHTML = `
      <div style="
        padding:18px 20px;
        border:1px dashed rgba(255,255,255,.14);
        border-radius:18px;
        background:rgba(255,255,255,.03);
        color:rgba(255,255,255,.78);
        font-weight:600;
      ">
        Henüz sahne yok. Yukarıdan video yükleyerek listeyi oluştur.
      </div>
    `;
  }

  function renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate) {
    if (!sceneList || !sceneTemplate) return;

    sceneList.innerHTML = '';

    if (!Array.isArray(rootState.scenes) || !rootState.scenes.length) {
      renderEmptyStudioState(sceneList);
      updateStudioSummary(rootState, studioRoot);
      return;
    }

    rootState.scenes.forEach((scene, index) => {
      const fragment = sceneTemplate.content.cloneNode(true);
      const row = fragment.querySelector('[data-studio-scene-row]');
      const includeInput = fragment.querySelector('[data-scene-include]');
      const titleEl = fragment.querySelector('[data-scene-title]');
      const durationEl = fragment.querySelector('[data-scene-duration]');
      const previewBtn = fragment.querySelector('[data-scene-preview]');
      const moveUpBtn = fragment.querySelector('[data-scene-move="up"]');
      const moveDownBtn = fragment.querySelector('[data-scene-move="down"]');
      const editBtn = fragment.querySelector('[data-scene-edit]');
      const removeBtn = fragment.querySelector('[data-scene-remove]');

      if (row) {
        row.setAttribute('data-scene-id', scene.id);
      }

      if (includeInput) {
        includeInput.checked = !!scene.included;
        includeInput.addEventListener('change', () => {
          scene.included = !!includeInput.checked;
          saveStudioState(rootState);
          updateStudioSummary(rootState, studioRoot);
        });
      }

      if (titleEl) {
        titleEl.textContent = scene.title || 'Sahne';
      }

      if (durationEl) {
        durationEl.textContent = formatSceneDuration(scene.duration);
      }

      if (previewBtn) {
        previewBtn.addEventListener('click', () => {
          openStudioPreview(studioRoot, scene);
        });
      }

      if (moveUpBtn) {
        if (index === 0) {
          moveUpBtn.disabled = true;
        }

        moveUpBtn.addEventListener('click', () => {
          moveScene(rootState.scenes, index, index - 1);
          saveStudioState(rootState);
          renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate);
        });
      }

      if (moveDownBtn) {
        if (index === rootState.scenes.length - 1) {
          moveDownBtn.disabled = true;
        }

        moveDownBtn.addEventListener('click', () => {
          moveScene(rootState.scenes, index, index + 1);
          saveStudioState(rootState);
          renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate);
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const nextTitle = window.prompt(
            'Yeni sahne başlığını yaz:',
            String(scene.title || '')
          );

          if (nextTitle === null) return;

          const cleaned = String(nextTitle || '').trim();
          if (!cleaned) {
            alert('Sahne başlığı boş olamaz.');
            return;
          }

          scene.title = cleaned;
          saveStudioState(rootState);
          renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate);
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const ok = window.confirm(`"${scene.title || 'Sahne'}" listeden kaldırılsın mı?`);
          if (!ok) return;

          rootState.scenes = rootState.scenes.filter((item) => item.id !== scene.id);
          saveStudioState(rootState);
          renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate);
        });
      }

      sceneList.appendChild(fragment);
    });

    updateStudioSummary(rootState, studioRoot);
  }

  function initCartoonStudio() {
    const cartoonPanel = document.querySelector('.main-panel[data-module="cartoon"]');
    if (!cartoonPanel) {
      return false;
    }

    const studioRoot = cartoonPanel.querySelector('[data-cartoon-view="studio"]');
    if (!studioRoot) {
      return false;
    }

    const studioSceneList = studioRoot.querySelector('[data-studio-scene-list]');
    const studioSceneTemplate = studioRoot.querySelector('#studioSceneRowTemplate');

    if (!studioSceneList || !studioSceneTemplate) {
      return false;
    }

    const alreadyBound = studioRoot.getAttribute('data-studio-bound') === 'true';
    if (alreadyBound) {
      window.__CARTOON_STUDIO__ = window.__CARTOON_STUDIO__ || createStudioState();
      return true;
    }

    const studioState = createStudioState();
    const savedState = loadStudioState();

    studioState.format = String(savedState?.format || '16:9');
    studioState.scenes = Array.isArray(savedState?.scenes) ? savedState.scenes : [];

    ensureStudioPreviewModal(studioRoot);
    renderStudioScenes(studioState, studioRoot, studioSceneList, studioSceneTemplate);

    bindStudioVideoUpload(
      studioState,
      studioRoot,
      studioSceneList,
      studioSceneTemplate
    );
bindStudioVoiceUpload(
  studioState,
  studioRoot
);

bindStudioLogoUpload(
  studioState,
  studioRoot
);

bindStudioFormatPills(
  studioState,
  studioRoot
);

    bindStudioExportPayloadDebug(
      studioState,
      studioRoot
    );

    studioRoot.setAttribute('data-studio-bound', 'true');
    window.__CARTOON_STUDIO__ = studioState;

    return true;
  }

  function bootCartoonStudio() {
    if (initCartoonStudio()) return;

    let tries = 0;
    const maxTries = 40;

    const timer = setInterval(() => {
      tries += 1;

      const ok = initCartoonStudio();
      if (ok || tries >= maxTries) {
        clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCartoonStudio, { once: true });
  } else {
    bootCartoonStudio();
  }
})();
