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
      previewTitle: ''
    };
  }

  function ensureStudioPreviewModal(studioRoot) {
    let modal = studioRoot.querySelector('[data-studio-preview-modal]');

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
             z-index:9998;
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

    studioRoot.appendChild(modal);

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

  async function appendUploadedStudioVideos(rootState, studioRoot, sceneList, sceneTemplate, fileList) {
    const files = Array.from(fileList || []).filter((file) => {
      return file && String(file.type || '').toLowerCase().startsWith('video/');
    });

    if (!files.length) return;

    const nextScenes = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const duration = await getStudioVideoDuration(file);
      const objectUrl = URL.createObjectURL(file);
      const fileName = String(file.name || `video-${Date.now()}-${i + 1}`).trim();
      const title = fileName.replace(/\.[^.]+$/, '');

      nextScenes.push({
        id: `upload-${Date.now()}-${i + 1}`,
        title,
        duration,
        included: true,
        videoUrl: objectUrl,
        fileName
      });
    }

    rootState.scenes.push(...nextScenes);
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

      await appendUploadedStudioVideos(
        rootState,
        studioRoot,
        sceneList,
        sceneTemplate,
        files
      );
    });
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

      if (row) {
        row.setAttribute('data-scene-id', scene.id);
      }

      if (includeInput) {
        includeInput.checked = !!scene.included;
        includeInput.addEventListener('change', () => {
          scene.included = !!includeInput.checked;
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
          renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate);
        });
      }

      if (moveDownBtn) {
        if (index === rootState.scenes.length - 1) {
          moveDownBtn.disabled = true;
        }

        moveDownBtn.addEventListener('click', () => {
          moveScene(rootState.scenes, index, index + 1);
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

    ensureStudioPreviewModal(studioRoot);
    renderStudioScenes(studioState, studioRoot, studioSceneList, studioSceneTemplate);

    bindStudioVideoUpload(
      studioState,
      studioRoot,
      studioSceneList,
      studioSceneTemplate
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
