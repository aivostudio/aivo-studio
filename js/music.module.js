(function () {
  function initMusicModule() {
    const module = document.querySelector('section[data-module="music"]');
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

    console.log('[AIVO] music.module ready');
    return true;
  }

  // 🔁 DOM hazır olana kadar dene
  if (!initMusicModule()) {
    document.addEventListener('DOMContentLoaded', initMusicModule);
  }
})();
