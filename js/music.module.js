(function () {
  function tryInit() {
    const module = document.querySelector("#moduleHost section[data-module='music']");
    if (!module) return false;

    // Tek view: geleneksel
    const view = module.querySelector('.music-view[data-music-view="geleneksel"]')
      || module.querySelector(".music-view");
    if (!view) return false;

    // ----------------------------
    // MODE (basic / advanced)
    // ----------------------------
    const MODE_KEY = "aivo_music_mode";
    const modeButtons = module.querySelectorAll("[data-mode-button]");

    function applyMode(mode) {
      const m = (mode === "advanced") ? "advanced" : "basic";
      view.setAttribute("data-mode", m);
      sessionStorage.setItem(MODE_KEY, m);

      // active UI (opsiyonel, ama iyi)
      modeButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.modeButton === m);
      });
    }

    // default mode
    const savedMode = sessionStorage.getItem(MODE_KEY) || "basic";
    applyMode(savedMode);

    // click bind (idempotent)
    modeButtons.forEach((btn) => {
      if (btn.__aivo_bound) return;
      btn.__aivo_bound = true;
      btn.addEventListener("click", () => applyMode(btn.dataset.modeButton));
    });

    // ----------------------------
    // BACKWARD COMPAT:
    // switchMusicView artık gereksiz
    // ama router/eski kod çağırırsa kırılmasın
    // ----------------------------
    window.switchMusicView = function (requestedView, opts) {
      // Tek view var; istek ne olursa olsun "geleneksel" gösteriliyor.
      // Persist etmek istiyorsan (eski tab mantığı) yine yazalım ama artık kullanılmayacak.
      try {
        const persist = !(opts && opts.persist === false);
        if (persist && requestedView) {
          sessionStorage.setItem("aivo_music_tab", requestedView);
        }
      } catch (_) {}
      return true;
    };

    console.log("[AIVO] music.module READY (single-view)");
    return true;
  }

  // 1) Hemen dene
  if (tryInit()) return;

  // 2) module inject edilene kadar bekle
  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
