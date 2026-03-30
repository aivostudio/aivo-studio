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
      scenes: [
        {
          id: 'scene-1',
          title: 'Sahne 1 · Açılış',
          duration: 15,
          included: true,
          videoUrl: ''
        },
        {
          id: 'scene-2',
          title: 'Sahne 2 · Karakter Girişi',
          duration: 15,
          included: true,
          videoUrl: ''
        },
        {
          id: 'scene-3',
          title: 'Sahne 3 · Geçiş',
          duration: 10,
          included: false,
          videoUrl: ''
        }
      ]
    };
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

  function renderStudioScenes(rootState, studioRoot, sceneList, sceneTemplate) {
    if (!sceneList || !sceneTemplate) return;

    sceneList.innerHTML = '';

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
          console.log('[CARTOON_STUDIO] preview', scene);
        });
      }

    if (moveUpBtn) {
  if (index === 0) {
    moveUpBtn.disabled = true;
  }

  moveUpBtn.addEventListener('click', () => {
 

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

  renderStudioScenes(studioState, studioRoot, studioSceneList, studioSceneTemplate);

  studioRoot.setAttribute('data-studio-bound', 'true');
  window.__CARTOON_STUDIO__ = studioState;

  console.log('[CARTOON_STUDIO] ready', studioState);

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
