(() => {
  function formatSceneDuration(seconds) {
    const value = Number(seconds) || 0;
    return `${value} sn`;
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

  function renderStudioScenes(rootState, sceneList, sceneTemplate) {
    if (!sceneList || !sceneTemplate) return;

    sceneList.innerHTML = '';

    rootState.scenes.forEach((scene) => {
      const fragment = sceneTemplate.content.cloneNode(true);
      const row = fragment.querySelector('[data-studio-scene-row]');
      const includeInput = fragment.querySelector('[data-scene-include]');
      const titleEl = fragment.querySelector('[data-scene-title]');
      const durationEl = fragment.querySelector('[data-scene-duration]');

      if (row) row.setAttribute('data-scene-id', scene.id);
      if (includeInput) includeInput.checked = !!scene.included;
      if (titleEl) titleEl.textContent = scene.title || 'Sahne';
      if (durationEl) durationEl.textContent = formatSceneDuration(scene.duration);

      sceneList.appendChild(fragment);
    });
  }

  function initCartoonStudio() {
    const studioRoot = document.querySelector('[data-cartoon-view="studio"]');
    const studioSceneList = document.querySelector('[data-studio-scene-list]');
    const studioSceneTemplate = document.getElementById('studioSceneRowTemplate');

    if (!studioRoot || !studioSceneList || !studioSceneTemplate) {
      return false;
    }

    const alreadyBound = studioRoot.getAttribute('data-studio-bound') === 'true';
    if (alreadyBound) {
      return true;
    }

    const studioState = createStudioState();

    renderStudioScenes(studioState, studioSceneList, studioSceneTemplate);

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
