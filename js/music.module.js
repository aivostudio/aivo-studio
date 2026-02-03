(function () {
  function tryInit() {
    const module = document.querySelector(
      '#moduleHost section[data-module="music"]'
    );
    if (!module) return false;

    const views = module.querySelectorAll('.music-view');
    if (!views.length) return false;

    function switchMusicView(view) {
      if (!view) return;

      views.forEach(v => {
        v.style.display =
          v.dataset.musicView === view ? 'block' : 'none';
      });

      sessionStorage.setItem('aivo_music_tab', view);
    }

    // 🌍 GLOBAL AÇ
    window.switchMusicView = switchMusicView;

    // 🔁 İLK AÇILIŞ
    const initial =
      sessionStorage.getItem('aivo_music_tab') || 'geleneksel';
    switchMusicView(initial);

    console.log('[AIVO] music.module READY', initial);
    return true;
  }

  // 1️⃣ Hemen dene
  if (tryInit()) return;

  // 2️⃣ music.html inject edilene kadar bekle
  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(document.getElementById('moduleHost'), {
    childList: true,
    subtree: true
  });
})();
