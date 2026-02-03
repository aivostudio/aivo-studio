(function () {
  function tryInit() {
    const module = document.querySelector("#moduleHost section[data-module='music']");
    if (!module) return false;

    // MODE (basic / advanced)
    const MODE_KEY = "aivo_music_mode";
    const switchEl = module.querySelector(".mode-toggle");
    if (!switchEl) return false;

    const modeButtons = Array.from(switchEl.querySelectorAll("[data-mode-button]"));
    const advFields = Array.from(module.querySelectorAll('[data-visible-in="advanced"]'));

    function applyMode(mode) {
      const m = (mode === "advanced") ? "advanced" : "basic";
      module.setAttribute("data-mode", m);
      switchEl.dataset.active = m; // CSS pill kaydırmak için
      try { sessionStorage.setItem(MODE_KEY, m); } catch(e) {}

      // active state + aria
      modeButtons.forEach((btn) => {
        const on = btn.dataset.modeButton === m;
        btn.classList.toggle("isActive", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });

      // advanced alanları göster/gizle
      const showAdv = (m === "advanced");
      advFields.forEach((el) => {
        el.style.display = showAdv ? "" : "none";
      });
    }

    // default
    let saved = "basic";
    try { saved = sessionStorage.getItem(MODE_KEY) || "basic"; } catch(e) {}
    applyMode(saved);

    // click bind (idempotent)
    if (!module.__aivo_mode_bound) {
      module.__aivo_mode_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest(".mode-toggle [data-mode-button]");
        if (!btn) return;
        applyMode(btn.dataset.modeButton);
      });
    }

    // backward compat
    window.switchMusicView = function () { return true; };

    console.log("[AIVO] music.module READY (mode toggle ok)");
    return true;
  }

  if (tryInit()) return;

  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
