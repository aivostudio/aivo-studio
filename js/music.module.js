(function () {
  function tryInit() {
    const module = document.querySelector(
      '#moduleHost section[data-module="music"]'
    );
    if (!module) return false;

    const views = module.querySelectorAll('.music-view');

    function switchMusicView(view) {
      views.forEach(v => {
        v.style.display =
          v.dataset.musicView === view ? 'block' : 'none';
      });

      sessionStorage.setItem('aivo_music_tab', view);
    }

    window.switchMusicView = switchMusicView;

    const initial =
      sessionStorage.getItem('aivo_music_tab') || 'geleneksel';
    switchMusicView(initial);

    console.log('[AIVO] music.module READY');
    return true;
  }

  // 1️⃣ ilk dene
  if (tryInit()) return;

  // 2️⃣ modül inject edilene kadar izle
  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(document.getElementById('moduleHost'), {
    childList: true,
    subtree: true
  });
})();
