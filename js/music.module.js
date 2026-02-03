(function () {
  const module = document.querySelector('section[data-module="music"]');
  if (!module) return;

  const views = module.querySelectorAll('.music-view');

  function switchMusicView(view) {
    let found = false;

    views.forEach(v => {
      const active = v.dataset.musicView === view;
      v.style.display = active ? 'block' : 'none';
      if (active) found = true;
    });

    // fallback
    if (!found && views[0]) {
      views.forEach(v => (v.style.display = 'none'));
      views[0].style.display = 'block';
      view = views[0].dataset.musicView;
    }

    sessionStorage.setItem('aivo_music_tab', view);
  }

  // GLOBAL (router burayı çağıracak)
  window.switchMusicView = switchMusicView;

  // 🔴 EN KRİTİK SATIRLAR BURASI
  // Sol menüden gelen tab’i oku
  const initial =
    sessionStorage.getItem('aivo_music_tab') ||
    module.getAttribute('data-music-tab') ||
    'geleneksel';

  switchMusicView(initial);
})();
