<script>
(() => {
  const studioSceneList = document.querySelector('[data-studio-scene-list]');
  const studioSceneTemplate = document.getElementById('studioSceneRowTemplate');

  if (!studioSceneList || !studioSceneTemplate) return;

  const studioState = {
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

  function formatSceneDuration(seconds) {
    const value = Number(seconds) || 0;
    return `${value} sn`;
  }

  function renderStudioScenes() {
    studioSceneList.innerHTML = '';

    studioState.scenes.forEach((scene) => {
      const fragment = studioSceneTemplate.content.cloneNode(true);
      const row = fragment.querySelector('[data-studio-scene-row]');
      const includeInput = fragment.querySelector('[data-scene-include]');
      const titleEl = fragment.querySelector('[data-scene-title]');
      const durationEl = fragment.querySelector('[data-scene-duration]');

      if (row) row.setAttribute('data-scene-id', scene.id);
      if (includeInput) includeInput.checked = !!scene.included;
      if (titleEl) titleEl.textContent = scene.title || 'Sahne';
      if (durationEl) durationEl.textContent = formatSceneDuration(scene.duration);

      studioSceneList.appendChild(fragment);
    });
  }

  renderStudioScenes();

  window.__CARTOON_STUDIO__ = studioState;
})();
</script>
