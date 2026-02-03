(function () {
  const module = document.querySelector(
    'section[data-module="music"]'
  );
  if (!module) return;

  const views = module.querySelectorAll('.music-view');

  function switchMusicView(view) {
    let found = false;

    views.forEach(v => {
      const isActive = v.dataset.musicView === view;
      v.style.display = isActive ? 'block' : 'none';
      if (isActive) found = true;
    });

    // Eğer geçersiz view gelirse fallback
    if (!found && views[0]) {
      views.forEach(v => v.style.display = 'none');
      views[0].style.display = 'block';
      view = views[0].dataset.musicView;
    }

    sessionStorage.setItem('aivo_music_tab', view);
  }

  window.switchMusicView = switchMusicView;

  const initial =
    sessionStorage.getItem('aivo_music_tab') || 'geleneksel';

  switchMusicView(initial);
})();
